import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../util/id.js';

@Entity('backtests')
@Index(['userId'])
@Index(['strategyId'])
@Index(['symbol'])
export class Backtest {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

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

  @BeforeInsert()
  beforeInsert() {
    if (!this.id) this.id = newId();
  }
}

