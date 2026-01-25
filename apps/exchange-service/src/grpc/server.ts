import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { serverConfig } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import { createHandlers } from './handlers/index.js';

const logger = createLogger('grpc-server');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, '../../proto/exchange.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const exchangeProto = protoDescriptor.exchange;

let server: grpc.Server | null = null;

export async function startGrpcServer(): Promise<grpc.Server> {
  server = new grpc.Server();

  const handlers = createHandlers();

  server.addService(exchangeProto.ExchangeService.service, handlers);

  const address = `${serverConfig.host}:${serverConfig.grpcPort}`;

  return new Promise((resolve, reject) => {
    server!.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        logger.error({ error: err }, 'Failed to start gRPC server');
        reject(err);
        return;
      }

      logger.info({ port }, 'gRPC server started');
      resolve(server!);
    });
  });
}

export async function stopGrpcServer(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.tryShutdown(() => {
        logger.info('gRPC server stopped');
        server = null;
        resolve();
      });
    });
  }
}
