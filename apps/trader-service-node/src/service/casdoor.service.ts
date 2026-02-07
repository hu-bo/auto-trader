import { Config, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import { readFileSync } from 'node:fs';
import {
  createCasdoorServer,
  type CasdoorServer,
} from '@hquant/casdoor/server';
import type { AuthConfig, CasdoorConfig } from '../types/index.js';

@Provide()
@Scope(ScopeEnum.Singleton)
export class CasdoorService {
  @Config('auth')
  authConfig!: AuthConfig;

  @Config('casdoor')
  casdoorConfig!: CasdoorConfig;

  private server?: CasdoorServer;

  isEnabled(): boolean {
    return (this.authConfig?.mode ?? 'mock') === 'casdoor';
  }

  private resolveCertificate(): string {
    const certificatePath = (this.casdoorConfig?.certificatePath ?? '').trim();
    try {
      const content = readFileSync(certificatePath, 'utf-8').trim();
      if (!content) {
        throw new Error('CASDOOR_CERTIFICATE_PATH points to an empty file');
      }
      return content;
    } catch (_err) {
      throw new httpError.ServiceUnavailableError('CASDOOR_CERTIFICATE_PATH is invalid or unreadable');
    }
  }

  private requireServer(): CasdoorServer {
    if (this.server) return this.server;

    if (!this.isEnabled()) {
      throw new httpError.ServiceUnavailableError('Casdoor authentication is not enabled');
    }

    const endpoint = (this.casdoorConfig?.endpoint ?? '').trim();
    const clientId = (this.casdoorConfig?.clientId ?? '').trim();
    const clientSecret = (this.casdoorConfig?.clientSecret ?? '').trim();
    const orgName = (this.casdoorConfig?.orgName ?? '').trim();
    const appName = (this.casdoorConfig?.appName ?? '').trim();
    const certificate = this.resolveCertificate();

    if (!endpoint) throw new httpError.ServiceUnavailableError('CASDOOR_ENDPOINT is required');
    if (!clientId) throw new httpError.ServiceUnavailableError('CASDOOR_CLIENT_ID is required');
    if (!clientSecret) throw new httpError.ServiceUnavailableError('CASDOOR_CLIENT_SECRET is required');
    if (!orgName) throw new httpError.ServiceUnavailableError('CASDOOR_ORG_NAME is required');
    if (!appName) throw new httpError.ServiceUnavailableError('CASDOOR_APP_NAME is required');

    try {
      this.server = createCasdoorServer({
        endpoint,
        clientId,
        clientSecret,
        orgName,
        appName,
        certificate,
      });
      return this.server;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Casdoor server';
      throw new httpError.InternalServerErrorError(message);
    }
  }

  getServer(): CasdoorServer {
    return this.requireServer();
  }

  async verifyTokenGetUser(accessToken: string) {
    const server = this.requireServer();
    return await server.verifyToken(accessToken);
  }
  async verifyCode(code: string) {
    const server = this.requireServer();
    return await server.getToken(code);
  }
}
