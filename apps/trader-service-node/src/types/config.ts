/**
 * Application configuration types
 */

export interface AuthConfig {
  mode: 'mock' | 'casdoor';
}

export interface CasdoorConfig {
  endpoint: string;
  clientId: string;
  clientSecret: string;
  orgName: string;
  appName: string;
  certificate?: string;
  certificatePath?: string;
  redirectUri?: string;
}

export interface EncryptionConfig {
  key: string;
}

export interface ExchangeGrpcConfig {
  url: string;
}

export interface AppConfig {
  auth: AuthConfig;
  casdoor: CasdoorConfig;
  encryption: EncryptionConfig;
  exchangeGrpc: ExchangeGrpcConfig;
}
