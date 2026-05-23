// ================================================================
// Neural Arena — Battlefield Interface
// ================================================================
// The new Battlefield interface for the simulation engine.
// Plugins (like Chess) implement this to provide game-specific logic.
// ================================================================

import { PromptPair, GameResult, ValidationResult } from '../core/types';

export interface Battlefield {
  /** Initialize the game state */
  initialize(): any;
  
  /** Get legal actions for the current state */
  getLegalActions(state: any): string[];
  
  /** Apply an action to the state and return the new state */
  applyAction(state: any, action: string): any;

  /** Get the currently active agent if the battlefield controls turn order */
  getCurrentAgent?(state: any): number;
  
  /** Validate if an action is legal */
  validateAction(state: any, action: string): ValidationResult;
  
  /** Format a prompt for the cognitive agents */
  formatPrompt(state: any, legalActions: string[]): PromptPair;
  
  /** Check if the match is over */
  isTerminal(state: any): boolean;
  
  /** Get the match result (winner, reason) */
  getResult(state: any): GameResult;

  /** Serialize the state for observability */
  serializeState(state: any): any;
}
