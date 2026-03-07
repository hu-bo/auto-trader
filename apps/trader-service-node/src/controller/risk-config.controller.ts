import { Body, Controller, Del, Get, Inject, Param, Post, Put } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { UserService } from '../service/user.service.js';
import { RiskConfigService } from '../service/risk-config.service.js';
import { apiOk } from '../util/api-response.js';
import {
  CreateRiskConfigBodyDTO,
  RiskConfigIdParamDTO,
  UpdateRiskConfigBodyDTO,
} from '../dto/risk-config.dto.js';

@Controller('/api/v1/risk-config')
export class RiskConfigController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  @Inject()
  riskConfigService!: RiskConfigService;

  private async getUserid(): Promise<number> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    return user.id;
  }

  private toRead(item: any) {
    return {
      id: String(item.id),
      name: item.name ?? '',
      riskConfig: this.riskConfigService.riskConfigToDict(item),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const userid = await this.getUserid();
    const list = await this.riskConfigService.listPresets(userid);
    return apiOk(list.map(item => this.toRead(item)));
  }

  @Get('/:id')
  async get(@Param() params: RiskConfigIdParamDTO) {
    const userid = await this.getUserid();
    const item = await this.riskConfigService.getPreset(userid, params.id);
    return apiOk(this.toRead(item));
  }

  @Post('/')
  async create(@Body() body: CreateRiskConfigBodyDTO) {
    const userid = await this.getUserid();
    const item = await this.riskConfigService.createPreset(userid, body.name, body.riskConfig ?? {});
    return apiOk(this.toRead(item));
  }

  @Put('/:id')
  async update(
    @Param() params: RiskConfigIdParamDTO,
    @Body() body: UpdateRiskConfigBodyDTO
  ) {
    const userid = await this.getUserid();
    const item = await this.riskConfigService.updatePreset(userid, params.id, {
      name: body?.name ?? undefined,
      riskConfig: body?.riskConfig ?? undefined,
    });
    return apiOk(this.toRead(item));
  }

  @Del('/:id')
  async remove(@Param() params: RiskConfigIdParamDTO) {
    const userid = await this.getUserid();
    await this.riskConfigService.deletePreset(userid, params.id);
    return apiOk(null);
  }
}
