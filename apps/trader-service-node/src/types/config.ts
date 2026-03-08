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

export interface ExchangeAdapterConfig {
  apiKey: string;
  grpc: string;
  http: string;
}

export interface StrategyEngineConfig {
  grpc: string;
  http: string;
}

export interface GrpcTlsConfig {
  enabled: boolean;
  caCertPath: string;
  certFile: string;
  keyFile: string;
  serverNameOverride: string;
}

export interface AppConfig {
  auth: AuthConfig;
  casdoor: CasdoorConfig;
  encryption: EncryptionConfig;
  exchangeAdapter: ExchangeAdapterConfig;
  strategyEngine: StrategyEngineConfig;
  grpcTls: GrpcTlsConfig;
}
