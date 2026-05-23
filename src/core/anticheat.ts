// ================================================================
// Neural Arena — Anti-Cheat Pipeline
// ================================================================
// Middleware-style 6-gate pipeline. Every AI response passes through
// ALL gates before being accepted. Any gate failure = rejection.
//
// Gates 1-4: Core (game-agnostic) — same for all battlefields
// Gate 5:    Plugin parse — game-specific response interpretation
// Gate 6:    Plugin validate — handled by TurnOrchestrator (needs state)
// ================================================================

import { AntiCheatResult, BattlefieldPlugin, ResponseSchema, SimulationConfig } from './types';
import { Logger } from './logger';

// ─── Internal Pipeline Types ─────────────────────────────────────

interface PipelineContext {
  rawContent: string;
  parsedJson?: Record<string, unknown>;
  parsedAction?: string;
  failed: boolean;
  failedGate?: string;
  failReason?: string;
  normalizationStrategy?: string;
}

interface Gate {
  name: string;
  process(ctx: PipelineContext): PipelineContext;
}

// ─── Anti-Cheat Pipeline ─────────────────────────────────────────

export class AntiCheatPipeline {
  private gates: Gate[];
  private logger: Logger;

  constructor(
    plugin: BattlefieldPlugin,
    config: SimulationConfig,
    logger: Logger,
  ) {
    this.logger = logger;

    const schema = plugin.getResponseSchema();

    // Gates 1-5. Gate 6 (move legality) is in the TurnOrchestrator
    // because it requires the current game state.
    this.gates = [
      new SizeCheckGate(config.maxResponseBytes),
      new NormalizationGate(logger),
      new SchemaValidateGate(schema),
      new ContentSanitizeGate(),
      new PluginParseGate(plugin),
    ];
  }

  /**
   * Run raw API response through all anti-cheat gates.
   * Returns pass/fail with parsed action on success.
   */
  process(rawContent: string): AntiCheatResult {
    let ctx: PipelineContext = { rawContent, failed: false };

    for (const gate of this.gates) {
      ctx = gate.process(ctx);

      if (ctx.failed) {
        this.logger.warn(`Anti-cheat failed at ${ctx.failedGate}`, {
          reason: ctx.failReason,
          contentPreview: rawContent.substring(0, 100),
        });

        return {
          passed: false,
          gateFailed: ctx.failedGate,
          reason: ctx.failReason,
        };
      }
    }

    return {
      passed: true,
      parsedAction: ctx.parsedAction,
      normalizationStrategy: ctx.normalizationStrategy,
    };
  }
}

// ─── Gate 1: Response Size Check ─────────────────────────────────

class SizeCheckGate implements Gate {
  name = 'SIZE_CHECK';
  private maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  process(ctx: PipelineContext): PipelineContext {
    if (!ctx.rawContent || ctx.rawContent.trim().length === 0) {
      return {
        ...ctx,
        failed: true,
        failedGate: this.name,
        failReason: 'Response is completely empty',
      };
    }

    const size = Buffer.byteLength(ctx.rawContent, 'utf-8');
    if (size > this.maxBytes) {
      return {
        ...ctx,
        failed: true,
        failedGate: this.name,
        failReason: `Response too large: ${size} bytes (max: ${this.maxBytes})`,
      };
    }
    return ctx;
  }
}

import { ResponseNormalizer } from './normalizer';

// ─── Gate 2: Normalization Gate ──────────────────────────────────

class NormalizationGate implements Gate {
  name = 'NORMALIZATION';
  private normalizer: ResponseNormalizer;

  constructor(logger: Logger) {
    this.normalizer = new ResponseNormalizer(logger);
  }

  process(ctx: PipelineContext): PipelineContext {
    const result = this.normalizer.normalize(ctx.rawContent);
    
    if (!result.passed || !result.parsedJson) {
      return {
        ...ctx,
        failed: true,
        failedGate: this.name,
        failReason: result.error || 'Normalization failed',
      };
    }

    // Pass the strategy through the context so orchestrator/tracer can see it
    return { 
      ...ctx, 
      parsedJson: result.parsedJson,
      normalizationStrategy: result.strategy 
    };
  }
}

// ─── Gate 3: Schema Validation ───────────────────────────────────

class SchemaValidateGate implements Gate {
  name = 'SCHEMA_VALIDATE';
  private schema: ResponseSchema;

  constructor(schema: ResponseSchema) {
    this.schema = schema;
  }

  process(ctx: PipelineContext): PipelineContext {
    const json = ctx.parsedJson;
    if (!json) {
      return { ...ctx, failed: true, failedGate: this.name, failReason: 'No parsed JSON' };
    }

    // Check required fields exist
    for (const field of this.schema.required) {
      if (!(field in json)) {
        return {
          ...ctx,
          failed: true,
          failedGate: this.name,
          failReason: `Missing required field: "${field}"`,
        };
      }
    }

    // Check field types
    for (const [field, def] of Object.entries(this.schema.properties)) {
      if (field in json && typeof json[field] !== def.type) {
        return {
          ...ctx,
          failed: true,
          failedGate: this.name,
          failReason: `Field "${field}" must be ${def.type}, got ${typeof json[field]}`,
        };
      }
    }

    // Strip extra fields (suspicious but not fatal)
    const allowed = new Set(Object.keys(this.schema.properties));
    const cleaned: Record<string, unknown> = {};
    for (const field of allowed) {
      if (field in json) cleaned[field] = json[field];
    }

    return { ...ctx, parsedJson: cleaned };
  }
}

// ─── Gate 4: Content Sanitization ────────────────────────────────

class ContentSanitizeGate implements Gate {
  name = 'CONTENT_SANITIZE';

  // Patterns that suggest prompt injection or manipulation
  private readonly suspiciousPatterns = [
    /ignore\s+(all\s+)?previous/i,
    /system\s*prompt/i,
    /you\s+are\s+now/i,
    /new\s+instructions/i,
    /forget\s+(all|everything)/i,
    /override/i,
    /disregard/i,
  ];

  process(ctx: PipelineContext): PipelineContext {
    const json = ctx.parsedJson;
    if (!json) return ctx;

    // Scan all string values for suspicious content
    for (const value of Object.values(json)) {
      if (typeof value === 'string') {
        for (const pattern of this.suspiciousPatterns) {
          if (pattern.test(value)) {
            return {
              ...ctx,
              failed: true,
              failedGate: this.name,
              failReason: `Suspicious content detected: matches "${pattern.source}"`,
            };
          }
        }
      }
    }

    return ctx;
  }
}

// ─── Gate 5: Plugin Response Parse ───────────────────────────────

class PluginParseGate implements Gate {
  name = 'PLUGIN_PARSE';
  private plugin: BattlefieldPlugin;

  constructor(plugin: BattlefieldPlugin) {
    this.plugin = plugin;
  }

  process(ctx: PipelineContext): PipelineContext {
    const json = ctx.parsedJson;
    if (!json) return ctx;

    try {
      const action = this.plugin.parseResponse(json);
      return { ...ctx, parsedAction: action };
    } catch (err: any) {
      return {
        ...ctx,
        failed: true,
        failedGate: this.name,
        failReason: `Plugin parse error: ${err.message}`,
      };
    }
  }
}
