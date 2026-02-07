import { Config, Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Context } from '@midwayjs/koa';
import type { Repository } from 'typeorm';
import type { CasdoorUser } from '@hquant/casdoor/server';
import { User } from '../entity/user.entity.js';
import { IUserOptions } from '../interface.js';
import { AuthConfig } from '../common/casdoor.js';

@Provide()
export class UserService {
  @Config('auth')
  authConfig!: AuthConfig;

  @InjectEntityModel(User)
  userRepo!: Repository<User>;

  async getUsers() {
    return await this.userRepo.find();
  }

  async getUser(options: IUserOptions) {
    if (this.authConfig.mode === "mock") {
      return {
        id: options.casdoorid,
        username: 'mockedName',
        displayname: 'mockedName',
      };
    }
    return await this.userRepo.findOne({
      where: {
        casdoorid: options.casdoorid,
      },
    })
  }

  private requireRepo(): Repository<User> {
    if (!this.userRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.userRepo;
  }
  async getOrCreateFromCasdoorUser(
    casdoorUser: Partial<CasdoorUser> & { id: string; name?: string }
  ): Promise<User> {
    const repo = this.requireRepo();

    const casdoorid = String(casdoorUser.id).trim();
    if (!casdoorid) throw new httpError.UnauthorizedError('User not authenticated');

    const existing = await repo.findOne({ where: { casdoorid } });
    if (existing) return existing;

    const username = String(casdoorUser.name ?? casdoorid).trim() || casdoorid;
    const created = repo.create({
      casdoorid,
      username,
      displayname: String(casdoorUser.displayName ?? '').trim(),
      role: casdoorUser.roles ? casdoorUser.roles[0].displayName : '',
      isadmin: Boolean(casdoorUser.isAdmin || casdoorUser.isGlobalAdmin),
      isactive: !Boolean(casdoorUser.isForbidden),
    });

    return await repo.save(created);
  }

  async syncFromCasdoorUser(
    casdoorUser: Partial<CasdoorUser> & { id: string; name?: string }
  ): Promise<User> {
    const repo = this.requireRepo();

    const casdoorid = String(casdoorUser.id).trim();
    if (!casdoorid) throw new httpError.UnauthorizedError('User not authenticated');

    const username = String(casdoorUser.name ?? casdoorid).trim() || casdoorid;
    const displayname = String(casdoorUser.displayName ?? '').trim();
    const role = casdoorUser.roles ? casdoorUser.roles[0].displayName : '';
    const isadmin = Boolean(casdoorUser.isAdmin || casdoorUser.isGlobalAdmin);
    const isactive = !Boolean(casdoorUser.isForbidden);

    const existing = await repo.findOne({ where: { casdoorid } });
    if (!existing) {
      const created = repo.create({
        casdoorid,
        username,
        displayname,
        role,
        isadmin,
        isactive,
      });
      return await repo.save(created);
    }

    let dirty = false;
    if (existing.username !== username) {
      existing.username = username;
      dirty = true;
    }
    if (existing.displayname !== displayname) {
      existing.displayname = displayname;
      dirty = true;
    }
    if (existing.role !== role) {
      existing.role = role;
      dirty = true;
    }

    if (existing.isadmin !== isadmin) {
      existing.isadmin = isadmin;
      dirty = true;
    }
    if (existing.isactive !== isactive) {
      existing.isactive = isactive;
      dirty = true;
    }

    dirty = true;

    return dirty ? await repo.save(existing) : existing;
  }

  async getOrCreateCurrentUser(casdoorUser: CasdoorUser): Promise<User> {
    return await this.getOrCreateFromCasdoorUser(casdoorUser);
  }

  async getCurrentUserid(ctx: Context): Promise<number> {
    const user = await this.getOrCreateCurrentUser(ctx.state.user);
    return user.id;
  }
}
