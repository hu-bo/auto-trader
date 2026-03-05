import { requestData } from './api'
import type {
  Position,
  PositionQuery,
  ClosePositionParams,
  SetLeverageParams,
  AccountBalance,
  TradeType,
  PositionSide,
} from '@/types'

interface RawPosition {
  id: string
  exchange_id?: string
  symbol: string
  trade_type: string
  position_side: string
  position_amt: string
  entry_price: string
  mark_price: string
  liquidation_price: string
  leverage: number
  margin_mode: string
  unrealized_pnl: string
  realized_pnl: string
  margin: string
  last_sync_at: string
}

interface RawPositionListResponse {
  positions: RawPosition[]
  total?: number
}

interface PositionListResponse {
  positions: Position[]
  total: number
}

function mapPosition(raw: RawPosition): Position {
  const tradeTypeMap: Record<string, string> = {
    TRADE_TYPE_FUTURES: 'futures',
    TRADE_TYPE_SPOT: 'spot',
  }
  const sideMap: Record<string, string> = {
    POSITION_SIDE_LONG: 'long',
    POSITION_SIDE_SHORT: 'short',
    POSITION_SIDE_BOTH: 'both',
  }
  return {
    id: raw.id,
    exchangeId: raw.exchange_id ?? '',
    symbol: raw.symbol,
    tradeType: (tradeTypeMap[raw.trade_type] ?? raw.trade_type) as Position['tradeType'],
    positionSide: (sideMap[raw.position_side] ?? raw.position_side) as PositionSide,
    quantity: parseFloat(raw.position_amt) || 0,
    entryPrice: parseFloat(raw.entry_price) || 0,
    markPrice: parseFloat(raw.mark_price) || 0,
    liquidationPrice: raw.liquidation_price ? parseFloat(raw.liquidation_price) : null,
    leverage: raw.leverage,
    marginType: raw.margin_mode === 'cross' ? 'cross' : 'isolated',
    unrealizedPnl: parseFloat(raw.unrealized_pnl) || 0,
    realizedPnl: parseFloat(raw.realized_pnl) || 0,
    marginRatio: null,
    createdAt: raw.last_sync_at,
    updatedAt: raw.last_sync_at,
  }
}

async function mapPositionList(promise: Promise<RawPositionListResponse>): Promise<PositionListResponse> {
  const res = await promise
  return {
    positions: (res.positions ?? []).map(mapPosition),
    total: res.total ?? res.positions?.length ?? 0,
  }
}

export const positionApi = {
  // 获取持仓列表
  list: (params: PositionQuery) =>
    mapPositionList(requestData.get<RawPositionListResponse>('/positions', params as unknown as Record<string, unknown>)),

  // 同步持仓
  sync: (exchangeId: string) =>
    mapPositionList(requestData.post<RawPositionListResponse>('/positions/sync', { exchangeId })),

  // 平仓
  close: (positionId: string, params: ClosePositionParams) =>
    requestData.post<Position>(`/positions/${positionId}/close`, params),
}

export const accountApi = {
  // 获取账户余额
  getBalance: (exchangeId: string, tradeType: TradeType) =>
    requestData.get<AccountBalance>('/balance', { exchangeId, tradeType }),

  // 设置杠杆
  setLeverage: (params: SetLeverageParams) => requestData.post<unknown>('/leverage', params),
}
