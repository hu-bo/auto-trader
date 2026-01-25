import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type OrderSide = 'buy' | 'sell';
export type PositionSide = 'long' | 'short';
export type OrderType = 'limit' | 'market' | 'maker-only';
export type TradeType = 'spot' | 'futures' | 'delivery';
export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partial'
  | 'filled'
  | 'canceled'
  | 'rejected'
  | 'expired';

@Entity('orders')
@Index(['accountId', 'status'])
@Index(['exchangeOrderId'], { unique: true, where: '"exchangeOrderId" IS NOT NULL' })
@Index(['clientOrderId'])
@Index(['symbol', 'tradeType'])
@Index(['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  exchangeOrderId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientOrderId?: string;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'varchar', length: 20 })
  tradeType!: TradeType;

  @Column({ type: 'varchar', length: 10 })
  side!: OrderSide;

  @Column({ type: 'varchar', length: 10, nullable: true })
  positionSide?: PositionSide;

  @Column({ type: 'varchar', length: 20 })
  orderType!: OrderType;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: OrderStatus;

  @Column({ type: 'decimal', precision: 24, scale: 8 })
  quantity!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, nullable: true })
  price?: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  filledQty!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, nullable: true })
  avgPrice?: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, nullable: true })
  fee?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  feeAsset?: string;

  @Column({ type: 'integer', nullable: true })
  leverage?: number;

  @Column({ type: 'boolean', default: false })
  reduceOnly!: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  filledAt?: Date;
}
