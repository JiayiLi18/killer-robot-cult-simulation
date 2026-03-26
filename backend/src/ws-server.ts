// ============================================================
// WebSocket server wrapping the Game engine
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Game } from './game/Game.js';
import type { GodId } from './types/index.js';
import mapLayout from './data/map.json';

const PORT = parseInt(process.env.WS_PORT ?? '3001', 10);

const game = new Game({
  ticksPerSecond: 1,
  minGods: 1,
});

// Track connected gods
const clients = new Map<WebSocket, GodId>();

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

// ── Broadcast state to all connected clients ─────────────────

function broadcast() {
  const state = game.getState();
  const msg = JSON.stringify({ type: 'state', data: state });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// ── WebSocket server ─────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`[ws-server] listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('[ws-server] client connected');

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
        clients.set(ws, godId);
        const result = game.joinGame(godId);
        if (!result.success) {
          console.log(`[ws-server] join failed for ${godId}: ${result.error}`);
        } else {
          console.log(`[ws-server] ${godId} joined`);
        }
        // Send current state immediately
        ws.send(JSON.stringify({ type: 'state', data: game.getState() }));
        break;
      }

      case 'defineRobot': {
        if (!godId) { sendError(ws, 'godId required'); return; }
        const result = game.defineRobot(
          godId,
          msg.name as string,
          msg.look as string,
          msg.identity as string,
          msg.imageUrl as string | undefined,
        );
        ws.send(JSON.stringify({ type: 'defineRobot', ...result }));
        if (result.success) broadcast();
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
    const godId = clients.get(ws);
    if (godId) {
      console.log(`[ws-server] ${godId} disconnected`);
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
