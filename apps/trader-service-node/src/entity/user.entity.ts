import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../util/id.js';
import { Strategy } from './strategy.entity.js';
import { StrategyOrder } from './strategy-order.entity.js';
import { UserExchange } from './user-exchange.entity.js';

@Entity('users') 
export class User {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'casdoor_id', type: 'varchar', length: 256, nullable: true, unique: true })
  casdoorId!: string | null;

  @Column({ type: 'varchar', length: 128, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 64, default: 'user' })
  role!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserExchange, exchange => exchange.user)
  exchanges!: UserExchange[];

  @OneToMany(() => Strategy, strategy => strategy.user)
  strategies!: Strategy[];

  @OneToMany(() => StrategyOrder, order => order.user)
  strategyOrders!: StrategyOrder[];

  @BeforeInsert()
  beforeInsert() {
    if (!this.id) this.id = newId();
  }
}

