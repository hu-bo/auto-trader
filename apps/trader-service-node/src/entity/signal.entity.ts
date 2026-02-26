import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Strategy } from './strategy.entity.js';

@Entity('signals')
@Index(['strategyId'])
@Index(['symbol'])
@Index(['exchange'])
@Index(['timestamp'])
export class Signal {
  @PrimaryGeneratedColumn({ name: 'signal_id', type: 'bigint' })
  signalId!: string;

  @Column({ name: 'strategy_id', type: 'varchar', length: 64 })
  strategyId!: string;
  
  @ManyToOne(() => Strategy, { createForeignKeyConstraints: false })
  strategy!: Strategy;

  @Column({ type: 'varchar', length: 32 })
  exchange!: string;

  @Column({ type: 'varchar', length: 64 })
  symbol!: string;

  @Column({ type: 'varchar', length: 16 })
  period!: string;

  @Column({ type: 'varchar', length: 16 })
  action!: string;

  @Column({ type: 'numeric', precision: 18, scale: 8 })
  price!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'timestamp' })
  timestamp!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

