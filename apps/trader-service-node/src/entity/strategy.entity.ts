import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../util/id.js';
import { StrategyOrder } from './strategy-order.entity.js';
import { User as UserEntity } from './user.entity.js';
import type { User } from './user.entity.js';

@Entity('strategies')
@Index(['userId'])
export class Strategy {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 16, default: 'neutral' })
  tag!: string;

  @Column({ type: 'text', default: '' })
  code!: string;

  @Column({ type: 'jsonb', default: {} })
  params!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32, default: 'v1' })
  version!: string;

  @Column({ type: 'varchar', length: 16, default: 'inactive' })
  status!: string;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, user => user.strategies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => StrategyOrder, order => order.strategy)
  strategyOrders!: StrategyOrder[];

  @BeforeInsert()
  beforeInsert() {
    if (!this.id) this.id = newId();
  }
}
