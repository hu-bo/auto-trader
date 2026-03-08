import * as grpc from '@grpc/grpc-js';
import { httpError } from '@midwayjs/core';
import { readFileSync } from 'node:fs';
import type { GrpcTlsConfig } from '../types/index.js';

type ResolvedGrpcTls = {
  credentials: grpc.ChannelCredentials;
  options?: grpc.ChannelOptions;
};

function readPemFile(path: string, label: string): Buffer {
  const filePath = path.trim();
  if (!filePath) {
    throw new httpError.ServiceUnavailableError(`${label} is required when gRPC TLS is enabled`);
  }

  try {
    const content = readFileSync(filePath);
    if (content.length === 0) {
      throw new Error('empty file');
    }
    return content;
  } catch {
    throw new httpError.ServiceUnavailableError(`${label} is invalid or unreadable`);
  }
}

export function resolveGrpcChannelSecurity(config?: GrpcTlsConfig): ResolvedGrpcTls {
  if (!config?.enabled) {
    return {
      credentials: grpc.credentials.createInsecure(),
    };
  }

  const rootCerts = readPemFile(config.caCertPath, 'GRPC_TLS_CA_CERT_PATH');

  let privateKey: Buffer | null = null;
  let certChain: Buffer | null = null;
  const certFile = (config.certFile ?? '').trim();
  const keyFile = (config.keyFile ?? '').trim();

  if (certFile || keyFile) {
    certChain = readPemFile(certFile, 'GRPC_TLS_CERT_FILE');
    privateKey = readPemFile(keyFile, 'GRPC_TLS_KEY_FILE');
  }

  const serverNameOverride = (config.serverNameOverride ?? '').trim();
  const options = serverNameOverride
    ? {
        'grpc.ssl_target_name_override': serverNameOverride,
        'grpc.default_authority': serverNameOverride,
      }
    : undefined;

  return {
    credentials: grpc.credentials.createSsl(rootCerts, privateKey, certChain),
    options,
  };
}
