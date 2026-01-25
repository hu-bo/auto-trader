import { debugLogger, outLogger } from "../common/logger";
import EventEmitter from "events";
import { throttle } from "lodash";
import { OrderSide, PositionSide, numberInString } from "hquant";
import { AutoTradeType } from "./types";
import { getSpotSymbol } from "./util";
import { autoToFixed, keepDecimalFixed } from "../utils";
import { DeliveryTool } from "../exchange/binance/DeliveryTool";
import { Exchange } from "../constants/exchange";

export interface FuturesPosition {
  // 开仓均价
  entryPrice: numberInString;
  leverage?: numberInString;
  /**
   *  初始保证金
   */
  initialMargin?: numberInString;
  // 参考强平价格
  liquidationPrice?: numberInString;
  // 当前标记价格
  markPrice: numberInString;
  // 头寸数量，符号代表多空方向, 正数为多，负数为空
  positionAmt: numberInString;
  positionSide: PositionSide;
  symbol: string;
  // 仓位面值
  notional?: numberInString;
  // 持仓未实现盈亏
  unRealizedProfit?: numberInString;
  autoTradeType: AutoTradeType;
  exchange?: Exchange
}

export interface FuturesBalance {
  asset: string;
  // 余额
  balance: numberInString;
  // 全仓余额
  // crossWalletBalance?: numberInString;
  // 全仓持仓未实现盈亏
  crossUnPnl: numberInString;
  // 下单可用余额
  availableBalance: numberInString;
}

export interface RiskModelParams {
  stopLoss: number;
  stopProfit: number;
  positionLimit?: number;
  minLongTradeQuantity?: number;
  minShortTradeQuantity?: number;
}
interface EventMap {
  'order': (data: {
    quantity: number,
    side: OrderSide,
    positionSide: PositionSide,
    markPrice: number,
    type: string,
    symbol: string,
    unRealizedProfitRate: number,
    tradeType: AutoTradeType
  }) => void
}


export function getProfitByPosition(position: Omit<FuturesPosition, 'symbol' | 'autoTradeType'>): number {
  const markPrice = Number(position.markPrice);
  const positionAmt = Math.abs(Number(position.positionAmt));
  const entryPrice = Number(position.entryPrice);

  const diffPrice = (markPrice - entryPrice) * getDirection(position);
  const profit = diffPrice * (positionAmt);
  return profit;
}


const DIRECTION_MAP = {
  "LONG": 1,
  "SHORT": -1,
  "BUY_BOTH": 1,
  "SELL_BOTH": -1,
}

export function getDirection(position: Omit<FuturesPosition, 'symbol' | 'autoTradeType'>): 1 | -1 {
  return DIRECTION_MAP[`${position.positionSide}`]
}
export class RiskModel {
  private config: Record<string, RiskModelParams> = {};
  private eventEmitter: EventEmitter = new EventEmitter();
  positionsMap: Record<string, FuturesPosition[]> = {};
  balanceMap: {
    [key: string]: Record<string, FuturesBalance>;
  } = {
      'futures': {},
      'delivery': {}
    };

  constructor() {
    //
  }

  updateConfig(symbol: string, config: RiskModelParams) {
    if (this.config[symbol] === undefined) {
      this.config[symbol] = {} as any
    }
    Object.assign(this.config[symbol], config);
  }

