# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# 安装依赖
RUN apk add --no-cache git

# 复制 go mod 文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/exchange-sync ./cmd/main.go

# Run stage
FROM alpine:3.19

WORKDIR /app

# 安装证书和时区
RUN apk add --no-cache ca-certificates tzdata

# 复制二进制文件
COPY --from=builder /app/exchange-sync .

# 复制配置文件
COPY config.yaml .
COPY config.local.yaml .

# 暴露端口
EXPOSE 9100 9100

# 运行
CMD ["./exchange-sync"]
