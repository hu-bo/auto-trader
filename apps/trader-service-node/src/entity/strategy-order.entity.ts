import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../util/id.js';
import { Strategy as StrategyEntity } from './strategy.entity.js';
import type { Strategy } from './strategy.entity.js';
import { UserExchange as UserExchangeEntity } from './user-exchange.entity.js';
import type { UserExchange } from './user-exchange.entity.js';
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';

@Entity('strategy_orders')
@Index(['userId'])
@Index(['strategyId'])
@Index(['exchangeId'])
export class StrategyOrder {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'strategy_id', type: 'varchar', length: 64 })
  strategyId!: string;

  @Column({ name: 'exchange_id', type: 'varchar', length: 64 })
  exchangeId!: string;

  @Column({ type: 'jsonb', default: [] })
  symbols!: string[];

  @Column({ type: 'jsonb', default: {} })
  parameters!: Record<string, unknown>;

  @Column({ name: 'risk_config', type: 'jsonb', default: {} })
  riskConfig!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  live!: boolean;

  @Column({ name: 'is_running', type: 'boolean', default: false })
  isRunning!: boolean;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'stopped_at', type: 'timestamptz', nullable: true })
  stoppedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, user => user.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => StrategyEntity, strategy => strategy.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'strategy_id' })
  strategy!: Strategy;

  @ManyToOne(() => UserExchangeEntity, exchange => exchange.strategyOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exchange_id' })
  exchange!: UserExchange;

  @BeforeInsert()
  beforeInsert() {
    if (!this.id) this.id = newId();
  }
}
