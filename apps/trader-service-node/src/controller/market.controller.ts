import { Controller, Get, Query, Config } from '@midwayjs/core';
import axios from 'axios';
import { apiFail, apiOk } from '../util/api-response.js';
import { ExchangeAdapterConfig } from '../types/config.js';

const baseUrl = process.env.NODE_ENV === 'local' ? 'http://127.0.0.1:9100' : 'http://exchange-sync.8and1.cn';

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
    try {
      const resp = await axios.get(`${baseUrl}/api/candles`, {
        params: {
          exchange: exchange || 'binance',
          symbol: symbol || 'BTC-USDT',
          trade_type: tradeType,
          period,
          limit,
          start_time: startTime,
          end_time: endTime,
          column,
        },
        headers: {
          'X-API-Key': this.exchangeAdapter.apiKey
        },
        timeout: 10000,
      });
      const json = resp.data;
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
      const resp = await axios.get(`${baseUrl}/api/candle/current`, {
        params: {
          exchange: exchange || 'binance',
          symbol: symbol || 'BTC-USDT',
          trade_type: tradeType,
          period,
        },
        headers: {
          "X-API-Key": this.exchangeAdapter.apiKey
        },
        timeout: 10000,
      });
      const json = resp.data;
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
      const resp = await axios.get(`${baseUrl}/api/symbols`, {
        params: {
          exchange: exchange || 'binance',
          trade_type: tradeType,
          symbol,
          orderBy,
          order,
        },
        headers: {
          'X-API-Key': this.exchangeAdapter.apiKey,
        },
        timeout: 10000,
      });
      const json = resp.data;
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
   */
  @Get('/tickers')
  async getTickers(
    @Query('exchange') exchange: string,
    @Query('trade_type') tradeType?: string,
  ) {
    try {
      const url = `${baseUrl}/api/tickers`;
      console.log('Requesting:', url, { exchange: exchange || 'binance', trade_type: tradeType });
      
      const resp = await axios.get(url, {
        params: {
          exchange: exchange || 'binance',
          trade_type: tradeType,
        },
        headers: {
          'X-API-Key': this.exchangeAdapter.apiKey,
        },
        timeout: 10000, // 10秒超时
      });
      
      const json = resp.data;
      if (json.code != 0) {
        return apiFail(json.message);
      }
      return apiOk(json.data);
    } catch (error: any) {
      return apiFail(error.message || '获取 tickers 失败');
    }
  }
}
