import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StrategyOrder as StrategyOrderEntity } from './strategy-order.entity.js';
import type { StrategyOrder } from './strategy-order.entity.js';

@Entity('risk_configs')
@Index(['userid'])
@Index(['strategyOrderId'], { unique: true })
export class RiskConfig {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'userid', type: 'int', default: 0 })
  userid!: number;

  /** 预设名称（仅 strategy_order_id 为空时使用） */
  @Column({ type: 'varchar', length: 128, nullable: true })
  name!: string | null;

  @Column({ name: 'strategy_order_id', type: 'int', nullable: true })
  strategyOrderId!: number | null;

  /** 最大持仓 (USDT) */
  @Column({ name: 'max_position_size', type: 'numeric', precision: 36, scale: 18, nullable: true })
  maxPositionSize!: string | null;

  /** 日最大亏损 (USDT) */
  @Column({ name: 'max_daily_loss', type: 'numeric', precision: 36, scale: 18, nullable: true })
  maxDailyLoss!: string | null;

  /** 最大回撤 % */
  @Column({ name: 'max_drawdown', type: 'numeric', precision: 18, scale: 8, nullable: true })
  maxDrawdown!: string | null;

  /** 止损 % */
  @Column({ name: 'stop_loss_percent', type: 'numeric', precision: 18, scale: 8, nullable: true })
  stopLossPercent!: string | null;

  /** 止盈 % */
  @Column({ name: 'take_profit_percent', type: 'numeric', precision: 18, scale: 8, nullable: true })
  takeProfitPercent!: string | null;

  /** 最大杠杆 */
  @Column({ name: 'max_leverage', type: 'int', nullable: true })
  maxLeverage!: number | null;

  /** 额外扩展字段 */
  @Column({ type: 'jsonb', default: {} })
  extra!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => StrategyOrderEntity, order => order.riskConfig, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'strategy_order_id' })
  strategyOrder!: StrategyOrder | null;
}
