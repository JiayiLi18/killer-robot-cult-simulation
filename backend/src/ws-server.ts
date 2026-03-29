// ============================================================
// WebSocket server — one Game + lobby per room id
// ============================================================

import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import { Game } from './game/Game.js';
import { GroqProvider } from './llm/GroqProvider.js';
import type { GodId } from './types/index.js';
import mapLayout from './data/map.json';

const PORT = parseInt(process.env.WS_PORT ?? '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

/** Shared across rooms; agents use Groq when key is set (see backend/.env). */
function createSharedGroq(): GroqProvider | null {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || key === 'your_api_key_here' || key === 'your_groq_api_key_here') {
    return null;
  }
  const model = process.env.GROQ_MODEL?.trim() || undefined;
  console.log('[ws-server] Groq LLM enabled' + (model ? ` (model: ${model})` : ''));
  return new GroqProvider({
    apiKey: key,
    model,
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS ?? '150', 10) || 150,
    temperature: parseFloat(process.env.GROQ_TEMPERATURE ?? '0.85') || 0.85,
    maxConcurrency: parseInt(process.env.GROQ_MAX_CONCURRENCY ?? '8', 10) || 8,
  });
}

const sharedGroq = createSharedGroq();

type RoomId = string;

type LobbyPlayer = {
  id: GodId;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  lobbyReady: boolean;
  setupReady: boolean;
};

type RoomRuntime = {
  id: RoomId;
  game: Game;
  players: Map<GodId, LobbyPlayer>;
  hostId: GodId | null;
};

const rooms = new Map<RoomId, RoomRuntime>();
const socketMeta = new Map<WebSocket, { roomId: RoomId; godId: GodId }>();
/** Sockets that have completed join for this room — used for reliable broadcast */
const socketsByRoom = new Map<RoomId, Set<WebSocket>>();

function trackRoomSocket(roomId: RoomId, ws: WebSocket): void {
  let set = socketsByRoom.get(roomId);
  if (!set) {
    set = new Set();
    socketsByRoom.set(roomId, set);
  }
  set.add(ws);
}

function untrackRoomSocket(roomId: RoomId, ws: WebSocket): void {
  socketsByRoom.get(roomId)?.delete(ws);
}

function normalizeRoomId(raw: unknown): RoomId {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().slice(0, 32);
  }
  return 'default';
}

function createRoom(roomId: RoomId): RoomRuntime {
  const game = new Game({
    ticksPerSecond: 1,
    minGods: 1,
  });
  if (sharedGroq) {
    game.setLLM(sharedGroq);
  }
  const rr: RoomRuntime = { id: roomId, game, players: new Map(), hostId: null };
  game.on({
    onTick: () => broadcastRoom(roomId),
    onPhaseChange: () => broadcastRoom(roomId),
    onGameOver: (winner) => {
      console.log(`[game:${roomId}] game over — ${winner} win`);
      broadcastRoom(roomId);
    },
    onAgentDied: (victimId, killerId) => {
      console.log(`[game:${roomId}] ${victimId} killed by ${killerId}`);
    },
    onCouncilCalled: (agentId) => {
      console.log(`[game:${roomId}] council called by ${agentId}`);
    },
    onCouncilEnded: (result) => {
      console.log(`[game:${roomId}] council ended — ejected: ${result.ejected ?? 'nobody'}`);
    },
    onVoiceOfGod: (entry) => {
      console.log(`[game:${roomId}] voice of god: "${entry.words}"`);
    },
  });
  // Re-broadcast when LLM narrative arrives (after game ends)
  game.getEngine().setNarrativeCallback(() => broadcastRoom(roomId));
  rooms.set(roomId, rr);
  return rr;
}

function getOrCreateRoom(roomId: RoomId): RoomRuntime {
  return rooms.get(roomId) ?? createRoom(roomId);
}

function syncHostFlags(room: RoomRuntime): void {
  for (const p of room.players.values()) {
    p.isHost = room.hostId !== null && p.id === room.hostId;
  }
}

function promoteHost(room: RoomRuntime): void {
  const connected = [...room.players.values()].filter((p) => p.isConnected);
  if (connected.length > 0) {
    room.hostId = connected[0].id;
  } else {
    room.hostId = [...room.players.values()][0]?.id ?? null;
  }
  syncHostFlags(room);
}

