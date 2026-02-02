export interface OverviewStats {
  totalPnl: number
  todayPnl: number
  weekPnl: number
  monthPnl: number
  totalTrades: number
  weekTrades: number
  monthTrades: number
  activeStrategies: number
  totalWinRate: number
  weekWinRate: number
  monthWinRate: number
  maxDrawdown: number
}

export interface PnlDataPoint {
  timestamp: number
  date: string
  pnl: number
  cumulativePnl: number
}

export interface TradeStats {
  symbol: string
  trades: number
  winRate: number
  pnl: number
  avgProfit: number
  avgLoss: number
}

export interface StrategyStats {
  strategyId: string
  strategyName: string
  trades: number
  winRate: number
  pnl: number
  sharpeRatio: number
  maxDrawdown: number
  runningTime: number
}
