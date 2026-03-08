import { Controller, Config, Get, Inject, Query } from '@midwayjs/core';
import axios from 'axios';
import { apiFail, apiOk } from '../util/api-response.js';
import { exchangeSync } from '../common/exchange-sync.js';
import { StrategyOrderService } from '../service/strategy-order.service.js';
import { OrderService } from '../service/order.service.js';
import { UserService } from '../service/user.service.js';
import type { Context } from '@midwayjs/koa';
import type { ExchangeAdapterConfig } from '../types/config.js';

@Controller('/api/v1/market')
export class MarketController {
  @Config('exchangeAdapter')
  exchangeAdapter!: ExchangeAdapterConfig;

  @Inject()
  ctx!: Context;

  @Inject()
  strategyOrderService?: StrategyOrderService;

  @Inject()
  orderService?: OrderService;

  @Inject()
  userService?: UserService;

  private async ensureSync() {
    await exchangeSync.init(this.exchangeAdapter);
  }

  /**
   * 代理获取历史 K 线数据 (从 exchange-sync 服务)
   */
  @Get('/candles')
  async getCandles(
    @Query('exchange') exchange: string,
    @Query('symbol') symbol: string,
    @Query('trade_type') tradeType?: string,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
    @Query('start_time') startTime?: string,
    @Query('end_time') endTime?: string,
    @Query('column') column?: string,
  ) {
    try {
      await this.ensureSync();
      const json = await exchangeSync.getCandles({
        exchange: exchange || 'binance',
        symbol: symbol || 'BTC-USDT',
        tradeType,
        period,
        limit,
        startTime,
        endTime,
        column,
      });
      if (json.code != 0) {
        return apiFail(json.message)
      }
      return apiOk(json.data);
    } catch (error: any) {
      return apiFail(axios.isAxiosError(error) && error.code === 'ECONNREFUSED'
        ? '无法连接到 exchange-sync 服务'
        : error.message || '获取 K 线数据失败');
    }
  }

  /**
   * 代理获取当前 K 线
   */
  @Get('/candle/current')
  async getCurrentCandle(
    @Query('exchange') exchange: string,
    @Query('symbol') symbol: string,
    @Query('trade_type') tradeType?: string,
    @Query('period') period?: string,
  ) {
    try {
      await this.ensureSync();
      const json = await exchangeSync.getCurrentCandle({
        exchange: exchange || 'binance',
        symbol: symbol || 'BTC-USDT',
        tradeType,
        period,
      });
      return apiOk(json.data);
    } catch (error: any) {
      return apiFail(axios.isAxiosError(error) && error.code === 'ECONNREFUSED'
        ? '无法连接到 exchange-sync 服务'
        : error.message || '获取当前 K 线失败');
    }
  }

  /**
   * 代理获取交易对列表 (从 exchange-sync 服务)
   */
  @Get('/symbols')
  async getSymbols(
    @Query('exchange') exchange: string,
    @Query('trade_type') tradeType?: string,
    @Query('symbol') symbol?: string,
    @Query('orderBy') orderBy?: string,
    @Query('order') order?: string,
  ) {
    try {
      await this.ensureSync();
      const json = await exchangeSync.getSymbols({
        exchange: exchange || 'binance',
        tradeType,
        symbol,
        orderBy,
        order,
      });
      if (json.code != 0) {
        return apiFail(json.message);
      }
      return apiOk(json.data);
    } catch (error: any) {
      return apiFail(axios.isAxiosError(error) && error.code === 'ECONNREFUSED'
        ? '无法连接到 exchange-sync 服务'
        : error.message || '获取交易对列表失败');
    }
  }

  /**
   * 代理获取交易所所有交易对的 tickers (从 exchange-sync 服务)
   * GET /api/v1/market/tickers?exchange=binance&trade_type=spot
   * 返回正在执行的策略/条件单数量
   */
  @Get('/tickers')
  async getTickers(
    @Query('exchange') exchange: string,
    @Query('trade_type') tradeType?: string,
  ) {
    try {
      await this.ensureSync();
      const data = await exchangeSync.getTickers(exchange || 'binance', tradeType);

      // Enrich tickers with running strategy/conditional counts
      try {
        if (this.strategyOrderService && this.orderService && this.userService && this.ctx?.state?.user) {
          const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
          
          // Get running strategy orders for this user
          const strategyResult = await this.strategyOrderService.listForUser(user.id, 1, 1000);
          const runningStrategies = strategyResult.data.filter(s => s.isRunning);
          
          // Build symbol -> count maps
          const strategyCountMap = new Map<string, number>();
          const strategyIdMap = new Map<string, number>();
          for (const order of runningStrategies) {
            for (const symbol of order.symbols) {
              strategyCountMap.set(symbol, (strategyCountMap.get(symbol) || 0) + 1);
              if (!strategyIdMap.has(symbol)) {
                strategyIdMap.set(symbol, order.id);
              }
            }
          }

          // Get open conditional orders count from DB
          const conditionalCountMap = new Map<string, number>();
          const openOrders = await this.orderService.listOpenStrategyOrders(user.id);
          for (const order of openOrders) {
            conditionalCountMap.set(order.symbol, (conditionalCountMap.get(order.symbol) || 0) + 1);
          }

          // Enrich tickers
          if (data?.tickers) {
            for (const ticker of data.tickers) {
              (ticker as any).runningStrategies = strategyCountMap.get(ticker.symbol) || 0;
              (ticker as any).runningStrategyId = strategyIdMap.get(ticker.symbol);
              (ticker as any).runningConditionals = conditionalCountMap.get(ticker.symbol) || 0;
            }
          }
        }
      } catch {
        // Non-critical: if enrichment fails, return tickers without counts
      }

      return apiOk(data);
    } catch (error: any) {
      return apiFail(error.message || '获取 tickers 失败');
    }
  }
}
