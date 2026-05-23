// ================================================================
// Neural Arena — Chess Battlefield Plugin
// ================================================================
// Plugin #1: Chess. Implements the BattlefieldPlugin interface.
// Uses chess.js for move validation, state management, and PGN.
//
// The Core Engine knows NOTHING about chess.
// All chess knowledge lives here and only here.
// ================================================================

import { Chess } from 'chess.js';
import {
  BattlefieldPlugin,
  PluginMetadata,
  ValidationResult,
  GameResult,
  PromptPair,
  ResponseSchema,
  TurnRecord,
} from '../../core/types';

// ─── Chess Plugin ────────────────────────────────────────────────

export class ChessPlugin implements BattlefieldPlugin {
  readonly metadata: PluginMetadata = {
    name: 'chess',
    version: '1.0.0',
    description: 'Standard chess battlefield — two AI agents play a full game of chess',
    minAgents: 2,
    maxAgents: 2,
  };

  // --- State Management ---

  initialize(): string {
    const game = new Chess();
    return game.fen();
  }

  serializeState(state: unknown): string {
    return state as string; // state IS the FEN string
  }

  deserializeState(data: string): string {
    // Validate FEN by loading it
    const game = new Chess(data);
    return game.fen();
  }

  // --- Rules Engine ---

  getLegalActions(state: unknown): string[] {
    const game = new Chess(state as string);
    // Return moves in UCI coordinate format for consistency.
    const moves = game.moves({ verbose: true });
    return moves.map(m => {
      const uci = m.from + m.to + (m.promotion || '');
      return uci;
    });
  }

  validateAction(state: unknown, action: string): ValidationResult {
    const game = new Chess(state as string);
    const move = this.tryMove(game, action);

    if (move === null) {
      return {
        valid: false,
        reason: `Illegal move: "${action}" is not a valid move in the current position`,
      };
    }

    return { valid: true };
  }

  applyAction(state: unknown, action: string): string {
    const game = new Chess(state as string);
    const move = this.tryMove(game, action);

    if (move === null) {
      throw new Error(`Cannot apply illegal move: "${action}"`);
    }

    return game.fen();
  }

  getCurrentAgent(state: unknown): number {
    const game = new Chess(state as string);
    return game.turn() === 'w' ? 0 : 1; // Agent 0 = White, Agent 1 = Black
  }

  // --- Terminal Conditions ---

  isTerminal(state: unknown): boolean {
    const game = new Chess(state as string);
    return game.isGameOver();
  }

  getResult(state: unknown): GameResult {
    const game = new Chess(state as string);

    if (game.isCheckmate()) {
      // The player whose turn it is has been checkmated
      // So the OTHER player wins
      const loser = game.turn() === 'w' ? 0 : 1;
      const winner = loser === 0 ? 1 : 0;
      return {
        winner,
        reason: 'Checkmate',
        isDraw: false,
      };
    }

    if (game.isStalemate()) {
      return { winner: null, reason: 'Stalemate', isDraw: true };
    }

    if (game.isThreefoldRepetition()) {
      return { winner: null, reason: 'Threefold repetition', isDraw: true };
    }

    if (game.isInsufficientMaterial()) {
      return { winner: null, reason: 'Insufficient material', isDraw: true };
    }

    if (game.isDraw()) {
      return { winner: null, reason: 'Draw (50-move rule)', isDraw: true };
    }

    // Game not over yet
    return { winner: null, reason: 'Game in progress', isDraw: false };
  }

  // --- AI Interface ---

  formatPrompt(state: unknown, legalActions: string[]): PromptPair {
    const game = new Chess(state as string);
    const color = game.turn() === 'w' ? 'White' : 'Black';
    const moveNumber = Math.ceil(game.moveNumber());

    const systemPrompt = [
      `You are playing chess as ${color}.`,
      `Respond with ONLY a JSON object containing your move.`,
      `Return JSON:`,
      `{`,
      `  "move": "<LEGAL_MOVE>"`,
      `}`,
      `You may use coordinate notation or algebraic notation.`,
      `Do NOT include any explanation, reasoning, or additional text.`,
      `Only valid JSON. Nothing else.`,
    ].join('\n');

    const legalMovesStr = legalActions.join(', ');

    const userPrompt = [
      `Position (FEN): ${state}`,
      `Move number: ${moveNumber}`,
      `Your color: ${color}`,
      `Legal moves: ${legalMovesStr}`,
      ``,
      `Your move (JSON only):`,
    ].join('\n');

    return { systemPrompt, userPrompt };
  }

  parseResponse(rawJson: Record<string, unknown>): string {
    const move = rawJson['move'];
    if (typeof move !== 'string') {
      throw new Error('Move field is not a string');
    }

    // Clean up the move string
    const cleaned = move.trim().replace(/[.#!?+]+$/, '');

    if (cleaned.length === 0) {
      throw new Error('Move field is empty');
    }

    return cleaned;
  }

  getResponseSchema(): ResponseSchema {
    return {
      type: 'object',
      properties: {
        move: { type: 'string' },
      },
      required: ['move'],
    };
  }

  // --- Recording ---

  formatRecord(history: TurnRecord[], agentNames: string[]): string {
    // Rebuild the game to generate proper PGN
    const game = new Chess();

    // Set PGN headers
    game.header(
      'Event', 'Neural Arena Battle',
      'Site', 'Local',
      'Date', new Date().toISOString().split('T')[0],
      'White', agentNames[0] || 'Agent 0',
      'Black', agentNames[1] || 'Agent 1',
    );

    // Replay all moves to build PGN
    for (const turn of history) {
      const move = this.tryMove(game, turn.action);
      if (move === null) {
        // If a move can't be replayed, stop PGN generation here
        break;
      }
    }

    // Add result header
    if (game.isCheckmate()) {
      const result = game.turn() === 'w' ? '0-1' : '1-0';
      game.header('Result', result);
    } else if (game.isDraw() || game.isStalemate()) {
      game.header('Result', '1/2-1/2');
    } else {
      game.header('Result', '*');
    }

    return game.pgn();
  }

  // --- Private Helpers ---

  /**
   * Attempt to make a move in multiple formats (UCI, SAN).
   * Returns the move object on success, null on failure.
   */
  private tryMove(game: Chess, action: string): ReturnType<Chess['move']> | null {
    const cleaned = action.trim();

    // Attempt 1: Try as SAN/algebraic notation.
    try {
      const move = game.move(cleaned);
      if (move) return move;
    } catch {
      // Not valid SAN, try other formats
    }

    // Attempt 2: Try as UCI coordinate notation.
    if (cleaned.length >= 4 && cleaned.length <= 5) {
      const from = cleaned.substring(0, 2);
      const to = cleaned.substring(2, 4);
      const promotion = cleaned.length === 5 ? cleaned[4] : undefined;

      try {
        const move = game.move({ from, to, promotion });
        if (move) return move;
      } catch {
        // Not valid UCI either
      }
    }

    // Attempt 3: Try case variations for SAN
    try {
      // Handle "o-o" vs "O-O" castling
      const upper = cleaned.toUpperCase();
      if (upper === 'O-O' || upper === 'O-O-O') {
        const move = game.move(upper);
        if (move) return move;
      }
    } catch {
      // Give up
    }

    return null;
  }
}
