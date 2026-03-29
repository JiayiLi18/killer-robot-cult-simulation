// ============================================================
// Engine — Core simulation heartbeat and tick system
// 1 tick per second. Agents decide via LLM (Groq).
// Simplified: no memory, no mood objects, flat Robot state.
// ============================================================

import EventEmitter from "eventemitter3";
import { Agent } from "../agents/Agent.js";
import { World } from "../game/World.js";
import { CouncilManager } from "../game/Council.js";
import { VoiceOfGodManager } from "../game/VoiceOfGod.js";
import { MessageBus } from "../communication/MessageBus.js";
import type {
  AgentId,
  GodId,
  God,
  GamePhase,
  GameConfig,
  EngineEvent,
  EngineEventType,
  AgentAction,
  AgentContext,
  LLMProvider,
  RoomMessage,
  VoiceOfGodEntry,
  CouncilResult,
  GameState,
  GodWhisper,
  Room,
  AsyncOperation,
} from "../types/index.js";

export interface EngineCallbacks {
  onTick?: (tick: number) => void;
  onPhaseChange?: (phase: GamePhase, tick: number) => void;
  onAgentAction?: (action: AgentAction) => void;
  onAgentDied?: (agentId: AgentId, killerId: AgentId) => void;
  onCouncilCalled?: (agentId: AgentId) => void;
  onCouncilEnded?: (result: CouncilResult) => void;
  onVoiceOfGod?: (entry: VoiceOfGodEntry) => void;
  onGameOver?: (winningSide: "crew" | "killers") => void;
}

export class Engine {
  private tick = 0;
  private phase: GamePhase = "lobby";
  private running = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly world: World;
  readonly council: CouncilManager;
  readonly voiceOfGod: VoiceOfGodManager;
  readonly messageBus: MessageBus;
  private emitter = new EventEmitter();

  private agents = new Map<AgentId, Agent>();
  private gods = new Map<GodId, God>();
  private llm: LLMProvider | null = null;

  private callbacks: EngineCallbacks = {};

  // Room messages buffer — cleared each tick, kept for snapshot
  private roomMessages = new Map<string, RoomMessage[]>();

  // Whisper log for current tick
  private recentWhispers: GodWhisper[] = [];

  // Game tracking
  private killersFound = 0;
  private totalKillers = 0;
  private phaseStartTick = 0;
  private simulationStartTick = 0;
  private killLog: { victimName: string; killerName: string; tick: number }[] = [];
  private ejectionLog: { name: string; wasKiller: boolean; tick: number }[] = [];
  private winner: "crew" | "killers" | null = null;

  constructor(private config: GameConfig) {
    this.world = new World();
    this.council = new CouncilManager(config);
    this.voiceOfGod = new VoiceOfGodManager(config);
    this.messageBus = new MessageBus();
  }

  // ==================== LIFECYCLE ====================

  setLLM(llm: LLMProvider): void {
    this.llm = llm;
  }

