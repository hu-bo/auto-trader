.PHONY: tools proto

TOOLS_BIN := $(shell go env GOPATH)/bin

tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.5
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1

proto:
	mkdir -p gen/exchange
	protoc -I proto \
		--go_out=gen/exchange --go_opt=paths=source_relative \
		--go-grpc_out=gen/exchange --go-grpc_opt=paths=source_relative \
		exchange.proto

