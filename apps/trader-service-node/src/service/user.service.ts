import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { User } from '../entity/user.entity.js';
import { IUserOptions } from '../interface.js';

@Provide()
export class UserService {
  @InjectEntityModel(User)
  userRepo?: Repository<User>;

  async getUser(options: IUserOptions) {
    return {
      uid: options.uid,
      username: 'mockedName',
      phone: '12345678901',
      email: 'xxx.xxx@xxx.com',
    };
  }

  async listUsers(): Promise<User[]> {
    if (!this.userRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getOrCreate(params: { userId: string; username: string }): Promise<User> {
    if (!this.userRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }

    const userId = params.userId.trim();
    const username = params.username.trim() || userId;
    if (!userId) {
      throw new httpError.BadRequestError('user_id is required');
    }

    const existing = await this.userRepo.findOne({ where: { id: userId } });
    if (existing) {
      if (existing.username !== username) {
        existing.username = username;
        return await this.userRepo.save(existing);
      }
      return existing;
    }

    const created = this.userRepo.create({
      id: userId,
      username,
      role: 'user',
      isActive: true,
      casdoorId: null,
    });
    return await this.userRepo.save(created);
  }

  async updateUser(userId: string, patch: { username?: string | null }): Promise<User> {
    if (!this.userRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new httpError.NotFoundError('User not found');
    }

    if (patch.username !== undefined && patch.username !== null) {
      const username = patch.username.trim();
      if (!username) throw new httpError.BadRequestError('username is required');
      user.username = username;
    }
    return await this.userRepo.save(user);
  }

  async setActive(userId: string, isActive: boolean): Promise<User> {
    if (!this.userRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new httpError.NotFoundError('User not found');
    }

    user.isActive = isActive;
    return this.userRepo.save(user);
  }
}
