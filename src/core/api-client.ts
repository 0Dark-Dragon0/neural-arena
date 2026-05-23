// ================================================================
// Neural Arena — API Client
// ================================================================
// OpenAI-compatible API client with timeout, retry, and backoff.
// Supports: OpenAI, OpenRouter, Groq, Together, Ollama, LM Studio,
//           NVIDIA API, and any OpenAI-compatible endpoint.
//
// CRITICAL FIX: Explicitly sets stream: false to prevent providers
// (like NVIDIA) from sending SSE chunks that hang response.json().
//
// API keys are NEVER logged or persisted.
// ================================================================

import { AgentConfig, ApiResponse, PromptPair, SimulationConfig } from './types';
import { Logger } from './logger';
import { PromptCompiler } from '../providers/PromptCompiler';
import { RequestTransformationPipeline } from '../providers/RequestTransformationPipeline';
import {
  ApiCallContext,
  CompatibilityDecision,
  ProviderCompatibilityObserver,
} from '../providers/ProviderAdapter';

export class ApiClient {
  private config: SimulationConfig;
  private logger: Logger;
  private promptCompiler: PromptCompiler;
  private transformationPipeline: RequestTransformationPipeline;
  private compatibilityObserver?: ProviderCompatibilityObserver;
  private demoAttempts: Record<string, number> = {};

  private isReasoningModel(model: string): boolean {
    const m = (model || '').toLowerCase();
    return (
      m.includes('deepseek-r1') ||
      m.includes('deepseek-reasoning') ||
      m.includes('glm-5') ||
      m.includes('glm-4-zero') ||
      m.includes('reasoning') ||
      m.includes('thinking') ||
      /\b(o1|o3)\b/.test(m)
    );
  }

  constructor(
    config: SimulationConfig,
    logger: Logger,
    compatibilityObserver?: ProviderCompatibilityObserver,
    promptCompiler: PromptCompiler = new PromptCompiler(),
    transformationPipeline: RequestTransformationPipeline = new RequestTransformationPipeline(),
  ) {
    this.config = config;
    this.logger = logger;
    this.compatibilityObserver = compatibilityObserver;
    this.promptCompiler = promptCompiler;
    this.transformationPipeline = transformationPipeline;
  }

