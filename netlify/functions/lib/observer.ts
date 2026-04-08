import type { DebateAction } from './types.js';

export interface ObserverVerdict {
  allow: boolean;
  /** Injected into the turn message when allow=false, so agents see the reason. */
  reason: string;
}

export interface ObserverConfig {
  /**
   * Minimum number of turns that must occur before CONCLUDE or CONCEDE is permitted.
   * Set to 0 to disable enforcement. Recommended value: 6.
   */
  minTurns: number;
}

/**
 * Observer / moderator that gates premature debate termination.
 *
 * Rule-based only (no extra LLM call). The single responsibility is to veto
 * CONCLUDE or CONCEDE actions that occur before the configured minimum turns,
 * forcing the debate to continue. This is the primary structural fix for
 * sycophantic convergence: agents cannot agree early simply because it is
 * socially comfortable.
 */
export class Observer {
  private readonly minTurns: number;

  constructor(config: ObserverConfig) {
    this.minTurns = config.minTurns;
  }

  /**
   * Evaluate whether a terminal action (CONCLUDE or CONCEDE) should be permitted.
   *
   * @param action - The action the agent wants to take.
   * @param turnNumber - The current turn number (1-indexed).
   * @returns ObserverVerdict — allow=true if permitted, allow=false if overridden.
   */
  evaluateTermination(action: DebateAction, turnNumber: number): ObserverVerdict {
    if (this.minTurns === 0) {
      return { allow: true, reason: '' };
    }

    if (action === 'CONCLUDE' || action === 'CONCEDE') {
      if (turnNumber < this.minTurns) {
        return {
          allow: false,
          reason:
            `[Moderator: ${action} rejected — minimum ${this.minTurns} turns required before conclusion. ` +
            `Only ${turnNumber} have occurred. Continue with a new argument.]`,
        };
      }
    }

    return { allow: true, reason: '' };
  }
}
