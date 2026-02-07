import { Controller, Get, Query, Config } from '@midwayjs/core';
import { apiFail, apiOk } from '../util/api-response.js';
import { ExchangeAdapterConfig } from '../types/config.js';

const baseUrl = 'http://exchange-sync.8and1.cn';

@Controller('/api/v1/market')
export class MarketController {
  @Config('exchangeAdapter')
   exchangeAdapter!: ExchangeAdapterConfig;

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
    const params = new URLSearchParams();
    params.set('exchange', exchange || 'binance');
    params.set('symbol', symbol || 'BTC-USDT');
    if (tradeType) params.set('trade_type', tradeType);
    if (period) params.set('period', period);
    if (limit) params.set('limit', limit);
    if (startTime) params.set('start_time', startTime);
    if (endTime) params.set('end_time', endTime);
    if (column) params.set('column', column);


    const url = `${baseUrl}/api/candles?${params.toString()}`;

    const resp = await fetch(url, {
      headers: {
        'X-API-Key': this.exchangeAdapter.apiKey
      }
    });
    const json = await resp.json();
    if (json.code != 0) {
      return apiFail(json.message)
    }
    return apiOk(json.data);
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
    const params = new URLSearchParams();
    params.set('exchange', exchange || 'binance');
    params.set('symbol', symbol || 'BTC-USDT');
    if (tradeType) params.set('trade_type', tradeType);
    if (period) params.set('period', period);
    const url = `${baseUrl}/api/candle/current?${params.toString()}`;

    const resp = await fetch(url, {
      headers: {
        "X-API-Key": this.exchangeAdapter.apiKey
      }
    });
    const json = await resp.json();
    console.log(json.data)
    return apiOk(json.data);
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
    const params = new URLSearchParams();
    params.set('exchange', exchange || 'binance');
    if (tradeType) params.set('trade_type', tradeType);
    if (symbol) params.set('symbol', symbol);
    if (orderBy) params.set('orderBy', orderBy);
    if (order) params.set('order', order);

    const url = `${baseUrl}/api/symbols?${params.toString()}`;

    const resp = await fetch(url, {
      headers: {
        'X-API-Key': this.exchangeAdapter.apiKey,
      },
    });
    const json = await resp.json();
    if (json.code != 0) {
      return apiFail(json.message);
    }
    return apiOk(json.data);
  }
}
