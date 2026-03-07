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

@Entity('strategies')
@Index(['userid'])
export class Strategy {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'userid', type: 'int' })
  userid!: number;

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

  @Column({ type: 'varchar', length: 16, default: 'inactive' })
  status!: string;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userid' })
  user!: User;
}