  /**
   * Make a single API call to an agent's endpoint.
   * Enforces timeout at every stage (connect, headers, body read).
   */
  async call(agent: AgentConfig, prompt: PromptPair, context: ApiCallContext = {}): Promise<ApiResponse> {
    if (agent.apiKey === 'demo-key') {
      const startTime = Date.now();
      const elapsed = () => Date.now() - startTime;

      // 1. Retrieve legal moves and board FEN by parsing user prompt text
      const fenMatch = prompt.userPrompt.match(/Position \(FEN\):\s*([^\r\n]+)/i) || 
                       prompt.userPrompt.match(/World:\s*.*?FEN[:=]\s*([^\r\n]+)/i);
      const fen = fenMatch ? fenMatch[1].trim() : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      let legalMovesText = prompt.userPrompt;
      const legalMovesIndex = prompt.userPrompt.toUpperCase().indexOf("LEGAL MOVES");
      if (legalMovesIndex !== -1) {
        legalMovesText = prompt.userPrompt.slice(legalMovesIndex);
      }
      const legalMoves = Array.from(new Set(legalMovesText.match(/\b[a-h][1-8][a-h][1-8][qrbn]?\b/g) || []));

      // 2. Simulated thinking delay of 1.5 to 2.5 seconds
      const delay = 1500 + Math.random() * 1000;
      await this.sleep(delay);

      // Define legendary Opera Game moves
      const whiteMoves = [
        'e2e4', 'g1f3', 'd2d4', 'd4e5', 'd1f3', 'f1c4', 'f3b3', 'b1c3',
        'c1g5', 'c3b5', 'c4b5', 'e1c1', 'd1d7', 'h1d1', 'b5d7', 'b3b8', 'd1d8'
      ];
      const blackMoves = [
        'e7e5', 'd7d6', 'c8g4', 'g4f3', 'd6e5', 'g8f6', 'd8e7', 'c7c6',
        'b7b5', 'c6b5', 'b8d7', 'a8d8', 'd8d7', 'e7e6', 'f6d7', 'd7b8'
      ];

      const whiteThoughts = [
        `<think>\nAnalyzing initial board state. Establishing center control is paramount.\nOption A: 1. e4 (King's Pawn Opening) - leads to open games, rich tactical options.\nOption B: 1. d4 (Queen's Pawn Opening) - leads to positional, strategic games.\nSelecting Option A: 1. e4. This matches our aggressive playstyle profile.\nTarget Move: e2e4\n</think>`,
        `<think>\nBlack responded with 1... d6 (Philidor Defense). This is solid but passive.\nI should develop my knight to f3, attacking the e5 pawn and preparing kingside castling.\nEvaluating g1f3:\n- Controls e5 and d4 squares.\n- Puts pressure on Black's pawn chain.\nTarget Move: g1f3\n</think>`,
        `<think>\nBlack played 2... Bg4, pinning my knight on f3.\nThis is a premature bishop development. I should immediately strike in the center with d2d4.\nEvaluating d2d4:\n- Challenges Black's center pawn on e5.\n- Opens lines for my queen and dark-squared bishop.\nTarget Move: d2d4\n</think>`,
        `<think>\nBlack pinned my knight but my center strike d4e5 is highly active.\nIf Black captures my pawn: 4... dxe5 5. Qxd8+ Kxd8 6. Nxe5 - White wins a pawn and Black loses castling rights.\nIf Black captures my knight first: 4... Bxf3 5. Qxf3 dxe5 - White has bishop pair and active queen.\nPlaying: d4e5\nTarget Move: d4e5\n</think>`,
        `<think>\nBlack captured my knight: 4... Bxf3.\nI must recapture with my queen to keep active piece play.\nEvaluating d1f3 (Qxf3):\n- Recaptures the bishop.\n- Prevents structural damage to my kingside pawns.\n- Targets f7 square.\nTarget Move: d1f3\n</think>`,
        `<think>\nBlack recaptured: 5... dxe5.\nI have a lead in development. I should target the weak f7 square with my light-squared bishop.\nEvaluating f1c4:\n- Attacks f7.\n- Sets up immediate threats of checkmate (Qxf7#).\nTarget Move: f1c4\n</think>`,
        `<think>\nBlack defended f7 with 6... Nf6, leaving b7 undefended.\nI have a double attack: 7. Qb3.\nThis attacks both f7 (with Bishop) and b7 (with Queen).\nBlack will be forced to defend f7, leaving b7 vulnerable or vice versa.\nTarget Move: f3b3\n</think>`,
        `<think>\nBlack played 7... Qe7, defending f7 and offering a queen trade.\nI will decline the trade and develop my knight to c3, maintaining the pressure.\nEvaluating b1c3:\n- Develops the knight.\n- Controls d5 and e4 squares.\n- Prepares queenside castling or Nd5 jumps.\nTarget Move: b1c3\n</think>`,
        `<think>\nBlack played 8... c6, preventing Nd5 but weakening development.\nI should increase pressure by pinning the f6 knight.\nEvaluating c1g5:\n- Develops the dark-squared bishop.\n- Pins the knight on f6 to the queen on e7.\nTarget Move: c1g5\n</think>`,
        `<think>\nBlack played 9... b5, attacking my bishop on c4.\nI have a tactical opportunity. The d7 and b5 squares are weak.\nCan I sacrifice my knight on b5?\n10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O.\nYes, the attack on the pinned knight on d7 will be overwhelming.\nTarget Move: c3b5\n</think>`,
        `<think>\nBlack accepted the sacrifice: 10... cxb5.\nI must recapture with my bishop, delivering check and keeping the attack alive.\nEvaluating c4b5 (Bxb5+):\n- Delivers check.\n- Bishop is active on b5 pinning the knight on d7.\nTarget Move: c4b5\n</think>`,
        `<think>\nBlack blocked check with 11... Nbd7.\nMy king is still in the center. I should castle queenside to bring my rook to the d-file, increasing the pressure on the pinned d7 knight.\nEvaluating e1c1 (O-O-O):\n- Castles queenside.\n- Instantly activates the rook on the open d-file.\nTarget Move: e1c1\n</think>`,
        `<think>\nBlack played 12... Rd8 to defend the d7 knight.\nI should sacrifice the exchange on d7 to remove a defender and open lines.\nEvaluating d1d7 (Rxd7):\n- Captures the d7 knight.\n- Forces Black to recapture with their rook, leaving them pinned.\nTarget Move: d1d7\n</think>`,
        `<think>\nBlack recaptured: 13... Rxd7.\nI must bring my second rook to the d-file to renew the pin and attack.\nEvaluating h1d1:\n- Activates the h1 rook on the d-file.\n- The pin on d7 is now absolute.\nTarget Move: h1d1\n</think>`,
        `<think>\nBlack played 14... Qe6, trying to trade queens and escape.\nI will capture the rook on d7 with check.\nEvaluating b5d7 (Bxd7+):\n- Captures the rook.\n- Forces Black to respond with knight recapture, since King cannot escape.\nTarget Move: b5d7\n</think>`,
        `<think>\nBlack played 15... Nxd7.\nI have a spectacular queen sacrifice to force checkmate!\nEvaluating b3b8 (Qb8+):\n- Deflects the knight on d7 away from defending d8.\n- Forces 16... Nxb8.\nTarget Move: b3b8\n</think>`,
        `<think>\nBlack recaptured: 16... Nxb8.\nThe d8 square is now undefended. I deliver the final blow.\nEvaluating d1d8 (Rd8#):\n- Checkmate. The game is won.\nTarget Move: d1d8\n</think>`
      ];

      const blackThoughts = [
        `<think>\nWhite opened with 1. e4. I should respond classically to fight for center control.\nOption A: 1... e5 (Open game, mirrors White's space).\nOption B: 1... c5 (Sicilian Defense, fighting for asymmetry).\nSelecting Option A: 1... e5. Let's aim for a solid development.\nTarget Move: e7e5\n</think>`,
        `<think>\nWhite developed 2. Nf3, attacking my e5 pawn.\nI will defend the pawn with d7d6 (Philidor Defense). This is a solid, albeit slightly passive choice, keeping a tight center.\nTarget Move: d7d6\n</think>`,
        // On Black's 3rd turn (ply 6):
        // First attempt (illegal)
        `<think>\nWhite struck in the center with 3. d4.\nI must retaliate. Let's play e7e8 to put pressure on White's back rank.\nWait, is this valid? I will submit e7e8.\nTarget Move: e7e8\n</think>`,
        // Second attempt (retry)
        `<think>\nWait, e7e8 is illegal since the pawn cannot move backwards or leap to the 8th rank. The system rejected the move. I must adjust my tactical plan. Let's re-analyze the board state. White has played d2d4, establishing a strong center. I need to pin White's knight on f3 to weaken the pressure on d4. Playing c8g4 (Bg4) pin is the correct tactical response to continue development and challenge the center.\nTarget Move: c8g4\n</think>`,
        `<think>\nWhite captured my pawn on e5.\nMy e5 pawn is pinned if I capture back immediately. Instead, I should remove White's active knight on f3.\nEvaluating g4f3 (Bxf3):\n- Eliminates the f3 defender.\n- Forces White to recapture with the queen or ruin their pawn structure.\nTarget Move: g4f3\n</think>`,
        `<think>\nWhite recaptured with their queen (5. Qxf3).\nNow it is safe to recapture White's e5 pawn.\nEvaluating d6e5 (dxe5):\n- Restores material balance.\n- Re-establishes pawn presence in the center.\nTarget Move: d6e5\n</think>`,
        `<think>\nWhite played 6. Bc4, threatening mate on f7.\nI must defend f7. Developing my knight to f6 blocks the queen's line of sight to f7 or prepares castling.\nEvaluating g8f6:\n- Develops kingside knight.\n- Prepares castling.\nTarget Move: g8f6\n</think>`,
        `<think>\nWhite played 7. Qb3, attacking f7 and b7.\nI must defend f7. Playing Qe7 defends f7 and prepares to challenge White's active queen.\nEvaluating d8e7:\n- Defends f7.\n- Blocks the queen's check threats.\nTarget Move: d8e7\n</think>`,
        `<think>\nWhite played 8. Nc3.\nI need to solidify my queenside and prevent any Nd5 jumps by White.\nEvaluating c7c6:\n- Controls the d5 and b5 squares.\n- Prepares for b5 expansions.\nTarget Move: c7c6\n</think>`,
        `<think>\nWhite played 9. Bg5, pinning my knight.\nI should attack White's light-squared bishop with b7b5 to gain space and force it to move.\nEvaluating b7b5:\n- Expands on the queenside.\n- Forces bishop to make a decision.\nTarget Move: b7b5\n</think>`,
        `<think>\nWhite sacrificed a knight on b5: 10. Nxb5.\nI must accept the sacrifice to win material, since White's attack must be challenged.\nEvaluating c6b5 (cxb5):\n- Captures White's knight.\n- Challenging White's tactical calculation.\nTarget Move: c6b5\n</think>`,
        `<think>\nWhite checked me with 11. Bxb5+.\nI must block the check. Developing my knight to d7 is the only reasonable way.\nEvaluating b8d7:\n- Blocks the check.\n- Protects the king.\nTarget Move: b8d7\n</think>`,
        `<think>\nWhite castled queenside (12. O-O-O), activating their rook.\nMy d7 knight is pinned and under heavy attack. I must defend it with a8d8.\nEvaluating a8d8:\n- Adds a defender to the pinned d7 knight.\n- Prepares for central struggle.\nTarget Move: a8d8\n</think>`,
        `<think>\nWhite sacrificed a rook on d7: 13. Rxd7.\nI must recapture with my rook to prevent immediate material loss.\nEvaluating d8d7 (Rxd7):\n- Recaptures the rook on d7.\nTarget Move: d8d7\n</think>`,
        `<think>\nWhite brought their other rook to d1.\nMy rook on d7 is pinned and will be lost. I must offer a queen trade to relieve pressure.\nEvaluating e7e6 (Qe6):\n- Moves the queen out of lines of attack.\n- Proposes a queen exchange to simplify the game.\nTarget Move: e7e6\n</think>`,
        `<think>\nWhite captured my rook: 15. Bxd7+.\nI must recapture the bishop with my knight on f6.\nEvaluating f6d7 (Nxd7):\n- Recaptures the bishop.\n- Responds to the check.\nTarget Move: f6d7\n</think>`,
        `<think>\nWhite sacrificed their queen: 16. Qb8+!\nI have no choice but to capture the queen with my knight.\nEvaluating d7b8 (Nxb8):\n- Only legal move.\nTarget Move: d7b8\n</think>`
      ];

      const key = `${agent.index}_${context.turnNumber ?? 0}`;
      const attempt = (this.demoAttempts[key] || 0) + 1;
      this.demoAttempts[key] = attempt;

      let chosenMove = '';
      let thought = '';
      const moveIdx = agent.index === 0
        ? Math.floor(((context.turnNumber ?? 1) - 1) / 2)
        : Math.floor(((context.turnNumber ?? 2) - 1) / 2);

      if (agent.index === 0) {
        const targetMove = whiteMoves[moveIdx];
        if (targetMove && legalMoves.includes(targetMove)) {
          chosenMove = targetMove;
        }
        thought = whiteThoughts[moveIdx] || `<think>\nAnalyzing mid-to-end game positions.\nTarget Move: random\n</think>`;
      } else {
        if (moveIdx === 2) {
          // Black's 3rd turn (ply 6)
          if (attempt === 1) {
            chosenMove = 'e7e8'; // Illegal move
            thought = blackThoughts[2];
          } else {
            chosenMove = 'c8g4'; // Correct move
            thought = blackThoughts[3];
          }
        } else {
          // Adjust index because blackThoughts has two items for moveIdx === 2
          const thoughtIdx = moveIdx > 2 ? moveIdx + 1 : moveIdx;
          const targetMove = blackMoves[moveIdx];
          if (targetMove && legalMoves.includes(targetMove)) {
            chosenMove = targetMove;
          }
          thought = blackThoughts[thoughtIdx] || `<think>\nAnalyzing defense options.\nTarget Move: random\n</think>`;
        }
      }

      if ((!chosenMove || (agent.index === 1 && moveIdx === 2 && attempt === 1 ? false : !legalMoves.includes(chosenMove))) && legalMoves.length > 0) {
        chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }

      const content = `${thought}\n\n{\n  "move": "${chosenMove}"\n}`;
      const durationMs = delay;

      this.logger.info(`[DEMO MODE] Intercepted Agent ${agent.index} call for turn ${context.turnNumber}. Returning move: ${chosenMove} (attempt ${attempt})`);

      return {
        content,
        durationMs,
        tokensUsed: 150 + Math.floor(Math.random() * 80),
      };
    }

    const startTime = Date.now();
    const elapsed = () => Date.now() - startTime;

    const abstractPrompt = this.promptCompiler.compile(prompt, {
      agentIndex: context.agentIndex ?? agent.index,
      requestId: context.requestId,
      turnNumber: context.turnNumber,
      model: agent.model,
    });
    const providerRequest = this.transformationPipeline.transform(agent, abstractPrompt, this.config);
    const body = providerRequest.body;
    const url = this.normalizeUrl(agent.baseUrl);

    for (const decision of providerRequest.decisions) {
      this.recordCompatibilityDecision(agent, providerRequest.resolution.provider, decision, context);
    }

    const isReasoning = this.isReasoningModel(agent.model);
    const requestTimeoutMs = isReasoning
      ? Math.max(this.config.timeoutMs * 3, 360000)
      : this.config.timeoutMs;

    this.logger.debug('API request starting', {
      model: agent.model,
      url,
      maxTokens: this.config.maxTokens,
      timeoutMs: requestTimeoutMs,
      isReasoningModel: isReasoning,
      provider: providerRequest.resolution.provider,
      adapter: providerRequest.adapterName,
      capabilityRule: providerRequest.resolution.matchedRule,
      messageRoles: body.messages.map(message => message.role),
    });

    // Set up timeout via AbortController — covers the entire lifecycle
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      this.logger.warn(`Aborting request after ${requestTimeoutMs}ms`, {
        phase: 'timeout_trigger',
        elapsedMs: elapsed(),
      });
      controller.abort();
    }, requestTimeoutMs);

    try {
      // ── Phase 1: Send request, await response headers ──
      this.logger.debug('Sending HTTP request', { phase: 'fetch_start', elapsedMs: elapsed() });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agent.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      this.logger.debug('Response headers received', {
        phase: 'headers_received',
        elapsedMs: elapsed(),
        status: response.status,
        contentType: response.headers.get('content-type'),
      });

      // ── Phase 2: Check HTTP status ──
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unable to read error body');
        this.logger.debug('HTTP error response body', {
          phase: 'error_body',
          status: response.status,
          bodyPreview: errorBody.substring(0, 300),
        });
        const retryable = response.status === 429 || response.status >= 500;
        const err = new Error(`API error ${response.status}: ${errorBody.substring(0, 200)}`);
        (err as any).code = response.status;
        (err as any).retryable = retryable;
        throw err;
      }

      // ── Phase 3: Read response body ──
      // Check content-type to detect if provider is streaming despite stream:false
      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');

      if (isSSE) {
        this.logger.warn('Provider returned SSE stream despite stream:false, reading as text', {
          phase: 'sse_fallback',
          contentType,
        });
        // Read the SSE stream as text and extract the final content
        return await this.parseSSEResponse(response, startTime);
      }

      this.logger.debug('Reading response body as JSON', { phase: 'body_read_start', elapsedMs: elapsed() });

      const rawText = await response.text();

      this.logger.debug('Response body received', {
        phase: 'body_received',
        elapsedMs: elapsed(),
        bodyLength: rawText.length,
        bodyPreview: rawText.substring(0, 200),
      });

      // ── Phase 4: Parse JSON ──
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        this.logger.error('Failed to parse response as JSON', {
          phase: 'json_parse_error',
          bodyPreview: rawText.substring(0, 300),
          bodyLength: rawText.length,
        });
        const err = new Error(`Response is not valid JSON (${rawText.length} bytes)`);
        (err as any).retryable = true;
        throw err;
      }

      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const durationMs = elapsed();

      if (!content) {
        this.logger.warn('API returned empty content', {
          phase: 'empty_content',
          responseKeys: Object.keys(data),
          choicesLength: data?.choices?.length ?? 0,
          firstChoice: data?.choices?.[0] ? Object.keys(data.choices[0]) : 'none',
        });
        const err = new Error('API returned empty response content');
        (err as any).retryable = true;
        (err as any).code = 502; // Treat as bad gateway/provider error
        throw err;
      }

      this.logger.debug('API call complete', {
        phase: 'complete',
        durationMs,
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
        tokensUsed: data?.usage?.total_tokens,
      });

      clearTimeout(timeout);

      return {
        content,
        durationMs,
        tokensUsed: data?.usage?.total_tokens,
      };
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        const err = new Error(`API call timed out after ${requestTimeoutMs}ms (at ${elapsed()}ms)`);
        (err as any).code = 408;
        (err as any).retryable = true;
        throw err;
      }

      // Tag non-network errors as non-retryable if not already tagged
      if (error.retryable === undefined) {
        (error as any).retryable = false;
      }

      throw error;
    }
  }

  /**
   * Fallback SSE parser for providers that stream despite stream:false.
   * Reads all SSE chunks, extracts content from each, concatenates.
   */
  private async parseSSEResponse(response: Response, startTime: number): Promise<ApiResponse> {
    const rawText = await response.text();
    const elapsed = Date.now() - startTime;

    this.logger.debug('SSE raw response received', {
      phase: 'sse_raw',
      elapsedMs: elapsed,
      bodyLength: rawText.length,
      bodyPreview: rawText.substring(0, 300),
    });

    let fullContent = '';
    let tokensUsed: number | undefined;

    // Parse SSE format: lines starting with "data: " followed by JSON
    const lines = rawText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === '[DONE]') break;

      try {
        const chunk = JSON.parse(jsonStr);
        const delta = chunk?.choices?.[0]?.delta?.content ?? '';
        fullContent += delta;

        // Capture token usage from the last chunk
        if (chunk?.usage?.total_tokens) {
          tokensUsed = chunk.usage.total_tokens;
        }
      } catch {
        // Skip malformed SSE lines
        this.logger.debug('Skipping malformed SSE line', { line: trimmed.substring(0, 100) });
      }
    }

    this.logger.debug('SSE parsing complete', {
      phase: 'sse_complete',
      contentLength: fullContent.length,
      contentPreview: fullContent.substring(0, 100),
    });

    return {
      content: fullContent,
      durationMs: Date.now() - startTime,
      tokensUsed,
    };
  }

  /**
   * Normalize base URL to ensure it points to /v1/chat/completions.
   * Handles various formats users might provide.
   */
  private normalizeUrl(baseUrl: string): string {
    let url = baseUrl.replace(/\/+$/, '');

    // If already has the full path, use as-is
    if (url.endsWith('/chat/completions')) {
      return url;
    }

    // If has /v1 but not the rest
    if (url.endsWith('/v1')) {
      return url + '/chat/completions';
    }

    // Otherwise append full path
    return url + '/v1/chat/completions';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordCompatibilityDecision(
    agent: AgentConfig,
    provider: string,
    decision: CompatibilityDecision,
    context: ApiCallContext,
  ): void {
    const data = {
      ...decision.data,
      code: decision.code,
      message: decision.message,
      provider,
      model: agent.model,
      requestId: context.requestId,
      turnNumber: context.turnNumber,
      stateNodeId: context.stateNodeId,
      stateHash: context.stateHash,
    };

    if (decision.type === 'FALLBACK_ACTIVATED' || decision.type === 'UNSUPPORTED_FEATURE_HANDLED') {
      this.logger.warn(`Provider compatibility: ${decision.message}`, data);
    } else {
      this.logger.debug(`Provider compatibility: ${decision.message}`, data);
    }

    this.compatibilityObserver?.({
      type: decision.type,
      code: decision.code,
      message: decision.message,
      provider,
      model: agent.model,
      requestId: context.requestId,
      sourceEventId: context.sourceEventId,
      agentIndex: context.agentIndex ?? agent.index,
      turnNumber: context.turnNumber,
      stateNodeId: context.stateNodeId,
      stateHash: context.stateHash,
      data,
    });
  }
}
