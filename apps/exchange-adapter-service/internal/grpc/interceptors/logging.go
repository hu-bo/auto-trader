package interceptors

import (
	"context"
	"time"

	"github.com/pkg/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

var logUnary = logger.Module("grpc.unary")
var logStream = logger.Module("grpc.stream")

func UnaryLogging() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()
		resp, err := handler(ctx, req)
		st, _ := status.FromError(err)

		logUnary.Info().
			Str("method", info.FullMethod).
			Int("code", int(st.Code())).
			Dur("duration", time.Since(start)).
			Msg("grpc unary")
		return resp, err
	}
}

func StreamLogging() grpc.StreamServerInterceptor {
	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()
		err := handler(srv, stream)
		st, _ := status.FromError(err)

		logStream.Info().
			Str("method", info.FullMethod).
			Bool("client_stream", info.IsClientStream).
			Bool("server_stream", info.IsServerStream).
			Int("code", int(st.Code())).
			Dur("duration", time.Since(start)).
			Msg("grpc stream")
		return err
	}
}
