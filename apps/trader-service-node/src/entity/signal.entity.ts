import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { newId } from '../util/id.js';

@Entity('signals')
@Index(['subscriptionId'])
@Index(['symbol'])
@Index(['timestamp'])
export class Signal {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'subscription_id', type: 'varchar', length: 64 })
  subscriptionId!: string;

  @Column({ type: 'varchar', length: 64 })
  symbol!: string;

  @Column({ type: 'varchar', length: 16 })
  action!: string;

  @Column({ type: 'numeric', precision: 18, scale: 8 })
  price!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'jsonb', default: {} })
  indicators!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @BeforeInsert()
  beforeInsert() {
    if (!this.id) this.id = newId();
  }
}