function getStatePayload(room: RoomRuntime) {
  return {
    ...room.game.getState(),
    lobby: {
      roomId: room.id,
      roomCode: room.id,
      qrUrl: `${CLIENT_URL}/?live&room=${encodeURIComponent(room.id)}`,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isConnected: p.isConnected,
        isReady: p.setupReady,
        lobbyReady: p.lobbyReady,
      })),
      isHost: false,
    },
  };
}

const wss = new WebSocketServer({ port: PORT });

function broadcastRoom(roomId: RoomId): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify({ type: 'state', data: getStatePayload(room) });
  const set = socketsByRoom.get(roomId);
  if (!set) return;
  for (const client of set) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(msg);
    } catch (err) {
      console.error('[ws-server] broadcast send failed:', err);
    }
  }
}

function getRoomForSocket(ws: WebSocket): RoomRuntime | null {
  const meta = socketMeta.get(ws);
  if (!meta) return null;
  return rooms.get(meta.roomId) ?? null;
}

wss.on('listening', () => {
  console.log(`[ws-server] listening on ws://localhost:${PORT}`);
  if (!sharedGroq) {
    console.log('[ws-server] agents: stochastic fallback (set GROQ_API_KEY in backend/.env for Groq)');
  }
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

    if (type === 'join') {
      if (!godId) {
        sendError(ws, 'godId required');
        return;
      }
      const roomId = normalizeRoomId(msg.roomId);
      const prevMeta = socketMeta.get(ws);
      if (prevMeta && prevMeta.roomId !== roomId) {
        untrackRoomSocket(prevMeta.roomId, ws);
      }
      const room = getOrCreateRoom(roomId);
      const name =
        typeof msg.name === 'string' && msg.name.trim()
          ? msg.name.trim()
          : `God ${godId.slice(-4).toUpperCase()}`;

      const existing = room.players.get(godId);
      if (existing) {
        existing.name = name;
        existing.isConnected = true;
        socketMeta.set(ws, { roomId, godId });
        trackRoomSocket(roomId, ws);
        console.log(`[ws-server:${roomId}] ${godId} reconnected`);
        broadcastRoom(roomId);
        return;
      }

      const result = room.game.joinGame(godId);
      if (!result.success) {
        sendError(ws, result.error ?? 'Join failed');
        console.log(`[ws-server:${roomId}] join failed for ${godId}: ${result.error}`);
        return;
      }

      if (!room.hostId) {
        room.hostId = godId;
      }
      room.players.set(godId, {
        id: godId,
        name,
        isHost: false,
        isConnected: true,
        lobbyReady: false,
        setupReady: false,
      });
      syncHostFlags(room);
      socketMeta.set(ws, { roomId, godId });
      trackRoomSocket(roomId, ws);
      console.log(`[ws-server:${roomId}] ${godId} joined`);
      broadcastRoom(roomId);
      return;
    }

    const room = getRoomForSocket(ws);
    if (!room) {
      sendError(ws, 'Join a room first');
      return;
    }
    const meta = socketMeta.get(ws)!;

    switch (type) {
      case 'lobbyReady': {
        if (!godId || godId !== meta.godId) {
          sendError(ws, 'godId mismatch');
          return;
        }
        if (room.game.getPhase() !== 'lobby') {
          sendError(ws, 'Not in lobby');
          return;
        }
        const p = room.players.get(godId);
        if (!p) {
          sendError(ws, 'Not in room');
          return;
        }
        p.lobbyReady = msg.ready === true;
        console.log(`[ws-server:${meta.roomId}] ${godId} lobbyReady=${p.lobbyReady}`);
        broadcastRoom(meta.roomId);
        break;
      }

      case 'defineRobot': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const result = room.game.defineRobot(
          godId,
          msg.name as string,
          msg.look as string,
          msg.identity as string,
          msg.imageUrl as string | undefined,
        );
        ws.send(JSON.stringify({ type: 'defineRobot', ...result }));
        if (result.success) {
          const player = room.players.get(godId);
          if (player) {
            player.setupReady = true;
          }
          broadcastRoom(meta.roomId);
        }
        break;
      }

      case 'startGame': {
        if (!godId || godId !== room.hostId) {
          sendError(ws, 'Only the host can start');
          return;
        }
        if (room.game.getPhase() !== 'lobby') {
          sendError(ws, 'Game already started');
          return;
        }
        const connected = [...room.players.values()].filter((p) => p.isConnected);
        if (connected.length === 0 || !connected.every((p) => p.lobbyReady === true)) {
          sendError(ws, 'Everyone must be ready');
          return;
        }
        const layout = (msg.mapLayout as typeof mapLayout) ?? mapLayout;
        const result = room.game.startGame(layout);
        ws.send(JSON.stringify({ type: 'startGame', ...result }));
        if (result.success) {
          for (const p of room.players.values()) {
            p.setupReady = false;
          }
          broadcastRoom(meta.roomId);
        }
        break;
      }

      case 'startSimulation': {
        if (!godId || godId !== room.hostId) {
          sendError(ws, 'Only the host can launch');
          return;
        }
        if (room.game.getPhase() !== 'setup') {
          sendError(ws, 'Not in setup');
          return;
        }
        const connected = [...room.players.values()].filter((p) => p.isConnected);
        if (!connected.every((p) => p.setupReady)) {
          sendError(ws, 'Everyone must finish robot setup');
          return;
        }
        const npcCount = typeof msg.npcCount === 'number' ? Math.max(0, Math.min(12, Math.floor(msg.npcCount))) : 0;
        room.game.startSimulation(npcCount);
        console.log(`[game:${meta.roomId}] simulation started with ${connected.length} players + ${npcCount} NPCs`);
        broadcastRoom(meta.roomId);
        break;
      }

      case 'endGame': {
        if (!godId || godId !== room.hostId) {
          sendError(ws, 'Only the host can end the game');
          return;
        }
        room.game.stop();
        // Force to ended phase via a reset-like approach
        room.game.reset();
        for (const p of room.players.values()) {
          if (p.isConnected) {
            room.game.joinGame(p.id);
            p.lobbyReady = false;
            p.setupReady = false;
          }
        }
        console.log(`[game:${meta.roomId}] game ended by host`);
        broadcastRoom(meta.roomId);
        break;
      }

      case 'playAgain': {
        if (!godId || godId !== room.hostId) {
          sendError(ws, 'Only the host can restart');
          return;
        }
        room.game.reset();
        // Re-join all connected players
        for (const p of room.players.values()) {
          if (p.isConnected) {
            room.game.joinGame(p.id);
            p.lobbyReady = false;
            p.setupReady = false;
          }
        }
        console.log(`[game:${meta.roomId}] game reset by host`);
        broadcastRoom(meta.roomId);
        break;
      }

      case 'whisper': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const result = room.game.whisperToRobot(godId, msg.words as string);
        ws.send(JSON.stringify({ type: 'whisper', ...result }));
        break;
      }

      case 'submitVog': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const result = room.game.submitVoiceOfGod(godId, msg.words as string);
        ws.send(JSON.stringify({ type: 'submitVog', ...result }));
        break;
      }

      case 'voteVog': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const result = room.game.voteVoiceOfGod(godId, msg.forGodId as GodId);
        ws.send(JSON.stringify({ type: 'voteVog', ...result }));
        break;
      }

      case 'callCouncil': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const god2 = room.players.get(godId);
        if (!god2) {
          sendError(ws, 'Not in room');
          return;
        }
        const result = room.game.callCouncil(godId);
        ws.send(JSON.stringify({ type: 'callCouncil', ...result }));
        if (result.success) {
          console.log(`[game:${meta.roomId}] council called by god ${godId}`);
          broadcastRoom(meta.roomId);
        }
        break;
      }

      case 'voteCouncil': {
        if (!godId) {
          sendError(ws, 'godId required');
          return;
        }
        const result = room.game.voteInCouncil(godId, msg.targetAgentId as string);
        ws.send(JSON.stringify({ type: 'voteCouncil', ...result }));
        break;
      }

      default:
        sendError(ws, `Unknown message type: ${type}`);
    }
  });

  ws.on('close', () => {
    const meta = socketMeta.get(ws);
    socketMeta.delete(ws);
    if (meta) {
      untrackRoomSocket(meta.roomId, ws);
    }
    if (!meta) return;
    const room = rooms.get(meta.roomId);
    if (!room) return;
    const p = room.players.get(meta.godId);
    if (p) {
      p.isConnected = false;
    }
    console.log(`[ws-server:${meta.roomId}] ${meta.godId} disconnected`);
    if (room.hostId === meta.godId) {
      promoteHost(room);
    }
    broadcastRoom(meta.roomId);
  });

  ws.on('error', (err) => {
    console.error('[ws-server] socket error:', err.message);
  });
});

function sendError(ws: WebSocket, error: string) {
  ws.send(JSON.stringify({ type: 'error', error }));
}
