import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ExchangeType = 'okx' | 'binance';
export type AccountStatus = 'active' | 'inactive' | 'suspended';

@Entity('accounts')
@Index(['token'], { unique: true })
@Index(['exchange', 'status'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 20 })
  exchange!: ExchangeType;

  @Column({ type: 'varchar', length: 128 })
  apiKey!: string;

  @Column({ type: 'varchar', length: 256 })
  apiSecret!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  passphrase?: string;

  @Column({ type: 'boolean', default: false })
  demonet!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: AccountStatus;

  @Column({ type: 'varchar', length: 256, nullable: true })
  name?: string;

  @Column({ type: 'jsonb', nullable: true })
  riskConfig?: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
