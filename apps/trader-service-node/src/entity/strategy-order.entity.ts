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
import { Strategy as StrategyEntity } from './strategy.entity.js';
import type { Strategy } from './strategy.entity.js';
import { UserExchange as UserExchangeEntity } from './user-exchange.entity.js';
import type { UserExchange } from './user-exchange.entity.js';
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';

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

  @Column({ name: 'started_at', type: 'date', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'stopped_at', type: 'date', nullable: true })
  stoppedAt!: Date | null;

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

}
