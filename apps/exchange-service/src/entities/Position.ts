import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type PositionSide = 'long' | 'short';
export type TradeType = 'spot' | 'futures' | 'delivery';
export type MarginMode = 'cross' | 'isolated';

@Entity('positions')
@Index(['accountId', 'symbol', 'tradeType', 'positionSide'], { unique: true })
@Index(['accountId'])
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'varchar', length: 20 })
  tradeType!: TradeType;

  @Column({ type: 'varchar', length: 10 })
  positionSide!: PositionSide;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  positionAmt!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  entryPrice!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  markPrice!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  unrealizedPnl!: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  realizedPnl!: string;

  @Column({ type: 'integer', default: 1 })
  leverage!: number;

  @Column({ type: 'varchar', length: 20, default: 'cross' })
  marginMode!: MarginMode;

  @Column({ type: 'decimal', precision: 24, scale: 8, nullable: true })
  liquidationPrice?: string;

  @Column({ type: 'decimal', precision: 24, scale: 8, default: '0' })
  margin!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;
}
