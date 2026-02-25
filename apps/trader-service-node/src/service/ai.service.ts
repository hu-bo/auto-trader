import { Config, Provide } from '@midwayjs/core';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

interface AIConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface GenerateParams {
  message: string;
  codeContext?: string | null;
  systemPrompt?: string | null;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert HQuant DSL code generator. Generate ONLY valid HQuant DSL code, no explanations.

HQuant DSL Reference:
- Variables: LET var = value
- Conditions: IF condition THEN action
- Logic: AND, OR, NOT
- Actions: BUY, SELL, HOLD
- Indicators: SMA(field, period), EMA(field, period), RSI(period), MACD(fast, slow, signal), BOLL(period, k), STDDEV(field, period)
- Fields: open, high, low, close, volume, buy_volume
- Time refs: field@period (e.g. close@4h, close@1d)
- Vectors: VEC_STORE("name"), NORMALIZE(series, length, method="minmax"), SIMILARITY(store, vector, method="cosine", threshold=0.8)

Example - RSI strategy:
LET rsi = RSI(14)
IF rsi < 30 THEN BUY
IF rsi > 70 THEN SELL

Example - MACD strategy:
LET macd = MACD(12, 26, 9)
IF macd.hist > 0 AND macd.macd > macd.signal THEN BUY
IF macd.hist < 0 THEN SELL

Example - Moving Average Crossover:
LET ma_fast = EMA(close, 12)
LET ma_slow = EMA(close, 26)
IF ma_fast > ma_slow THEN BUY
IF ma_fast < ma_slow THEN SELL

Example - Bollinger Bands:
LET boll = BOLL(20, 2.0)
IF close < boll.lower THEN BUY
IF close > boll.upper THEN SELL

Output only valid HQuant DSL code.`;

@Provide()
export class AIService {
  @Config('ai')
  aiConfig!: AIConfig;

  async generateDSLStream(params: GenerateParams) {
    const provider = createOpenAI({
      baseURL: this.aiConfig.baseURL,
      apiKey: this.aiConfig.apiKey,
    });

    const systemContent = params.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    let userContent = params.message;
    if (params.codeContext) {
      userContent = `Current code in editor:\n\`\`\`\n${params.codeContext}\n\`\`\`\n\nRequest: ${params.message}`;
    }

    const result = streamText({
      model: provider(this.aiConfig.model),
      maxTokens: this.aiConfig.maxTokens,
      temperature: this.aiConfig.temperature,
      system: systemContent,
      messages: [
        { role: 'user', content: userContent },
      ],
    });

    return result;
  }
}
