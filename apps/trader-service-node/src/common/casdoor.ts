import { readFileSync } from 'node:fs';
import { httpError } from '@midwayjs/core';
import {
  createCasdoorServer,
  type CasdoorServer,
  type CasdoorUser,
  type JwtClaims,
  type TokenResponse,
} from '@hquant/casdoor/server';

export interface CasdoorConfig {
  endpoint: string;
  clientId: string;
  clientSecret: string;
  orgName: string;
  appName: string;
  certificatePath?: string;
  certificate?: string;
  redirectUri?: string;
}

export interface AuthConfig {
  mode: 'mock' | 'casdoor';
}

let casdoorServerInstance: CasdoorServer | undefined;

/**
 * Resolve certificate from file path or direct value
 */
function resolveCertificate(config: CasdoorConfig): string {
  const certificatePath = (config.certificatePath ?? '').trim();
  if (certificatePath) {
    try {
      const content = readFileSync(certificatePath, 'utf-8').trim();
      if (!content) {
        throw new Error('CASDOOR_CERTIFICATE_PATH points to an empty file');
      }
      return content;
    } catch (_err) {
      throw new httpError.ServiceUnavailableError(
        'CASDOOR_CERTIFICATE_PATH is invalid or unreadable'
      );
    }
  }

  const certificate = (config.certificate ?? '').trim();
  if (!certificate) {
    throw new httpError.ServiceUnavailableError('CASDOOR_CERTIFICATE_PATH is required');
  }

  return certificate;
}

/**
 * Create or get cached Casdoor server instance
 */
export function getCasdoorServer(config: CasdoorConfig): CasdoorServer {
  if (casdoorServerInstance) {
    return casdoorServerInstance;
  }

  const endpoint = (config.endpoint ?? '').trim();
  const clientId = (config.clientId ?? '').trim();
  const clientSecret = (config.clientSecret ?? '').trim();
  const orgName = (config.orgName ?? '').trim();
  const appName = (config.appName ?? '').trim();
  const certificate = resolveCertificate(config);

  if (!endpoint)
    throw new httpError.ServiceUnavailableError('CASDOOR_ENDPOINT is required');
  if (!clientId)
    throw new httpError.ServiceUnavailableError('CASDOOR_CLIENT_ID is required');
  if (!clientSecret)
    throw new httpError.ServiceUnavailableError('CASDOOR_CLIENT_SECRET is required');
  if (!orgName)
    throw new httpError.ServiceUnavailableError('CASDOOR_ORG_NAME is required');
  if (!appName)
    throw new httpError.ServiceUnavailableError('CASDOOR_APP_NAME is required');

  try {
    casdoorServerInstance = createCasdoorServer({
      endpoint,
      clientId,
      clientSecret,
      orgName,
      appName,
      certificate,
    });
    return casdoorServerInstance;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to initialize Casdoor server';
    throw new httpError.InternalServerErrorError(message);
  }
}

/**
 * Get signin URL
 */
export function getSigninUrl(
  config: CasdoorConfig,
  redirectUri?: string
): string {
  const server = getCasdoorServer(config);
  const uri = (redirectUri ?? config.redirectUri ?? '').trim();
  if (!uri)
    throw new httpError.ServiceUnavailableError('CASDOOR_REDIRECT_URI is required');
  return server.getSigninUrl(uri);
}

/**
 * Exchange authorization code for token
 */
export async function exchangeToken(
  config: CasdoorConfig,
  code: string
): Promise<{ token: TokenResponse; user: CasdoorUser }> {
  const server = getCasdoorServer(config);
  const trimmed = code.trim();
  if (!trimmed) throw new httpError.BadRequestError('code is required');

  const token = await server.getToken(trimmed);
  const { valid, user, claims } = await server.verifyToken(token.access_token);
  if (!valid) throw new httpError.UnauthorizedError('Invalid Casdoor token');
  return { token, user: user as CasdoorUser };
}