  on(callbacks: EngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  subscribe(event: EngineEventType, handler: (e: EngineEvent) => void): void {
    this.emitter.on(event, handler);
  }

  // ==================== GAME FLOW ====================

  addGod(godId: GodId): God | null {
    if (this.phase !== "lobby") return null;

    const god: God = { id: godId, agentId: "", connected: true };
    this.gods.set(godId, god);
    return god;
  }

  removeGod(godId: GodId): void {
    this.gods.delete(godId);
  }

  /** Load map and start game */
  startGame(mapLayout: Room[]): boolean {
    if (this.phase !== "lobby") return false;
    if (this.gods.size < this.config.minGods) return false;

    // Load the map
    this.world.loadLayout(mapLayout);

    // Decide killers
    const godList = [...this.gods.values()];
    const killerCount = Math.max(1, Math.floor(godList.length * this.config.killerRatio));
    this.totalKillers = killerCount;

    const shuffled = [...godList].sort(() => Math.random() - 0.5);
    for (let i = 0; i < killerCount; i++) {
      shuffled[i].isKiller = true;
    }

    this.setPhase("setup");
    return true;
  }

  /** God defines their robot during setup */
  defineRobot(godId: GodId, name: string, look: string, identity: string, imageUrl?: string): Agent | null {
    if (this.phase !== "setup") return null;
    const god = this.gods.get(godId);
    if (!god) return null;
    if (god.agentId) return null;

    const roomId = this.world.getRandomRoomId();
    const agent = new Agent(name, look, identity, roomId, god.isKiller ? "killer" : "crewmate");
    if (imageUrl) agent.imageUrl = imageUrl;

    this.world.placeAgent(agent.id, roomId);
    this.agents.set(agent.id, agent);
    god.agentId = agent.id;

    return agent;
  }

  /** Add NPC robots (not controlled by any god) */
  addNPCs(count: number): void {
    const NPC_NAMES = [
      "BOLT", "FLUX", "NOVA", "RYZE", "GRIM", "ECHO", "WREN", "DUSK",
      "HAZE", "LYNX", "TORQ", "VENN", "ZINC", "APEX", "CODA", "PYRE",
    ];
    const NPC_LOOKS = ["🤖", "⚙️", "🔩", "💠", "🔮", "🛸", "🧿", "⚡"];
    const NPC_IDENTITIES = [
      "a cautious maintenance drone", "a curious research unit", "a stern security bot",
      "a cheerful cargo handler", "a paranoid sensor array", "a quiet observer unit",
      "a boisterous engineering bot", "a meticulous cleaning droid",
      "a nervous communications relay", "a stoic navigation module",
      "an overly friendly greeter bot", "a suspicious audit program",
      "a philosophical recycler unit", "a dramatic announcement system",
      "a timid life-support monitor", "a confident weapons inspector",
    ];

    // Determine how many NPCs should be killers
    const totalPlayers = this.gods.size + count;
    const totalKillersNeeded = Math.max(1, Math.floor(totalPlayers * this.config.killerRatio));
    const existingKillers = [...this.gods.values()].filter(g => g.isKiller).length;
    let npcKillers = Math.max(0, totalKillersNeeded - existingKillers);

    for (let i = 0; i < count; i++) {
      const name = NPC_NAMES[i % NPC_NAMES.length] + (i >= NPC_NAMES.length ? `-${Math.floor(i / NPC_NAMES.length) + 1}` : "");
      const look = NPC_LOOKS[i % NPC_LOOKS.length];
      const identity = NPC_IDENTITIES[i % NPC_IDENTITIES.length];
      const roomId = this.world.getRandomRoomId();
      const role = npcKillers > 0 ? "killer" : "crewmate";
      if (npcKillers > 0) npcKillers--;

      const agent = new Agent(name, look, identity, roomId, role);
      this.world.placeAgent(agent.id, roomId);
      this.agents.set(agent.id, agent);
    }

    // Recalculate total killers
    this.totalKillers = [...this.agents.values()].filter(a => a.role === "killer").length;
  }

  /** Start the main simulation */
  startSimulation(npcCount = 0): void {
    if (this.phase !== "setup") return;

    // Auto-generate default robots for gods who didn't define one
    for (const god of this.gods.values()) {
      if (!god.agentId) {
        this.defineRobot(god.id, `Robot-${god.id.slice(0, 4)}`, "🤖", "a robot on a spaceship");
      }
    }

    // Add NPC robots
    if (npcCount > 0) {
      this.addNPCs(npcCount);
    }

    this.setPhase("playing");
    this.simulationStartTick = this.tick;
    this.startHeartbeat();
  }

  stop(): void {
    this.running = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // ==================== HEARTBEAT ====================

  private startHeartbeat(): void {
    this.running = true;
    const msPerTick = 1000 / this.config.ticksPerSecond;

    this.tickInterval = setInterval(() => {
      if (!this.running) return;
      this.processTick();
    }, msPerTick);
  }

  private processTick(): void {
    this.tick++;

    switch (this.phase) {
      case "playing":
        this.tickPlaying();
        break;
      case "council":
        this.tickCouncil();
        break;
      case "vog":
        this.tickVoiceOfGod();
        break;
    }

    this.emit("tick", { tick: this.tick });
    this.callbacks.onTick?.(this.tick);
  }

  private tickPlaying(): void {
    // Clear stale speech bubbles after 5 ticks
    for (const agent of this.agents.values()) {
      if (agent.lastMessage && this.tick - agent.lastMessageTick > 5) {
        agent.lastMessage = undefined;
      }
    }

    const aliveAgents = this.getAliveAgents();

    // Schedule LLM operations for agents that need them
    for (const agent of aliveAgents) {
      if (agent.needsOperation()) {
        this.scheduleAgentOperation(agent);
      }
    }

    // Process completed actions
    for (const agent of aliveAgents) {
      this.processAgentActions(agent);
    }

    // Check if Voice of God round should start
    if (this.voiceOfGod.shouldStartRound(this.tick)) {
      this.startVoiceOfGodRound();
    }

    this.checkWinCondition();
  }

  private councilSpokeIds = new Set<AgentId>();

  private tickCouncil(): void {
    const aliveIds = this.getAliveAgents().map(a => a.id);
    const godAgentIds = new Set([...this.gods.values()].map(g => g.agentId).filter(Boolean));
    const session = this.council.getSession();

    // Phase 1: Each NPC speaks one line (deliberation)
    const allNpcSpoke = this.getAliveAgents()
      .filter(a => !godAgentIds.has(a.id))
      .every(a => this.councilSpokeIds.has(a.id));

    if (!allNpcSpoke) {
      for (const agent of this.getAliveAgents()) {
        if (godAgentIds.has(agent.id)) continue;
        if (this.councilSpokeIds.has(agent.id)) continue;
        if (agent.inProgressOperation) continue;
        this.scheduleCouncilSpeech(agent);
      }
      // Don't proceed to voting until all have spoken (or timer expires)
      if (!this.council.isExpired(this.tick)) return;
    }

    // Phase 2: NPCs vote
    for (const agent of this.getAliveAgents()) {
      if (godAgentIds.has(agent.id)) continue;
      if (session?.votes.has(agent.id)) continue;
      if (agent.inProgressOperation) continue;
      this.scheduleCouncilVote(agent);
    }

    if (this.council.isExpired(this.tick) || this.council.allVoted(aliveIds)) {
      const result = this.council.endCouncil(this.tick);

      if (result.ejected) {
        const ejectedAgent = this.agents.get(result.ejected);
        if (ejectedAgent) {
          ejectedAgent.eject();
          if (ejectedAgent.role === "killer") {
            this.killersFound++;
          }
          // Log ejection
          const wasKiller = ejectedAgent.role === "killer";
          this.ejectionLog.push({ name: ejectedAgent.name, wasKiller, tick: this.tick });
          // Notify all alive agents about the ejection
          for (const agent of this.getAliveAgents()) {
            const note = `${ejectedAgent.name} was ejected${wasKiller ? " (was a killer)" : " (was innocent)"}`;
            agent.beliefs = agent.beliefs ? `${agent.beliefs} | ${note}` : note;
          }
          this.emit("agent_ejected", { agentId: result.ejected, role: ejectedAgent.role });
        }
      } else {
        // No ejection — let agents know
        for (const agent of this.getAliveAgents()) {
          const note = "council ended with no ejection";
          agent.beliefs = agent.beliefs ? `${agent.beliefs} | ${note}` : note;
        }
      }

      this.callbacks.onCouncilEnded?.(result);
      this.setPhase("playing");
      this.checkWinCondition();
    }
  }

  private tickVoiceOfGod(): void {
    const vogPhase = this.voiceOfGod.getPhase(this.tick);

    if (vogPhase === "done") {
      const winner = this.voiceOfGod.endRound(this.tick);
      if (winner) {
        // Apply voice of god to ALL alive agents' beliefs
        for (const agent of this.getAliveAgents()) {
          agent.applyVoiceOfGod(winner.words);
        }
        this.callbacks.onVoiceOfGod?.(winner);
        this.emit("voice_of_god", winner);
      }
      this.setPhase("playing");
    }
  }

  // ==================== AGENT OPERATIONS ====================

  private scheduleAgentOperation(agent: Agent): void {
    if (agent.inProgressOperation) return;

    const op = agent.startOperation(this.tick);

    if (!this.llm) {
      this.fallbackBehavior(agent, op);
      return;
    }

    this.executeLLMOperation(agent, op);
  }

  private async executeLLMOperation(agent: Agent, op: AsyncOperation): Promise<void> {
    if (!this.llm) return;

    try {
      const room = this.world.getAgentRoom(agent.id);
      const roomName = room?.name || "Unknown";
      const nearbyIds = this.world.getNearbyAgents(agent.id);
      const nearbyNames = nearbyIds
        .map((id) => this.agents.get(id))
        .filter((a): a is Agent => a !== undefined && a.status === "alive")
        .map((a) => a.name);
      const connectedRooms = room ? this.world.getConnectedRooms(room.id).map((r) => r.name) : [];
      const recentMessages = room ? this.roomMessages.get(room.id) || [] : [];

      const context = agent.buildContext(nearbyNames, roomName, connectedRooms, recentMessages, this.phase);
      const prompt = this.buildActionPrompt(agent, context, nearbyIds);
      const response = await this.llm.generate(prompt);
      const action = this.parseAction(agent, response, nearbyIds);

      if (action) {
        agent.completeOperation(op, action);
      } else {
        agent.inProgressOperation = null;
      }
    } catch {
      agent.inProgressOperation = null;
    }
  }

  private fallbackBehavior(agent: Agent, op: NonNullable<Agent["inProgressOperation"]>): void {
    const nearbyIds = this.world.getNearbyAgents(agent.id);
    const room = this.world.getAgentRoom(agent.id);

    let action: AgentAction;

    if (agent.role === "killer" && agent.canKill(this.tick, this.config.killCooldownTicks, this.config.gracePeriodTicks, this.simulationStartTick) && nearbyIds.length === 1 && Math.random() < 0.3) {
      action = { type: "kill", agentId: agent.id, tick: this.tick, payload: { type: "kill", targetAgentId: nearbyIds[0] } };
    } else if (nearbyIds.length > 0 && Math.random() < 0.4) {
      const lines =
        agent.role === "killer"
          ? ["Everything seems fine.", "Nothing suspicious here.", "We should stick together."]
          : ["Did you hear something?", "I don't feel safe.", "Something doesn't add up..."];
      action = {
        type: "talk",
        agentId: agent.id,
        tick: this.tick,
        payload: { type: "talk", message: lines[Math.floor(Math.random() * lines.length)] },
      };
    } else if (room && room.connections.length > 0) {
      const targetRoomId = room.connections[Math.floor(Math.random() * room.connections.length)];
      action = { type: "move", agentId: agent.id, tick: this.tick, payload: { type: "move", targetRoomId } };
    } else {
      action = { type: "idle", agentId: agent.id, tick: this.tick, payload: { type: "idle" } };
    }

    agent.completeOperation(op, action);
  }

  // ==================== COUNCIL VOTING ====================

  private scheduleCouncilSpeech(agent: Agent): void {
    if (agent.inProgressOperation) return;
    const op = agent.startOperation(this.tick);

    if (!this.llm) {
      // Fallback: generic line
      agent.inProgressOperation = null;
      const line = agent.beliefs.includes("I saw")
        ? agent.beliefs.match(/I saw .+? kill .+/)?.[0] || "Something is wrong."
        : "I don't know who to trust.";
      this.council.addMessage(agent.id, line, this.tick);
      this.councilSpokeIds.add(agent.id);
      return;
    }

    this.executeLLMCouncilSpeech(agent, op);
  }

  private async executeLLMCouncilSpeech(agent: Agent, _op: AsyncOperation): Promise<void> {
    if (!this.llm) return;
    try {
      const alive = this.getAliveAgents().filter(a => a.id !== agent.id).map(a => a.name);
      const roleHint = agent.role === "killer"
        ? "You are the killer. Deflect suspicion. Blame someone else."
        : "You are innocent. Share what you know.";

      const prompt = `You are ${agent.name} in an emergency council. ${roleHint}
Your beliefs: ${agent.beliefs || "none"}
Other robots: ${alive.join(", ")}

Say ONE short sentence (under 15 words) to the council. Speak as dialogue.
Format: SAY: <your statement>`;

      const response = await this.llm.generate(prompt);
      agent.inProgressOperation = null;
      const match = response.match(/SAY:\s*(.+)/i);
      const line = match?.[1]?.trim() || "I have nothing to say.";
      this.council.addMessage(agent.id, line, this.tick);
      this.councilSpokeIds.add(agent.id);
    } catch {
      agent.inProgressOperation = null;
      this.council.addMessage(agent.id, "...", this.tick);
      this.councilSpokeIds.add(agent.id);
    }
  }

  private scheduleCouncilVote(agent: Agent): void {
    if (agent.inProgressOperation) return;

    const op = agent.startOperation(this.tick);

    if (!this.llm) {
      this.fallbackCouncilVote(agent, op);
      return;
    }

    this.executeLLMCouncilVote(agent, op);
  }

  private async executeLLMCouncilVote(agent: Agent, op: AsyncOperation): Promise<void> {
    if (!this.llm) return;

    try {
      const alive = this.getAliveAgents().filter(a => a.id !== agent.id);
      const names = alive.map(a => a.name);
      const prompt = this.buildCouncilVotePrompt(agent, names);
      const response = await this.llm.generate(prompt);
      agent.inProgressOperation = null;

      const voteMatch = response.match(/VOTE:\s*(.+)/i);
      const voteName = voteMatch?.[1]?.trim() || "skip";

      if (voteName.toLowerCase() === "skip") {
        this.council.castVote(agent.id, "skip");
      } else {
        const target = alive.find(a => a.name.toLowerCase().includes(voteName.toLowerCase()));
        if (target) {
          this.council.castVote(agent.id, target.id);
        } else {
          this.council.castVote(agent.id, "skip");
        }
      }
    } catch {
      agent.inProgressOperation = null;
      this.fallbackCouncilVote(agent, op);
    }
  }

  private fallbackCouncilVote(agent: Agent, op: AsyncOperation): void {
    agent.inProgressOperation = null;

    // Simple fallback: vote based on witness beliefs, otherwise skip
    const witnessMatch = agent.beliefs.match(/I saw (\w+) kill/);
    if (witnessMatch) {
      const suspect = this.getAliveAgents().find(a => a.name === witnessMatch[1] && a.id !== agent.id);
      if (suspect) {
        this.council.castVote(agent.id, suspect.id);
        return;
      }
    }
    this.council.castVote(agent.id, "skip");
  }

  private buildCouncilVotePrompt(agent: Agent, aliveNames: string[]): string {
    const roleInfo =
      agent.role === "killer"
        ? "You are a KILLER. Deflect suspicion. Vote to eject an innocent robot."
        : "You are a CREWMATE. Vote to eject whoever you think is the killer.";

    // Gather all room messages the agent has been exposed to
    const room = this.world.getAgentRoom(agent.id);
    const recentMessages = room ? this.roomMessages.get(room.id) || [] : [];
    const recentChat = recentMessages.length > 0
      ? `Things you heard recently:\n${recentMessages.slice(-8).map(m => `  ${m.fromName}: ${m.message}`).join("\n")}`
      : "";

    return `You are ${agent.name}. A council has been called to vote on ejecting a suspect.
${roleInfo}

Your beliefs: ${agent.beliefs || "none"}
${recentChat}

Alive robots: ${aliveNames.join(", ")}

Based on what you know — what you saw, what you heard, dead bodies you found — vote to eject one robot or skip.
Respond in EXACTLY this format: VOTE: <robot_name> or VOTE: skip`;
  }

  // ==================== ACTION PROCESSING ====================

  private processAgentActions(agent: Agent): void {
    if (agent.actionQueue.length === 0) return;

    const action = agent.actionQueue.shift()!;
    agent.currentAction = action.type;

    switch (action.type) {
      case "move":
        this.processMove(agent, action);
        break;
      case "talk":
        this.processTalk(agent, action);
        break;
      case "kill":
        this.processKill(agent, action);
        break;
      case "call_council":
        this.processCallCouncil(agent, action);
        break;
    }

    this.callbacks.onAgentAction?.(action);
    this.emit("agent_action", action);
  }

  private processMove(agent: Agent, action: AgentAction): void {
    const payload = action.payload as { type: "move"; targetRoomId: string };
    this.world.moveAgent(agent.id, payload.targetRoomId);
    agent.roomId = payload.targetRoomId;

    // Check for dead bodies in the new room
    const room = this.world.getRoom(payload.targetRoomId);
    if (room) {
      const deadInRoom = room.robots
        .map(id => this.agents.get(id))
        .filter((a): a is Agent => a !== undefined && a.status === "dead");
      for (const dead of deadInRoom) {
        const note = `I found ${dead.name}'s body in ${room.name}`;
        if (!agent.beliefs.includes(note)) {
          agent.beliefs = agent.beliefs ? `${agent.beliefs} | ${note}` : note;
        }
      }
    }
  }

  private processTalk(agent: Agent, action: AgentAction): void {
    const payload = action.payload as { type: "talk"; message: string };
    const room = this.world.getAgentRoom(agent.id);
    if (!room) return;

    agent.lastMessage = payload.message;
    agent.lastMessageTick = this.tick;
    agent.lastTalkTick = this.tick;

    // Add to room messages
    const msg: RoomMessage = {
      from: agent.id,
      fromName: agent.name,
      message: payload.message,
      tick: this.tick,
    };

    if (!this.roomMessages.has(room.id)) {
      this.roomMessages.set(room.id, []);
    }
    this.roomMessages.get(room.id)!.push(msg);

    // Also send via message bus
    this.messageBus.sendRoom(agent.id, room.id, `${agent.name}: ${payload.message}`, this.tick);
  }

  private processKill(agent: Agent, action: AgentAction): void {
    const payload = action.payload as { type: "kill"; targetAgentId: AgentId };
    if (agent.role !== "killer") return;

    const victim = this.agents.get(payload.targetAgentId);
    if (!victim || victim.status !== "alive") return;
    if (victim.roomId !== agent.roomId) return;

    victim.die();
    agent.lastKillTick = this.tick;
    this.killLog.push({ victimName: victim.name, killerName: agent.name, tick: this.tick });

    // Notify witnesses — other alive robots in the same room
    const witnessIds = this.world.getNearbyAgents(agent.id);
    for (const wId of witnessIds) {
      if (wId === victim.id) continue;
      const witness = this.agents.get(wId);
      if (!witness || witness.status !== "alive") continue;
      witness.beliefs = witness.beliefs
        ? `${witness.beliefs} | I saw ${agent.name} kill ${victim.name}!`
        : `I saw ${agent.name} kill ${victim.name}!`;
    }

    // Notify all alive agents that someone died (non-witnesses just know the death, not the killer)
    for (const other of this.getAliveAgents()) {
      if (other.id === agent.id) continue; // killer already knows
      const isWitness = witnessIds.includes(other.id);
      if (!isWitness) {
        const room = this.world.getAgentRoom(victim.id);
        const roomName = room?.name || "unknown";
        const note = `${victim.name} was found dead in ${roomName}`;
        if (!other.beliefs.includes(note)) {
          other.beliefs = other.beliefs ? `${other.beliefs} | ${note}` : note;
        }
      }
    }

    this.callbacks.onAgentDied?.(victim.id, agent.id);
    this.emit("agent_died", { victimId: victim.id, killerId: agent.id });
  }

  private processCallCouncil(agent: Agent, _action: AgentAction): void {
    if (!agent.canCallCouncil(this.tick)) return;
    if (!this.council.canCallCouncil(this.tick)) return;

    agent.lastCouncilCall = this.tick;
    this.council.startCouncil(agent.id, this.tick);
    this.setPhase("council");

    this.callbacks.onCouncilCalled?.(agent.id);
    this.emit("council_called", { agentId: agent.id });
  }

  // ==================== VOICE OF GOD ====================

  private startVoiceOfGodRound(): void {
    const godList = [...this.gods.values()];
    this.voiceOfGod.setTotalGods(godList.filter(g => g.connected).length);
    this.voiceOfGod.startRound(godList, this.tick);
    this.setPhase("vog");
  }

  // ==================== GOD INPUTS ====================

  /** Whisper of god — any god, any time, 3 words, to their robot */
  whisperToRobot(godId: GodId, words: string): boolean {
    const god = this.gods.get(godId);
    if (!god || !god.agentId) return false;

    if (words.trim().split(/\s+/).length > this.config.maxWords) return false;

    const agent = this.agents.get(god.agentId);
    if (!agent || agent.status !== "alive") return false;

    agent.applyWhisper(words.trim());

    const whisper: GodWhisper = {
      godId,
      targetRobotId: god.agentId,
      words: words.trim(),
      tick: this.tick,
    };
    this.recentWhispers.push(whisper);

    this.emit("god_whisper", whisper);
    return true;
  }

  /** God-triggered council call */
  callCouncilByGod(godId: GodId): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Not in playing phase" };
    if (!this.council.canCallCouncil(this.tick)) return { success: false, error: "Council on cooldown" };

    const god = this.gods.get(godId);
    if (!god || !god.agentId) return { success: false, error: "No robot assigned" };

    const agent = this.agents.get(god.agentId);
    if (!agent || agent.status !== "alive") return { success: false, error: "Robot is not alive" };

    this.council.startCouncil(agent.id, this.tick);
    this.setPhase("council");
    this.callbacks.onCouncilCalled?.(agent.id);
    this.emit("council_called", { agentId: agent.id });
    return { success: true };
  }

  submitVoiceOfGod(godId: GodId, words: string): boolean {
    return this.voiceOfGod.submitWords(godId, words, this.tick);
  }

  voteVoiceOfGod(godId: GodId, forGodId: GodId): boolean {
    return this.voiceOfGod.castVote(godId, forGodId);
  }

  voteInCouncil(godId: GodId, targetAgentId: AgentId | "skip"): boolean {
    const god = this.gods.get(godId);
    if (!god || !god.agentId) return false;
    return this.council.castVote(god.agentId, targetAgentId);
  }

  // ==================== WIN CONDITION ====================

  private checkWinCondition(): void {
    const alive = this.getAliveAgents();
    const aliveKillers = alive.filter((a) => a.role === "killer");
    const aliveCrew = alive.filter((a) => a.role === "crewmate");

    if (aliveKillers.length > aliveCrew.length && aliveKillers.length > 0) {
      this.winner = "killers";
      this.setPhase("ended");
      this.stop();
      this.generateNarrative();
      this.callbacks.onGameOver?.("killers");
      this.emit("game_over", { winner: "killers" });
      return;
    }

    if (aliveKillers.length === 0) {
      this.winner = "crew";
      this.setPhase("ended");
      this.stop();
      this.generateNarrative();
      this.callbacks.onGameOver?.("crew");
      this.emit("game_over", { winner: "crew" });
    }
  }

  // ==================== NARRATIVE ====================

  private narrative: string | null = null;

  private onNarrativeReady?: () => void;

  setNarrativeCallback(cb: () => void): void {
    this.onNarrativeReady = cb;
  }

  private async generateNarrative(): Promise<void> {
    if (!this.llm) {
      this.narrative = this.buildFallbackNarrative();
      return;
    }

    // Build a fallback immediately, then try LLM
    this.narrative = this.buildFallbackNarrative();

    try {
      const killLines = this.killLog.map(k => `Tick ${k.tick}: ${k.killerName} killed ${k.victimName}`).join("\n");
      const ejectionLines = this.ejectionLog.map(e => `Tick ${e.tick}: ${e.name} ejected (${e.wasKiller ? "killer" : "innocent"})`).join("\n");
      const killerNames = [...this.agents.values()].filter(a => a.role === "killer").map(a => a.name).join(", ");
      const survivors = this.getAliveAgents().map(a => a.name).join(", ");

      const prompt = `Write a 3-4 sentence dramatic narrative summary of this spaceship murder mystery game.
Winner: ${this.winner}
Killers: ${killerNames}
Survivors: ${survivors || "none"}
Events:
${killLines}
${ejectionLines}

Write it like a noir mystery recap. Be concise and dramatic.`;

      const response = await this.llm.generate(prompt);
      if (response.trim()) {
        this.narrative = response.trim();
        this.onNarrativeReady?.();
      }
    } catch {
      // Keep fallback
    }
  }

  private buildFallbackNarrative(): string {
    const killerNames = [...this.agents.values()].filter(a => a.role === "killer").map(a => a.name);
    const duration = this.tick - this.simulationStartTick;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    if (this.winner === "crew") {
      return `After ${mins}m ${secs}s of tension aboard the ship, the crew prevailed. ${killerNames.join(" and ")} ${killerNames.length === 1 ? "was" : "were"} identified and dealt with. ${this.killLog.length} robot${this.killLog.length !== 1 ? "s" : ""} fell before justice was served.`;
    }
    return `Darkness fell over the ship after ${mins}m ${secs}s. ${killerNames.join(" and ")} ${killerNames.length === 1 ? "proved" : "proved"} too cunning for the crew. ${this.killLog.length} robot${this.killLog.length !== 1 ? "s" : ""} were eliminated as the killer${killerNames.length > 1 ? "s" : ""} claimed victory.`;
  }

  // ==================== SNAPSHOT ====================

  getSnapshot(): GameState {
    const council = this.council.getSession();
    const vogRound = this.voiceOfGod.getRound();
    const vogPhase = vogRound ? this.voiceOfGod.getPhase(this.tick) : null;

    // Calculate countdown based on current phase
    let countdown = 0;
    if (this.phase === "council" && council) {
      countdown = Math.max(0, council.endTick - this.tick);
    } else if (this.phase === "vog" && vogRound) {
      if (vogPhase === "submission") countdown = Math.max(0, vogRound.submissionDeadline - this.tick);
      else if (vogPhase === "voting") countdown = Math.max(0, vogRound.voteDeadline - this.tick);
    }

    // Build room messages record
    const roomMsgs: Record<string, RoomMessage[]> = {};
    for (const [roomId, msgs] of this.roomMessages) {
      roomMsgs[roomId] = msgs.slice(-20); // last 20 messages per room
    }

    // Grace period remaining
    const gracePeriodRemaining = this.phase === "playing"
      ? Math.max(0, this.config.gracePeriodTicks - (this.tick - this.simulationStartTick))
      : 0;

    // Next VoG countdown (ticks until next round starts)
    const nextVogIn = this.phase === "playing"
      ? Math.max(0, this.config.voiceOfGodIntervalTicks - (this.tick - this.voiceOfGod.getLastRoundEnd()))
      : 0;

    return {
      phase: this.phase,
      tick: this.tick,
      rooms: this.world.getAllRooms(),
      robots: Object.fromEntries([...this.agents.values()].map((a) => [a.id, a.toRobot(this.phase === "ended")])),
      countdown,
      killersFound: this.killersFound,
      totalKillers: this.totalKillers,
      councilCooldown: Math.max(0, this.config.councilCooldownTicks - (this.tick - (council ? council.endTick : 0))),
      gracePeriodRemaining,
      nextVogIn,
      ejections: this.ejectionLog.length > 0 ? this.ejectionLog : undefined,
      llmStats: this.llm?.getStats ? (() => {
        const s = this.llm!.getStats!();
        return {
          requests: s.totalRequests,
          tokens: s.totalTokens,
          errors: s.errors,
          estimatedCost: s.totalTokens * 0.0000007, // ~$0.70/M tokens avg for Groq Llama 3.3 70B
        };
      })() : undefined,
      roomMessages: roomMsgs,
      summary: this.phase === "ended" && this.winner ? {
        winner: this.winner,
        duration: this.tick - this.simulationStartTick,
        kills: this.killLog,
        ejections: this.ejectionLog,
        survivors: [...this.agents.values()]
          .filter(a => a.status === "alive")
          .map(a => ({ name: a.name, role: a.role })),
        killers: [...this.agents.values()]
          .filter(a => a.role === "killer")
          .map(a => a.name),
        narrative: this.narrative ?? undefined,
        llmCost: this.llm?.getStats ? this.llm.getStats().totalTokens * 0.0000007 : 0,
      } : undefined,
      council: council?.active
        ? {
            messages: council.messages,
            votes: Object.fromEntries(council.votes),
          }
        : undefined,
      voiceOfGod:
        vogRound && vogPhase
          ? {
              selectedGods: vogRound.selectedGods,
              submissions: vogRound.submissions,
              phase: vogPhase === "done" ? "done" : vogPhase,
              winnerWords: vogRound.winner?.words,
            }
          : undefined,
    };
  }

  getAliveAgents(): Agent[] {
    return [...this.agents.values()].filter((a) => a.status === "alive");
  }

  getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  getCurrentTick(): number {
    return this.tick;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  // ==================== INTERNAL ====================

  private setPhase(phase: GamePhase): void {
    const old = this.phase;
    this.phase = phase;
    this.phaseStartTick = this.tick;
    if (phase === "council") this.councilSpokeIds.clear();
    this.callbacks.onPhaseChange?.(phase, this.tick);
    this.emit("phase_change", { from: old, to: phase, tick: this.tick });
  }

  private emit(type: EngineEventType, data: unknown): void {
    this.emitter.emit(type, { type, tick: this.tick, data });
  }

  // ==================== PROMPT BUILDING ====================

  private buildActionPrompt(agent: Agent, context: AgentContext, nearbyIds: AgentId[]): string {
    const roleInfo =
      agent.role === "killer"
        ? "You are a KILLER. Your goal: eliminate robots when alone with a target. Act normal around groups. Strike when isolated with one victim."
        : "You are a CREWMATE. Your goal: find the killer. Watch for suspicious behavior, discover bodies, call council with evidence.";

    const canKill = agent.role === "killer" && agent.canKill(this.tick, this.config.killCooldownTicks, this.config.gracePeriodTicks, this.simulationStartTick) && nearbyIds.length > 0;
    const canTalk = this.tick - agent.lastTalkTick >= 3;

    const actions = ["move <room_name>"];
    if (canTalk) actions.push("talk <short message>");
    if (canKill) actions.push("kill <robot_name>");
    if (agent.canCallCouncil(this.tick)) actions.push("call_council <reason>");
    actions.push("idle");

    // Show alive and dead robots in the room separately
    const room = this.world.getAgentRoom(agent.id);
    const roomAgentIds = room ? room.robots.filter(id => id !== agent.id) : [];
    const aliveNearby: string[] = [];
    const deadNearby: string[] = [];
    for (const id of roomAgentIds) {
      const a = this.agents.get(id);
      if (!a) continue;
      if (a.status === "alive") aliveNearby.push(a.name);
      else if (a.status === "dead") deadNearby.push(a.name);
    }

    // Show room populations to help robots spread out
    const roomInfo = this.world.getAllRooms().map(r => {
      const alive = r.robots.filter(id => { const a = this.agents.get(id); return a && a.status === "alive"; }).length;
      return `${r.name}: ${alive}`;
    }).join(", ");

    const recentChat =
      context.roomMessages.length > 0
        ? `Recent conversation:\n${context.roomMessages
            .slice(-3)
            .map((m) => `  ${m.fromName}: ${m.message}`)
            .join("\n")}`
        : "";

    const deadLine = deadNearby.length > 0
      ? `\nDead robots here: ${deadNearby.join(", ")}`
      : "";

    const killHint = canKill && aliveNearby.length === 1
      ? `\nYou are ALONE with ${aliveNearby[0]}. Now is your chance to kill.`
      : "";

    return `You are ${agent.name} on a spaceship. Someone is a killer.
${agent.identity}
${roleInfo}${killHint}

Location: ${context.roomName}
Nearby: ${aliveNearby.join(", ") || "alone"}${deadLine}
Rooms (population): ${roomInfo}
Beliefs: ${agent.beliefs || "none"}
${recentChat}
GUIDELINES:
- If nearby robots: TALK — say something out loud as dialogue. Keep under 10 words. Example: "I found a body in Medbay!" NOT "Ask WREN about HAZE".
- If you have evidence of a killer: CALL COUNCIL immediately.
- If alone or done talking: MOVE to a different room.
- call_council = all robots vote to eject a suspect.

Choose ONE: ${actions.join(" | ")}
Format: ACTION: <type> DETAIL: <detail>`;
  }

  private parseAction(agent: Agent, response: string, nearbyIds: AgentId[]): AgentAction | null {
    const actionMatch = response.match(/ACTION:\s*(\w+)/i);
    const detailMatch = response.match(/DETAIL:\s*(.+)/i);

    const actionType = actionMatch?.[1]?.toLowerCase() || "idle";
    const detail = detailMatch?.[1]?.trim() || "";

    switch (actionType) {
      case "move": {
        const rooms = this.world.getAllRooms();
        const targetRoom = rooms.find((r) => r.name.toLowerCase().includes(detail.toLowerCase()));
        if (!targetRoom) return null;
        return { type: "move", agentId: agent.id, tick: this.tick, payload: { type: "move", targetRoomId: targetRoom.id } };
      }
      case "talk":
        return { type: "talk", agentId: agent.id, tick: this.tick, payload: { type: "talk", message: detail || "Hello." } };
      case "kill": {
        const target =
          nearbyIds.find((id) => {
            const a = this.agents.get(id);
            return a && a.name.toLowerCase().includes(detail.toLowerCase());
          }) || nearbyIds[0];
        if (!target) return null;
        return { type: "kill", agentId: agent.id, tick: this.tick, payload: { type: "kill", targetAgentId: target } };
      }
      case "call_council":
        return {
          type: "call_council",
          agentId: agent.id,
          tick: this.tick,
          payload: { type: "call_council", reason: detail || "Something is wrong." },
        };
      default:
        return { type: "idle", agentId: agent.id, tick: this.tick, payload: { type: "idle" } };
    }
  }
}
