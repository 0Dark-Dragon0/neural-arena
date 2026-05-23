// ================================================================
// Neural Arena - Cognitive Correction
// ================================================================
// Converts runtime rejections into deterministic correction memory
// and escalation signals for subsequent prompt compilation.
// ================================================================

import { TacticalMemory } from '../agents/TacticalMemory';

export type CorrectionKind = 'ILLEGAL_MOVE' | 'REPEATED_MOVE' | 'MALFORMED_JSON' | 'HALLUCINATED_ACTION';

export interface RejectionInput {
  readonly action: string;
  readonly reason: string;
  readonly tick: number;
  readonly requestId?: string;
}

export interface CognitiveCorrectionResult {
  readonly correctionApplied: boolean;
  readonly kind: CorrectionKind;
  readonly rejectedMove: string;
  readonly repeatedMoveCount: number;
  readonly illegalMoveFrequency: number;
  readonly correctionAttempts: number;
  readonly previousEscalationLevel: number;
  readonly escalationLevel: number;
  readonly escalationChanged: boolean;
  readonly patternDetected: boolean;
  readonly correctionText: string;
}

export class CognitiveCorrection {
  applyRejection(memory: TacticalMemory, rejection: RejectionInput): CognitiveCorrectionResult {
    const kind = this.classify(rejection.action, rejection.reason);
    const previousEscalationLevel = memory.getEscalationLevel();
    const attempt = memory.recordRejection({
      action: rejection.action,
      reason: rejection.reason,
      tick: rejection.tick,
      requestId: rejection.requestId,
      kind,
    });
    const summary = memory.getCorrectionSummary();
    const escalationLevel = memory.getEscalationLevel();
    const patternDetected = attempt.count > 1 || summary.repeatedIllegalMoves > 0;

    return Object.freeze({
      correctionApplied: true,
      kind,
      rejectedMove: rejection.action,
      repeatedMoveCount: attempt.count,
      illegalMoveFrequency: summary.illegalMoveFrequency,
      correctionAttempts: summary.correctionAttempts,
      previousEscalationLevel,
      escalationLevel,
      escalationChanged: previousEscalationLevel !== escalationLevel,
      patternDetected,
      correctionText: this.buildCorrectionText(rejection.action, rejection.reason, attempt.count, escalationLevel),
    });
  }

  private classify(action: string, reason: string): CorrectionKind {
    const normalizedReason = reason.toLowerCase();
    const normalizedAction = action.toLowerCase();

    if (normalizedReason.includes('json') || normalizedAction === 'invalid_parse') {
      return 'MALFORMED_JSON';
    }

    if (normalizedReason.includes('repeat') || normalizedReason.includes('previously')) {
      return 'REPEATED_MOVE';
    }

    if (normalizedReason.includes('illegal') || normalizedReason.includes('invalid') || normalizedReason.includes('not a valid')) {
      return 'ILLEGAL_MOVE';
    }

    return 'HALLUCINATED_ACTION';
  }

  private buildCorrectionText(action: string, reason: string, count: number, escalationLevel: number): string {
    const prefix = count > 1
      ? `The rejected move "${action}" has been repeated ${count} times.`
      : `The rejected move "${action}" failed.`;

    return [
      'PREVIOUS FAILURE:',
      `${prefix} Reason: ${reason}`,
      'Do not repeat rejected moves.',
      escalationLevel >= 3 ? 'Select only from the current LEGAL MOVES list.' : 'Choose a legal move for the current position.',
    ].join('\n');
  }
}
