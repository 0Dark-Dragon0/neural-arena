// ================================================================
// Neural Arena - Tactical Memory
// ================================================================
// Same-turn correction memory for cognitive agents. This memory is
// deterministic: it records simulation ticks, not wall-clock time.
// ================================================================

import type { CorrectionKind } from '../cognition/CognitiveCorrection';
import type { RuntimeFailureProfile } from '../cognition/ModelCapabilityRegistry';

export interface RejectedAttempt {
  action: string;
  reason: string;
  tick: number;
  requestId?: string;
  kind: CorrectionKind;
  count: number;
}

export interface RejectionRecordInput {
  action: string;
  reason: string;
  tick: number;
  requestId?: string;
  kind: CorrectionKind;
}

export interface CorrectionSummary {
  rejectedMoves: string[];
  repeatedMoves: string[];
  rejectionCount: number;
  repeatedIllegalMoves: number;
  illegalMoveFrequency: number;
  malformedJsonFailures: number;
  correctionAttempts: number;
  escalationLevel: number;
}

export class TacticalMemory {
  private rejectedAttempts: RejectedAttempt[] = [];
  private activeTurnNumber: number | null = null;
  private escalationLevel: number = 0;

  beginTurn(turnNumber: number): void {
    if (this.activeTurnNumber === turnNumber) return;
    this.activeTurnNumber = turnNumber;
    this.clear();
  }

  recordRejection(input: RejectionRecordInput): RejectedAttempt {
    const count = this.rejectedAttempts.filter(attempt => attempt.action === input.action).length + 1;
    const attempt: RejectedAttempt = Object.freeze({
      ...input,
      count,
    });

    this.rejectedAttempts.push(attempt);
    this.escalationLevel = this.calculateEscalationLevel();
    return attempt;
  }

  getRecentRejections(): RejectedAttempt[] {
    return [...this.rejectedAttempts];
  }

  clear(): void {
    this.rejectedAttempts = [];
    this.escalationLevel = 0;
  }

  getEscalationLevel(): number {
    return this.escalationLevel;
  }

  getCorrectionSummary(): CorrectionSummary {
    const rejectedMoves = [...new Set(this.rejectedAttempts.map(attempt => attempt.action))];
    const repeatedMoves = rejectedMoves.filter(move =>
      this.rejectedAttempts.filter(attempt => attempt.action === move).length > 1
    );
    const malformedJsonFailures = this.rejectedAttempts.filter(attempt => attempt.kind === 'MALFORMED_JSON').length;
    const repeatedIllegalMoves = repeatedMoves.length;
    const rejectionCount = this.rejectedAttempts.length;

    return Object.freeze({
      rejectedMoves,
      repeatedMoves,
      rejectionCount,
      repeatedIllegalMoves,
      illegalMoveFrequency: rejectionCount,
      malformedJsonFailures,
      correctionAttempts: rejectionCount,
      escalationLevel: this.escalationLevel,
    });
  }

  getRuntimeFailureProfile(): RuntimeFailureProfile {
    const summary = this.getCorrectionSummary();
    return {
      rejectionCount: summary.rejectionCount,
      repeatedIllegalMoves: summary.repeatedIllegalMoves,
      malformedJsonFailures: summary.malformedJsonFailures,
      correctionAttempts: summary.correctionAttempts,
    };
  }

  formatCorrectionBlock(escalationLevel: number = this.escalationLevel): string {
    if (this.rejectedAttempts.length === 0) return '';

    const lines: string[] = [
      'PREVIOUS FAILURE:',
    ];

    for (const attempt of this.rejectedAttempts) {
      const repeated = attempt.count > 1 ? ` repeated ${attempt.count} times` : '';
      lines.push(`- "${attempt.action}" is rejected${repeated}: ${attempt.reason}`);
    }

    lines.push('DO NOT repeat rejected moves.');
    lines.push('You MUST select ONLY from LEGAL MOVES.');

    if (escalationLevel >= 2) {
      lines.push('A move not listed under LEGAL MOVES is an immediate loss.');
    }

    if (escalationLevel >= 3) {
      lines.push('Ignore memory of earlier board positions. Use only the current LEGAL MOVES list.');
    }

    if (escalationLevel >= 4) {
      lines.push('Return exactly one listed move and no other content outside JSON.');
    }

    return lines.join('\n');
  }

  formatForPrompt(): string {
    const block = this.formatCorrectionBlock();
    return block ? `\n${block}\n` : '';
  }

  private calculateEscalationLevel(): number {
    if (this.rejectedAttempts.length === 0) return 0;

    const maxRepeat = Math.max(...this.rejectedAttempts.map(attempt => attempt.count));

    if (maxRepeat >= 4 || this.rejectedAttempts.length >= 5) return 4;
    if (maxRepeat >= 3 || this.rejectedAttempts.length >= 4) return 3;
    if (maxRepeat >= 2 || this.rejectedAttempts.length >= 2) return 2;
    return 1;
  }
}
