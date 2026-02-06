import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('signals')
@Index(['strategyId'])
@Index(['symbol'])
@Index(['exchange'])
@Index(['timestamp'])
export class Signal {
  @PrimaryGeneratedColumn('uuid', { name: 'signal_id' })
  signalId!: string;

  @Column({ name: 'strategy_id', type: 'varchar', length: 64 })
  strategyId!: string;

  @Column({ name: 'strategy_name', type: 'varchar', length: 64 })
  strategyName!: string;

  @Column({ type: 'varchar', length: 32 })
  exchange!: string;

  @Column({ name: 'trade_type', type: 'varchar', length: 16 })
  tradeType!: string;

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

