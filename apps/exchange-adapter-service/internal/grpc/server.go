package grpcserver

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"os"
	"time"

	exchangepb "exchange-adapter-service/gen/exchange"
	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/grpc/interceptors"

	"github.com/pkg/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

var log = logger.Module("grpc.server")

type Server struct {
	cfg    *config.Config
	grpc   *grpc.Server
	lis    net.Listener
	health *health.Server
}

func New(cfg *config.Config, svc exchangepb.ExchangeServiceServer) (*Server, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is nil")
	}

	addr := fmt.Sprintf(":%d", cfg.Server.GRPCPort)
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}

	var opts []grpc.ServerOption
	opts = append(opts,
		grpc.ChainUnaryInterceptor(
			interceptors.UnaryRecovery(),
			interceptors.UnaryLogging(),
		),
		grpc.ChainStreamInterceptor(
			interceptors.StreamRecovery(),
			interceptors.StreamLogging(),
		),
	)

	if cfg.Security.TLSEnabled {
		tlsCfg, err := loadTLSConfig(cfg.Security)
		if err != nil {
			_ = lis.Close()
			return nil, err
		}
		opts = append(opts, grpc.Creds(credentials.NewTLS(tlsCfg)))
	}

	gsrv := grpc.NewServer(opts...)
	hsrv := health.NewServer()
	hsrv.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	exchangepb.RegisterExchangeServiceServer(gsrv, svc)
	grpc_health_v1.RegisterHealthServer(gsrv, hsrv)
	reflection.Register(gsrv)

	return &Server{
		cfg:    cfg,
		grpc:   gsrv,
		lis:    lis,
		health: hsrv,
	}, nil
}

func (s *Server) Addr() net.Addr {
	if s == nil || s.lis == nil {
		return nil
	}
	return s.lis.Addr()
}

func (s *Server) Start() error {
	log.Info().Str("addr", s.lis.Addr().String()).Msg("gRPC server started")
	return s.grpc.Serve(s.lis)
}

func (s *Server) Stop(ctx context.Context) error {
	if s == nil || s.grpc == nil {
		return nil
	}

	done := make(chan struct{})
	go func() {
		s.grpc.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		s.grpc.Stop()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
		}
		return ctx.Err()
	}
}

func loadTLSConfig(cfg config.SecurityConfig) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
	if err != nil {
		return nil, err
	}

	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}

	if cfg.CAFile == "" {
		return tlsCfg, nil
	}

	b, err := os.ReadFile(cfg.CAFile)
	if err != nil {
		return nil, err
	}
	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(b); !ok {
		return nil, fmt.Errorf("failed to parse ca_file")
	}

	tlsCfg.ClientCAs = pool
	tlsCfg.ClientAuth = tls.RequireAndVerifyClientCert
	return tlsCfg, nil
}
