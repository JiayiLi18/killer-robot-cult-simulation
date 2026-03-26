// ============================================================
// WebSocket server wrapping the Game engine
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Game } from './game/Game.js';
import type { GodId } from './types/index.js';
import mapLayout from './data/map.json';

const PORT = parseInt(process.env.WS_PORT ?? '3001', 10);
const ROOM_CODE = Math.random().toString(36).slice(2, 8).toUpperCase();

const game = new Game({
  ticksPerSecond: 1,
  minGods: 1,
});

// Track connected clients and their metadata
interface GodInfo {
  ws: WebSocket;
  godId: GodId;
  name: string;
  hasRobot: boolean;
}

const clients = new Map<WebSocket, GodInfo>();

// ── Game event hooks ─────────────────────────────────────────

game.on({
  onTick: () => broadcast(),
  onPhaseChange: () => broadcast(),
  onGameOver: (winner) => {
    console.log(`[game] game over — ${winner} win`);
    broadcast();
  },
  onAgentDied: (victimId, killerId) => {
    console.log(`[game] ${victimId} killed by ${killerId}`);
  },
  onCouncilCalled: (agentId) => {
    console.log(`[game] council called by ${agentId}`);
  },
  onCouncilEnded: (result) => {
    console.log(`[game] council ended — ejected: ${result.ejected ?? 'nobody'}`);
  },
  onVoiceOfGod: (entry) => {
    console.log(`[game] voice of god: "${entry.words}"`);
  },
});

// ── Build lobby state for broadcasts ─────────────────────────

function getLobbyState() {
  const players: { id: string; name: string; hasRobot: boolean; isConnected: boolean }[] = [];
  for (const info of clients.values()) {
    players.push({
      id: info.godId,
      name: info.name,
      hasRobot: info.hasRobot,
      isConnected: info.ws.readyState === WebSocket.OPEN,
    });
  }
  return { roomCode: ROOM_CODE, players };
}

// ── Broadcast state to all connected clients ─────────────────

function broadcast() {
  const state = game.getState();
  const lobby = getLobbyState();
  const msg = JSON.stringify({ type: 'state', data: { ...state, lobby } });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ── Auto-start when all gods have defined robots ─────────────

function tryAutoStart() {
  if (game.getPhase() !== 'setup') return;
  const gods = Array.from(clients.values());
  if (gods.length < 1) return;
  if (!gods.every(g => g.hasRobot)) return;

  console.log(`[ws-server] all ${gods.length} gods ready — starting simulation`);
  game.startSimulation();
  broadcast();
}

// ── WebSocket server ─────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`[ws-server] listening on ws://localhost:${PORT}`);
  console.log(`[ws-server] room code: ${ROOM_CODE}`);
});

wss.on('connection', (ws) => {
  console.log('[ws-server] client connected');

  // Send room code immediately so client can display it before joining
  ws.send(JSON.stringify({ type: 'roomInfo', roomCode: ROOM_CODE }));

  ws.on('message', (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    const type = msg.type as string;
    const godId = msg.godId as GodId | undefined;

    switch (type) {
      case 'join': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const name = (msg.name as string) || godId;
        clients.set(ws, { ws, godId, name, hasRobot: false });
        const result = game.joinGame(godId);
        if (!result.success) {
          console.log(`[ws-server] join failed for ${name} (${godId}): ${result.error}`);
        } else {
          console.log(`[ws-server] ${name} (${godId}) joined`);
        }
        broadcast();
        break;
      }

      case 'defineRobot': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        // Must start game (transition to setup) before defining robots
        if (game.getPhase() === 'lobby') {
          const startResult = game.startGame(mapLayout);
          if (!startResult.success) {
            sendError(ws, startResult.error ?? 'Cannot start game');
            return;
          }
          console.log('[ws-server] game started (setup phase)');
        }
        const result = game.defineRobot(
          godId,
          msg.name as string,
          msg.look as string,
          msg.identity as string,
          msg.imageUrl as string | undefined,
        );
        ws.send(JSON.stringify({ type: 'defineRobot', ...result }));
        if (result.success) {
          const info = clients.get(ws);
          if (info) info.hasRobot = true;
          broadcast();
          tryAutoStart();
        }
        break;
      }

      case 'startGame': {
        const layout = (msg.mapLayout as typeof mapLayout) ?? mapLayout;
        const result = game.startGame(layout);
        ws.send(JSON.stringify({ type: 'startGame', ...result }));
        if (result.success) broadcast();
        break;
      }

      case 'startSimulation': {
        game.startSimulation();
        broadcast();
        break;
      }

      case 'whisper': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const result = game.whisperToRobot(godId, msg.words as string);
        ws.send(JSON.stringify({ type: 'whisper', ...result }));
        break;
      }

      case 'submitVog': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const result = game.submitVoiceOfGod(godId, msg.words as string);
        ws.send(JSON.stringify({ type: 'submitVog', ...result }));
        break;
      }

      case 'voteVog': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const result = game.voteVoiceOfGod(godId, msg.forGodId as GodId);
        ws.send(JSON.stringify({ type: 'voteVog', ...result }));
        break;
      }

      case 'voteCouncil': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const result = game.voteInCouncil(godId, msg.targetAgentId as string);
        ws.send(JSON.stringify({ type: 'voteCouncil', ...result }));
        break;
      }

      default:
        sendError(ws, `Unknown message type: ${type}`);
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info) {
      console.log(`[ws-server] ${info.name} (${info.godId}) disconnected`);
      clients.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.error('[ws-server] socket error:', err.message);
  });
});

function sendError(ws: WebSocket, error: string) {
  ws.send(JSON.stringify({ type: 'error', error }));
}
