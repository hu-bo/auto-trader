import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Strategy as StrategyEntity } from './strategy.entity.js';
import type { Strategy } from './strategy.entity.js';
import { UserExchange as UserExchangeEntity } from './user-exchange.entity.js';
import type { UserExchange } from './user-exchange.entity.js';
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';
import { RiskConfig as RiskConfigEntity } from './risk-config.entity.js';
import type { RiskConfig } from './risk-config.entity.js';

@Entity('strategy_orders')
@Index(['userid'])
@Index(['strategyId'])
@Index(['exchangeId'])
export class StrategyOrder {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'userid', type: 'int', default: 0 })
  userid!: number;

  @Column({ name: 'strategy_id', type: 'int' })
  strategyId!: number;

  @Column({ name: 'exchange_id', type: 'int' })
  exchangeId!: number;

  @Column({ name: 'trade_type', type: 'varchar', length: 32, default: 'spot' })
  tradeType!: string;

  @Column({ name: 'order_type', type: 'varchar', length: 32, default: 'limit' })
  orderType!: string;

  @Column({ type: 'int', default: 10 })
  leverage!: number;

  @Column({ name: 'buy_price_offset_percent', type: 'float', default: 1 })
  buyPriceOffsetPercent!: number;

  @Column({ name: 'sell_price_offset_percent', type: 'float', default: 1 })
  sellPriceOffsetPercent!: number;

  @Column({ name: 'stop_loss_percent', type: 'float', default: 2 })
  stopLossPercent!: number;

  @Column({ name: 'take_profit_percent', type: 'float', default: 5 })
  takeProfitPercent!: number;

  @Column({ type: 'jsonb', default: [] })
  symbols!: string[];

  @Column({ name: 'amount_buy', default: 0 })
  amountBuy!: number;

  @Column({ name: 'amount_sell', default: 0 })
  amountSell!: number;

  @Column({ name: 'amount_buy_long', default: 0 })
  amountBuyLong!: number;

  @Column({ name: 'amount_sell_long', default: 0 })
  amountSellLong!: number;

  @Column({ name: 'amount_buy_short', default: 0 })
  amountBuyShort!: number;

  @Column({ name: 'amount_sell_short', default: 0 })
  amountSellShort!: number;

  @Column({ type: 'boolean', default: false })
  live!: boolean;

  @Column({ name: 'is_running', type: 'boolean', default: false })
  isRunning!: boolean;
  
  @CreateDateColumn({ name: 'created_at', type: 'date' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'date' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userid' })
  user!: User;

  @ManyToOne(() => StrategyEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'strategy_id' })
  strategy!: Strategy;

  @ManyToOne(() => UserExchangeEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'exchange_id' })
  exchange!: UserExchange;

  @OneToOne(() => RiskConfigEntity, rc => rc.strategyOrder, { cascade: true, eager: false })
  riskConfig!: RiskConfig | null;

}
