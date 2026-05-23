// ================================================================
// Neural Arena — Response Normalizer
// ================================================================
// Intelligently recovers structured JSON from messy AI outputs.
// Runs BEFORE the AntiCheat schema validation.
// ================================================================

import { Logger } from './logger';

export interface NormalizationResult {
  passed: boolean;
  strategy?: string;
  parsedJson?: Record<string, unknown>;
  error?: string;
}

export class ResponseNormalizer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Attempt to extract and parse JSON from raw text using a waterfall of strategies.
   */
  normalize(rawContent: string): NormalizationResult {
    if (!rawContent) {
      return { passed: false, error: 'Empty content' };
    }

    // Strip reasoning / thought blocks (both closed and unclosed)
    let text = rawContent
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

    text = text
      .replace(/<think>[\s\S]*/gi, '')
      .replace(/<thought>[\s\S]*/gi, '')
      .replace(/<reasoning>[\s\S]*/gi, '')
      .trim();

    if (!text) {
      return { passed: false, error: 'Empty content' };
    }

    // Strategy 1: Direct Parse (Best Case)
    try {
      const parsed = JSON.parse(text);
      if (this.isValidObject(parsed)) {
        return { passed: true, strategy: 'DIRECT_PARSE', parsedJson: parsed };
      }
    } catch {}

    // Strategy 2: Markdown Code Fence Extraction
    const markdownResult = this.tryMarkdownExtraction(text);
    if (markdownResult) return markdownResult;

    // Strategy 3: Brace Extraction (Find first { and last })
    const braceResult = this.tryBraceExtraction(text);
    if (braceResult) return braceResult;

    // Strategy 4: Truncation Recovery (Missing closing braces/quotes)
    const truncationResult = this.tryTruncationRecovery(text);
    if (truncationResult) return truncationResult;

    // Strategy 5: Plain Text NLP Recovery (Fallback heuristic)
    const nlpResult = this.tryPlainTextRecovery(text);
    if (nlpResult) return nlpResult;

    return { passed: false, error: 'All normalization strategies failed' };
  }

  private isValidObject(parsed: any): boolean {
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  }

  private tryMarkdownExtraction(text: string): NormalizationResult | null {
    // Matches ```json ... ``` or just ``` ... ``` anywhere in the text
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = fenceRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (this.isValidObject(parsed)) {
          return { passed: true, strategy: 'MARKDOWN_EXTRACTION', parsedJson: parsed };
        }
      } catch {}
    }
    return null;
  }

  private tryBraceExtraction(text: string): NormalizationResult | null {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const substring = text.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(substring);
        if (this.isValidObject(parsed)) {
          return { passed: true, strategy: 'BRACE_EXTRACTION', parsedJson: parsed };
        }
      } catch {}
    }
    return null;
  }

  private tryTruncationRecovery(text: string): NormalizationResult | null {
    // If it started a JSON object but got cut off...
    const startIdx = text.indexOf('{');
    if (startIdx !== -1) {
      let substring = text.substring(startIdx).trim();
      
      // Attempt to force close it
      const attempts = [
        substring + '}',
        substring + '"}',
        substring + '"}',
        substring.replace(/,\s*$/, '') + '}', // remove trailing comma
      ];

      for (const attempt of attempts) {
        try {
          const parsed = JSON.parse(attempt);
          if (this.isValidObject(parsed)) {
            return { passed: true, strategy: 'TRUNCATION_RECOVERY', parsedJson: parsed };
          }
        } catch {}
      }
    }
    return null;
  }

  private tryPlainTextRecovery(text: string): NormalizationResult | null {
    // Chess-specific heuristic: Look for coordinate or algebraic notation in the text.
    // Note: This is a safe fallback because the AntiCheat Schema + Legality gates 
    // will strictly reject it if it's not a legal move anyway.
    
    // Very basic regex for UCI coordinate notation or SAN/algebraic notation.
    const moveRegex = /\b([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)\b/g;
    
    let match;
    let lastMatch = null;
    // Find the LAST matched move in the text (often they say "I considered X, but I play Y")
    while ((match = moveRegex.exec(text)) !== null) {
      lastMatch = match[1];
    }

    if (lastMatch) {
      return { 
        passed: true, 
        strategy: 'PLAIN_TEXT_RECOVERY', 
        parsedJson: { move: lastMatch } 
      };
    }

    return null;
  }
}
