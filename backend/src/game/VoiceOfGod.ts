// ============================================================
// Voice of God — Collective divine intervention system
// Every minute: 10% of gods submit 3 words -> all vote -> broadcast
// ============================================================

import type {
  GodId, VoiceOfGodEntry, VoiceOfGodRound, GameConfig, God,
} from '../types/index.js';

export class VoiceOfGodManager {
  private currentRound: VoiceOfGodRound | null = null;
  private roundNumber = 0;
  private lastRoundEnd = -Infinity;

  constructor(private config: GameConfig) {}

  /** Should we start a new Voice of God round? */
  shouldStartRound(currentTick: number): boolean {
    if (this.currentRound) return false;
    return currentTick - this.lastRoundEnd >= this.config.voiceOfGodIntervalTicks;
  }

  /** Start a new round — select at least N gods or the configured percentage */
  startRound(gods: God[], currentTick: number): VoiceOfGodRound {
    this.roundNumber++;

    // Select either the minimum configured gods or the configured percentage, whichever is larger.
    const connectedGods = gods.filter(g => g.connected);
    const selectionCount = Math.min(
      connectedGods.length,
      Math.max(
        this.config.minVoiceOfGodSelections,
        Math.ceil(connectedGods.length * this.config.voiceOfGodSelectionRate),
      ),
    );

    const shuffled = [...connectedGods].sort(() => Math.random() - 0.5);
    const selectedGods = shuffled.slice(0, selectionCount).map(g => g.id);

    const round: VoiceOfGodRound = {
      roundNumber: this.roundNumber,
      selectedGods,
      submissions: [],
      votes: new Map(),
      submissionDeadline: currentTick + this.config.voiceOfGodSubmitTicks,
      voteDeadline: currentTick + this.config.voiceOfGodSubmitTicks + this.config.voiceOfGodVoteTicks,
    };

    this.currentRound = round;
    return round;
  }

  /** Submit 3 words from a selected god */
  submitWords(godId: GodId, words: string, tick: number): boolean {
    if (!this.currentRound) return false;
    if (!this.currentRound.selectedGods.includes(godId)) return false;
    if (tick > this.currentRound.submissionDeadline) return false;

    // Validate: max 3 words
    const wordCount = words.trim().split(/\s+/).length;
    if (wordCount > this.config.maxWords) return false;

    // Check if already submitted
    if (this.currentRound.submissions.some(s => s.godId === godId)) return false;

    this.currentRound.submissions.push({ godId, words: words.trim(), tick });
    return true;
  }

  /** Cast a vote for which submission to broadcast */
  castVote(voterId: GodId, forGodId: GodId): boolean {
    if (!this.currentRound) return false;
    if (!this.currentRound.submissions.some(s => s.godId === forGodId)) return false;

    this.currentRound.votes.set(voterId, forGodId);
    return true;
  }

  /** Check current phase of the round */
  getPhase(currentTick: number): 'submission' | 'voting' | 'done' | null {
    if (!this.currentRound) return null;

    if (currentTick <= this.currentRound.submissionDeadline) {
      // End submission early if all selected gods have submitted
      if (this.allSubmitted()) return this.shouldSkipVoting() ? 'done' : 'voting';
      return 'submission';
    }

    // If no submissions or only one, skip voting entirely
    if (this.shouldSkipVoting()) return 'done';

    if (currentTick <= this.currentRound.voteDeadline) {
      // End voting early if all gods have voted
      if (this.allVoted()) return 'done';
      return 'voting';
    }

    return 'done';
  }

  /** Check if voting should be skipped (0 or 1 submissions) */
  private shouldSkipVoting(): boolean {
    if (!this.currentRound) return true;
    return this.currentRound.submissions.length <= 1;
  }

  /** Check if all gods have voted — needs total god count passed in */
  allVoted(): boolean {
    if (!this.currentRound) return false;
    return this.currentRound.votes.size >= this.totalGods;
  }

  /** Set total god count for early vote completion */
  private totalGods = 0;
  setTotalGods(count: number): void {
    this.totalGods = count;
  }

  /** Tally votes and determine the winning Voice of God */
  resolveRound(): VoiceOfGodEntry | null {
    if (!this.currentRound) return null;
    if (this.currentRound.submissions.length === 0) return null;

    // Count votes
    const voteCounts = new Map<GodId, number>();
    for (const [, forGodId] of this.currentRound.votes) {
      voteCounts.set(forGodId, (voteCounts.get(forGodId) || 0) + 1);
    }

    // Find winner (most votes, random tiebreak)
    let maxVotes = 0;
    let winners: VoiceOfGodEntry[] = [];

    for (const submission of this.currentRound.submissions) {
      const votes = voteCounts.get(submission.godId) || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winners = [submission];
      } else if (votes === maxVotes) {
        winners.push(submission);
      }
    }

    // If no votes, pick a random submission
    if (winners.length === 0) {
      winners = [...this.currentRound.submissions];
    }

    // Random tiebreak
    const winner = winners[Math.floor(Math.random() * winners.length)];
    this.currentRound.winner = winner;

    return winner;
  }

  /** End the current round */
  endRound(currentTick: number): VoiceOfGodEntry | null {
    const winner = this.currentRound?.winner ?? this.resolveRound();
    this.currentRound = null;
    this.lastRoundEnd = currentTick;
    return winner;
  }

  /** Get current round state */
  getRound(): VoiceOfGodRound | null {
    return this.currentRound;
  }

  /** Get the tick of the last round end */
  getLastRoundEnd(): number {
    return this.lastRoundEnd;
  }

  /** Check if submission phase has all submissions */
  allSubmitted(): boolean {
    if (!this.currentRound) return false;
    return this.currentRound.submissions.length >= this.currentRound.selectedGods.length;
  }
}
