import { Config, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import { readFileSync } from 'node:fs';
import {
  createCasdoorServer,
  type CasdoorServer,
  type CasdoorUser,
  type JwtClaims,
  type TokenResponse,
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
  private warnedDeprecatedCertificateEnv = false;

  isEnabled(): boolean {
    return (this.authConfig?.mode ?? 'mock') === 'casdoor';
  }

  private resolveCertificate(): string {
    const certificatePath = (this.casdoorConfig?.certificatePath ?? '').trim();
    if (certificatePath) {
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

    const certificate = (this.casdoorConfig?.certificate ?? '').trim();
    if (!certificate) {
      // Prefer CASDOOR_CERTIFICATE_PATH (file-based) to avoid multi-line env vars.
      throw new httpError.ServiceUnavailableError('CASDOOR_CERTIFICATE_PATH is required');
    }

    // Backward-compat: accept CASDOOR_CERTIFICATE, but warn if it came from env.
    if (!this.warnedDeprecatedCertificateEnv && (process.env.CASDOOR_CERTIFICATE ?? '').trim()) {
      this.warnedDeprecatedCertificateEnv = true;
      // eslint-disable-next-line no-console
      console.warn('[casdoor] CASDOOR_CERTIFICATE is deprecated; please use CASDOOR_CERTIFICATE_PATH instead');
    }

    return certificate;
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

  getSigninUrl(redirectUri?: string): string {
    const server = this.requireServer();
    const uri = (redirectUri ?? this.casdoorConfig?.redirectUri ?? '').trim();
    if (!uri) throw new httpError.ServiceUnavailableError('CASDOOR_REDIRECT_URI is required');
    return server.getSigninUrl(uri);
  }

  async exchangeToken(code: string): Promise<{ token: TokenResponse; user: CasdoorUser; claims: JwtClaims }> {
    const server = this.requireServer();
    const trimmed = code.trim();
    if (!trimmed) throw new httpError.BadRequestError('code is required');

    const token = await server.getToken(trimmed);
    const claims = server.parseJwtToken(token.access_token);
    const name = String((claims.name as string | undefined) ?? claims.sub ?? '').trim();
    if (!name) throw new httpError.BadGatewayError('Casdoor token missing user claim');
    const user = await server.getUser(name);

    return { token, user, claims };
  }

  async verifyToken(accessToken: string) {
    const server = this.requireServer();
    return await server.verifyToken(accessToken);
  }

  async getUsers(): Promise<CasdoorUser[]> {
    const server = this.requireServer();
    return await server.getUsers();
  }

  async updateUser(user: Partial<CasdoorUser> & { name: string }): Promise<boolean> {
    const server = this.requireServer();
    return await server.updateUser(user);
  }
}
