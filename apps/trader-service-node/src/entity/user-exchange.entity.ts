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

@Entity('user_exchanges')
@Index(['userid'])
export class UserExchange {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'userid', type: 'int' })
  userid!: number;

  @Column({ name: 'exchange_type', type: 'varchar', length: 32 })
  exchangeType!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ name: 'api_key_encrypted', type: 'text' })
  apiKeyEncrypted!: string;

  @Column({ name: 'api_secret_encrypted', type: 'text' })
  apiSecretEncrypted!: string;

  @Column({ name: 'passphrase_encrypted', type: 'text', nullable: true })
  passphraseEncrypted!: string | null;

  @Column({ name: 'grpc_token_encrypted', type: 'text', nullable: true })
  grpcTokenEncrypted!: string | null;

  @Column({ name: 'is_testnet', type: 'boolean', default: false })
  isTestnet!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userid' })
  user!: User;

}