  getBalance(symbol: string, tradeType: AutoTradeType) {
    if (this.balanceMap[tradeType][symbol]) {
      return this.balanceMap[tradeType][symbol];
    }
    return {
      asset: '',
      balance: 0,
      crossWalletBalance: 0,
      crossUnPnl: 0,
      availableBalance: 0,
    } as FuturesBalance
  }
  getWatchPostionCount(symbol: string, tradeType: AutoTradeType) {
    const key = `${tradeType}-${symbol}`
    if (tradeType === 'delivery') {
      for (const s in this.positionsMap) {
        if (Object.prototype.hasOwnProperty.call(this.positionsMap, s)) {
          const element = this.positionsMap[s];
          if (s.startsWith(symbol)) {
            return element.length;
          }
        }
      }
    }
    return this.positionsMap[key] ? this.positionsMap[key].length : 0;
  }
  updateBalance(listOrMap: FuturesBalance[] | Record<string, FuturesBalance>, tradeType: AutoTradeType) {
    if (Array.isArray(listOrMap)) {
      this.balanceMap[tradeType] = listOrMap.reduce((pre, cur) => {
        pre[cur.asset] = cur;
        return pre;
      }, {});
    } else {
      this.balanceMap[tradeType] = listOrMap
    }
    // outLogger.info('updateBalance', this.balanceMap['futures']['USDT'], this.balanceMap[`delivery`]["ETH"]);
  }
  clearSymbol(symbol: string, tradeType: AutoTradeType) {
    const key = `${tradeType}-${symbol}`
    this.positionsMap[key] = [];
  }
  updatePositions(params: {
    positions: (Omit<FuturesPosition, 'autoTradeType'>)[]
    exchange: Exchange
    symbol: string;
    tradeType: AutoTradeType
  }) {
    const symbolMap = params.positions.reduce((pre, cur) => {
      pre[cur.symbol] = {
        ...cur,
        exchange: params.exchange,
      };
      return pre;
    }, {} as Record<string, Omit<FuturesPosition, 'autoTradeType'>>);
    // 清空历史
    Object.keys(symbolMap).forEach(symbol => {
      this.clearSymbol(symbol, params.tradeType);
    });
    if (params.positions.length === 0) {
      this.clearSymbol(params.symbol, params.tradeType);
    }
    params.positions.forEach(item => {
      if (params.tradeType) {
        Object.assign(item, { autoTradeType: params.tradeType, exchange: params.exchange });
      }
      const key = `${params.tradeType}-${item.symbol}`
      this.positionsMap[key].push(item as FuturesPosition);
    });

    Object.keys(symbolMap).forEach(symbol => {
      this.checkFuturesPosition(symbol, params.tradeType);
    });
  }

