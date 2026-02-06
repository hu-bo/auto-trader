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
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';

@Entity('backtests')
@Index(['userid'])
@Index(['strategyId'])
@Index(['symbol'])
export class Backtest {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'userid', type: 'int' })
  userid!: number;

  @Column({ name: 'strategy_id', type: 'varchar', length: 64 })
  strategyId!: string;

  @Column({ type: 'varchar', length: 64 })
  symbol!: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  @Column({ name: 'initial_capital', type: 'numeric', precision: 18, scale: 2 })
  initialCapital!: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  progress!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userid' })
  user!: User;
}
