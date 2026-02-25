import { Body, Controller, Inject, Post } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { Readable } from 'node:stream';
import { AIService } from '../service/ai.service.js';
import { AIGenerateBodyDTO } from '../dto/ai.dto.js';

@Controller('/api/v1/ai')
export class AIController {
  @Inject()
  ctx!: Context;

  @Inject()
  aiService!: AIService;

  @Post('/generate')
  async generate(@Body() body: AIGenerateBodyDTO) {
    const result = await this.aiService.generateDSLStream({
      message: body.message,
      codeContext: body.codeContext,
      systemPrompt: body.systemPrompt,
    });

    this.ctx.set('Content-Type', 'text/event-stream');
    this.ctx.set('Cache-Control', 'no-cache');
    this.ctx.set('Connection', 'keep-alive');
    this.ctx.set('X-Accel-Buffering', 'no');

    this.ctx.body = Readable.from(result.textStream);
  }
}
