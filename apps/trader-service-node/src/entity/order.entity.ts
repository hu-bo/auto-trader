import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserExchange as UserExchangeEntity } from './user-exchange.entity.js';
import type { UserExchange } from './user-exchange.entity.js';
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';
import { Signal } from './signal.entity.js';

export enum OrderStatus {
  NEW = 'new',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('orders')
@Index(['userid'])
@Index(['exchangeId'])
@Index(['symbol'])
@Index(['status'])
@Index(['strategyOrderId'])
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  orderid!: string;

  @Column({ name: 'userid', type: 'int' })
  userid!: number;

  @Column({ name: 'exchange_id', type: 'int' })
  exchangeId!: number;

  /** 订单来源: manual = 手动下单, strategy = 策略信号触发 */
  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source!: string;

  /** 关联的策略订单 ID（仅 source=strategy 时有值） */
  @Column({ name: 'strategy_order_id', type: 'int', nullable: true })
  strategyOrderId!: number | null;

  /** 关联的信号 ID（仅 source=strategy 时有值） */
  @Column({ name: 'signal_id', type: 'uuid', nullable: true })
  signalId!: string | null;

  /** 交易所返回的订单 ID */
  @Column({ name: 'exchange_order_id', type: 'varchar', length: 128, nullable: true })
  exchangeOrderId!: string | null;

  /** 客户端自定义订单 ID */
  // @Column({ name: 'client_order_id', type: 'varchar', length: 128, nullable: true })
  // clientOrderId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  symbol!: string;

  /** spot / futures / delivery / usdm-algo */
  @Column({ name: 'trade_type', type: 'varchar', length: 32, default: 'spot' })
  tradeType!: string;

  /** buy / sell */
  @Column({ type: 'varchar', length: 16 })
  side!: string;

  /** market / limit / stop_market / stop_limit */
  @Column({ name: 'order_type', type: 'varchar', length: 32 })
  orderType!: string;

  @Column({ type: 'varchar', length: 32, default: OrderStatus.NEW })
  status!: OrderStatus;

  @Column({ type: 'numeric', precision: 36, scale: 18 })
  quantity!: string;

  /** 委托价格（市价单可为空） */
  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  price!: string | null;

  /** 已成交数量 */
  @Column({ name: 'filled_qty', type: 'numeric', precision: 36, scale: 18, default: '0' })
  filledQty!: string;

  /** 成交均价 */
  @Column({ name: 'avg_price', type: 'numeric', precision: 36, scale: 18, nullable: true })
  avgPrice!: string | null;

  /** 手续费 */
  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  fee!: string | null;

  /** 手续费币种 */
  @Column({ name: 'fee_asset', type: 'varchar', length: 32, nullable: true })
  feeAsset!: string | null;

  /** 持仓方向（合约专用）: long / short / both */
  @Column({ name: 'position_side', type: 'varchar', length: 16, nullable: true })
  positionSide!: string | null;

  /** 杠杆倍数（合约专用） */
  @Column({ type: 'int', nullable: true })
  leverage!: number | null;

  /** 是否只减仓 */
  @Column({ name: 'reduce_only', type: 'boolean', default: false })
  reduceOnly!: boolean;

  /** 成交时间 */
  @Column({ name: 'filled_at', type: 'timestamp', nullable: true })
  filledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  // ---- Relations ----

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userid' })
  user!: User;

  @ManyToOne(() => UserExchangeEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'exchange_id' })
  exchange!: UserExchange;

  @ManyToOne(() => Signal, { createForeignKeyConstraints: false })
  signal!: Signal | null;
}
