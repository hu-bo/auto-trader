.PHONY: build run dev test clean deps docker sqlc

# 应用名称
APP_NAME := exchange-sync
BUILD_DIR := ./bin

# Go 相关变量
GO := go
GOFLAGS := -v
LDFLAGS := -s -w

# 构建
build:
	@echo "Building $(APP_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GO) build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(APP_NAME) ./cmd/main.go
	@echo "Build complete: $(BUILD_DIR)/$(APP_NAME)"

# 运行
run: build
	@echo "Running $(APP_NAME)..."
	$(BUILD_DIR)/$(APP_NAME)

# 开发模式 (热重载)
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "air not installed. Installing..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# 测试
test:
	$(GO) test -v ./...

# 测试覆盖率
test-cover:
	$(GO) test -v -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

# 同步依赖
deps:
	$(GO) mod download
	$(GO) mod tidy

# 清理
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html
	@echo "Clean complete"

# Docker 构建
docker:
	docker build -t $(APP_NAME):latest .

# Docker Compose 本地环境
docker-up:
	docker-compose -f docker-compose.local.yaml up -d

docker-down:
	docker-compose -f docker-compose.local.yaml down

# 生成 Swagger 文档
swagger:
	@if command -v swag > /dev/null; then \
		swag init -g cmd/main.go -o docs/swagger; \
	else \
		echo "swag not installed. Run: go install github.com/swaggo/swag/cmd/swag@latest"; \
	fi

# 代码检查
lint:
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed"; \
	fi

# 格式化代码
fmt:
	$(GO) fmt ./...

# 生成 sqlc 代码
sqlc:
	@if command -v sqlc > /dev/null; then \
		sqlc generate; \
		echo "sqlc code generated"; \
	else \
		echo "sqlc not installed. Run: brew install sqlc or go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest"; \
	fi

# 帮助
help:
	@echo "Available targets:"
	@echo "  build       - Build the application"
	@echo "  run         - Build and run the application"
	@echo "  dev         - Run with hot reload (requires air)"
	@echo "  test        - Run tests"
	@echo "  test-cover  - Run tests with coverage"
	@echo "  deps        - Download and tidy dependencies"
	@echo "  clean       - Clean build artifacts"
	@echo "  docker      - Build Docker image"
	@echo "  docker-up   - Start local Docker environment"
	@echo "  docker-down - Stop local Docker environment"
	@echo "  swagger     - Generate Swagger docs"
	@echo "  sqlc        - Generate sqlc code from SQL"
	@echo "  lint        - Run linter"
	@echo "  fmt         - Format code"