  updatePositionsPrice = (symbol: string, tradeType: AutoTradeType, price: number) => {
    const key = `${tradeType}-${symbol}`

    if (this.positionsMap == null || this.positionsMap[key] === undefined) {
      return
    }
    const positions = this.positionsMap[key]
    positions.forEach(item => {
      item.markPrice = price;
    });

    this.checkFuturesPosition(symbol, tradeType);
  }
  private checkFuturesPosition(symbol: string, tradeType, config = {} as RiskModelParams & { positionSide?: PositionSide }) {
    const key = `${tradeType}-${symbol}`
    const positions = this.positionsMap[key];
    const balance = tradeType === 'futures' ? this.getBalance('USDT', tradeType) : this.getBalance(symbol, tradeType)
    //  || Number(balance.crossUnPnl) == 0

    if (!positions) {
      return
    }

    // accountAlias: 'FzSgsRXqTiXqAuTi',
    // asset: 'USDT',
    // balance: '2562.76486892',
    // crossWalletBalance: '2562.76486892', = 订单保证金 - 钱包维持保证金
    // crossUnPnl: '-44.87672376',
    // availableBalance: '2310.60010898',
    // maxWithdrawAmount: '2310.60010898',
    // marginAvailable: true,
    // updateTime: 1699766856087
    //  保证金余额 = 钱包余额 + 未实现盈亏
    const marginBalance = Number(balance.balance) + Number(balance.crossUnPnl)

    const { stopProfit, stopLoss } = config.stopLoss === undefined ? (this.config[getSpotSymbol(symbol)] || {}) : config;

    if (stopProfit == undefined) {
      return
    }
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const positionAmt = Math.abs(Number(position.positionAmt));

      if ((config.positionSide && config.positionSide != position.positionSide)
        || positionAmt === 0
      ) {
        if (positionAmt === 0) {
          positions.splice(i, 1);
          i--;
        }
        continue
      }
      if (position.positionSide === "BOTH") {
        outLogger.info(position);
        continue;
      }
      debugLogger(`Checking position: ${JSON.stringify(position)}`);
      const entryPrice = Number(position.entryPrice);
      let unRealizedProfit = 0;
      let notional = 0; // 仓位面值
      let margin = 0; // 保证金
      const direction = getDirection(position);
      const side: OrderSide = direction === 1 ? "SELL" : "BUY";
      const priceProfitRate = keepDecimalFixed(direction * (1 - (Number(position.entryPrice) / Number(position.markPrice))) * 100, 4);
      console.log(`positionAmt: ${positionAmt} entryPrice: ${entryPrice} markPrice: ${position.markPrice} direction: ${direction} priceProfitRate: ${priceProfitRate}`)
      // 起始保證金= 成交數量x 開倉價格x IMR
      // *初始保證金比率(IMR) = 1 / 槓桿
      const unRealizedProfitRate = position.unRealizedProfit
        ? (Number(position.unRealizedProfit) / Number(position.initialMargin))
        : direction * (1 - (Number(position.entryPrice) / Number(position.markPrice))) * Number(position.leverage); // 实际獲利率
      
      if (tradeType === 'futures') {

        notional = position.notional ? Number(position.notional) : positionAmt * Number(position.entryPrice)
        margin = position.initialMargin ? Number(position.initialMargin) : positionAmt * Number(position.entryPrice) / Number(position.leverage);
        unRealizedProfit = keepDecimalFixed(priceProfitRate / 100 * notional * direction);
      } else if (tradeType === 'delivery') {
        notional = DeliveryTool.calculationDeliveryNotional(position.symbol) * positionAmt;
        // 计算u的盈利
        unRealizedProfit = getProfitByPosition({
          ...position,
          positionAmt: DeliveryTool.countToBaseSymbolCount(position.symbol, position.entryPrice, positionAmt)
        });
        // 转成计量单位
        unRealizedProfit = unRealizedProfit / Number(position.markPrice)
      }

      position.unRealizedProfit = unRealizedProfit;
      (position as any).unRealizedProfitRate = unRealizedProfitRate;
      debugLogger(`[${position.autoTradeType}] unRealizedProfit: ${unRealizedProfit} unRealizedProfitRate: ${unRealizedProfitRate}, notional: ${notional} side: ${side}, positionAmt: ${positionAmt}, priceProfitRate: ${priceProfitRate}`);
      if (unRealizedProfitRate > 100) {
        return
      }

      const data = {
        type: '' as 'stopProfit' | 'stopLoss',
        tradeType: position.autoTradeType,
        side: side,
        positionSide: position.positionSide,
        quantity: positionAmt,
        unRealizedProfitRate: autoToFixed(unRealizedProfitRate),
        markPrice: Number(position.markPrice),
        symbol: symbol,
      }
      if (priceProfitRate > stopProfit) {
        outLogger.info(`${position.autoTradeType}: unRealizedProfit: ${unRealizedProfit} notional: ${notional} priceProfitRate: ${priceProfitRate} `)
        data.type = 'stopProfit';
        // outLogger.info(position);
        this.throttleEmitOrder(data);
        positions.splice(i, 1);
        i--;
      } else if (priceProfitRate < stopLoss) {
        outLogger.info(`${position.autoTradeType}: unRealizedProfit: ${unRealizedProfit} notional: ${notional} priceProfitRate: ${priceProfitRate}`)
        data.type = 'stopLoss';
        // outLogger.info(position)
        this.throttleEmitOrder(data);
        positions.splice(i, 1);
        i--;
      }
    }
  }
  on<E extends keyof EventMap>(event: E, callback: EventMap[E]) {
    this.eventEmitter.on(event, callback);
  }
  emit<E extends keyof EventMap>(event: E, ...params: Parameters<EventMap[E]>) {
    this.eventEmitter.emit(event, ...params);
  }
  /** 避免订单还未完成重复触发 */
  throttleEmitOrder = throttle((parmas: {
    type: 'stopProfit' | 'stopLoss';
    side: OrderSide;
    positionSide: PositionSide;
    quantity: number;
    unRealizedProfitRate: number;
    markPrice: number;
    symbol: string;
    tradeType: AutoTradeType;
  }) => {
    outLogger.info(`emitOrder -> ${JSON.stringify(parmas)}`);
    this.emit('order', parmas);
  }, 1000 * 60);

  destroy() {
    this.eventEmitter.removeAllListeners();
    this.positionsMap = null;
    this.balanceMap = null;
  }
}


