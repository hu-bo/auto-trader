package interceptors

import (
	"context"
	"fmt"
	"runtime/debug"

	"github.com/pkg/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var log = logger.Module("grpc.interceptors")

func UnaryRecovery() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error().
					Str("method", info.FullMethod).
					Any("panic", r).
					Bytes("stack", debug.Stack()).
					Msg("panic recovered (unary)")
				err = status.Error(codes.Internal, fmt.Sprintf("internal error"))
			}
		}()
		return handler(ctx, req)
	}
}

func StreamRecovery() grpc.StreamServerInterceptor {
	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) (err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error().
					Str("method", info.FullMethod).
					Any("panic", r).
					Bytes("stack", debug.Stack()).
					Msg("panic recovered (stream)")
				err = status.Error(codes.Internal, fmt.Sprintf("internal error"))
			}
		}()
		return handler(srv, stream)
	}
}
