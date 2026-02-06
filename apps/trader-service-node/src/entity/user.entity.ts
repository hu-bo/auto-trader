import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index(['casdoorid'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 128, default: '' })
  casdoorid!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  username!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  displayname!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  role!: string;

  @Column({ type: 'boolean', default: false })
  isadmin!: boolean;

  @Column({ type: 'boolean', default: true })
  isactive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'date' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'date' })
  updatedAt!: Date;
}

