import { requestData } from './api'
import type { OverviewStats, PnlDataPoint, TradeStats, StrategyStats } from '@/types'

export const statsApi = {
  // 获取统计概览
  getOverview: () => requestData.get<OverviewStats>('/stats'),

  // 获取 PnL 曲线数据
  getPnlHistory: (days = 30) =>
    requestData.get<PnlDataPoint[]>('/stats/pnl', { days }),

  // 获取交易统计
  getTradeStats: () => requestData.get<TradeStats[]>('/stats/trades'),

  // 获取策略统计
  getStrategyStats: () => requestData.get<StrategyStats[]>('/stats/strategies'),
}
