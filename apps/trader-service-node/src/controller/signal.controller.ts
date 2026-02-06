import { Controller, Get, Post, Body, Query, Inject, Param } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';
import { SignalService } from '../service/signal.service.js';
import { SubscribeSignalDTO, SignalQueryDTO } from '../dto/signal.dto.js';

@Controller('/api/v1/signals')
export class SignalController {
  @Inject()
  signalService!: SignalService;

  @Get('/')
  async listSignals(@Query() query: SignalQueryDTO) {
    const result = await this.signalService.listSignals(
      query.page || 1,
      query.limit || 50
    );
    return apiOk(result);
  }

  @Get('/symbol/:symbol')
  async getSignalsBySymbol(
    @Param('symbol') symbol: string,
    @Query() query: SignalQueryDTO
  ) {
    const signals = await this.signalService.getSignalsBySymbol(
      symbol,
      query.limit || 50
    );
    return apiOk(signals);
  }

  @Get('/strategy/:strategyId')
  async getSignalsByStrategy(
    @Param('strategyId') strategyId: string,
    @Query() query: SignalQueryDTO
  ) {
    const signals = await this.signalService.getSignalsByStrategy(
      strategyId,
      query.limit || 50
    );
    return apiOk(signals);
  }

  @Get('/exchange/:exchange/symbol/:symbol')
  async getSignalsByExchangeAndSymbol(
    @Param('exchange') exchange: string,
    @Param('symbol') symbol: string,
    @Query() query: SignalQueryDTO
  ) {
    const signals = await this.signalService.getSignalsByExchangeAndSymbol(
      exchange,
      symbol,
      query.limit || 50
    );
    return apiOk(signals);
  }

  @Get('/latest/:exchange/:symbol')
  async getLatestSignal(
    @Param('exchange') exchange: string,
    @Param('symbol') symbol: string
  ) {
    const signal = await this.signalService.getLatestSignal(exchange, symbol);
    return apiOk(signal);
  }

  @Post('/subscribe')
  async subscribe(@Body() body: SubscribeSignalDTO) {
    await this.signalService.subscribe(
      body.exchange,
      body.tradeType,
      body.symbol
    );
    return apiOk({ message: 'Subscribed successfully' });
  }

  @Post('/unsubscribe')
  async unsubscribe(@Body() body: SubscribeSignalDTO) {
    await this.signalService.unsubscribe(
      body.exchange,
      body.tradeType,
      body.symbol
    );
    return apiOk({ message: 'Unsubscribed successfully' });
  }

  @Get('/subscriptions')
  async getSubscriptions() {
    const subscriptions = this.signalService.getActiveSubscriptions();
    return apiOk(subscriptions);
  }
}

