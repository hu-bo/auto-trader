#!/bin/bash

# Symbol Sync Status API 测试脚本
# 使用方法: ./test_sync_status_api.sh [API_BASE_URL] [API_KEY]

API_BASE_URL="${1:-http://localhost:8080}"
API_KEY="${2:-}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 构建请求头
if [ -n "$API_KEY" ]; then
    AUTH_HEADER="-H \"X-API-Key: $API_KEY\""
else
    AUTH_HEADER=""
fi

echo -e "${YELLOW}=== Symbol Sync Status API 测试 ===${NC}\n"

# 测试 1: 查询单个交易对的同步状态
echo -e "${GREEN}测试 1: 查询单个交易对的同步状态${NC}"
echo "请求: GET $API_BASE_URL/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot"
echo ""

if [ -n "$API_KEY" ]; then
    curl -s -H "X-API-Key: $API_KEY" \
        "$API_BASE_URL/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot" | jq '.'
else
    curl -s "$API_BASE_URL/api/sync/status?exchange=binance&symbol=BTC-USDT&trade_type=spot" | jq '.'
fi

echo -e "\n"

# 测试 2: 查询所有交易对的同步状态（带 trade_type 过滤）
echo -e "${GREEN}测试 2: 查询所有交易对的同步状态（spot）${NC}"
echo "请求: GET $API_BASE_URL/api/sync/status/all?exchange=binance&trade_type=spot"
echo ""

if [ -n "$API_KEY" ]; then
    curl -s -H "X-API-Key: $API_KEY" \
        "$API_BASE_URL/api/sync/status/all?exchange=binance&trade_type=spot" | jq '.'
else
    curl -s "$API_BASE_URL/api/sync/status/all?exchange=binance&trade_type=spot" | jq '.'
fi

echo -e "\n"

# 测试 3: 查询所有交易对的同步状态（不过滤 trade_type）
echo -e "${GREEN}测试 3: 查询所有交易对的同步状态（所有类型）${NC}"
echo "请求: GET $API_BASE_URL/api/sync/status/all?exchange=binance"
echo ""

if [ -n "$API_KEY" ]; then
    curl -s -H "X-API-Key: $API_KEY" \
        "$API_BASE_URL/api/sync/status/all?exchange=binance" | jq '.'
else
    curl -s "$API_BASE_URL/api/sync/status/all?exchange=binance" | jq '.'
fi

echo -e "\n"

# 测试 4: 错误情况 - 缺少必填参数
echo -e "${GREEN}测试 4: 错误情况 - 缺少必填参数${NC}"
echo "请求: GET $API_BASE_URL/api/sync/status?symbol=BTC-USDT"
echo ""

if [ -n "$API_KEY" ]; then
    curl -s -H "X-API-Key: $API_KEY" \
        "$API_BASE_URL/api/sync/status?symbol=BTC-USDT" | jq '.'
else
    curl -s "$API_BASE_URL/api/sync/status?symbol=BTC-USDT" | jq '.'
fi

echo -e "\n"

# 测试 5: 错误情况 - 交易对不存在
echo -e "${GREEN}测试 5: 错误情况 - 交易对不存在${NC}"
echo "请求: GET $API_BASE_URL/api/sync/status?exchange=binance&symbol=INVALID-PAIR&trade_type=spot"
echo ""

if [ -n "$API_KEY" ]; then
    curl -s -H "X-API-Key: $API_KEY" \
        "$API_BASE_URL/api/sync/status?exchange=binance&symbol=INVALID-PAIR&trade_type=spot" | jq '.'
else
    curl -s "$API_BASE_URL/api/sync/status?exchange=binance&symbol=INVALID-PAIR&trade_type=spot" | jq '.'
fi

echo -e "\n${YELLOW}=== 测试完成 ===${NC}\n"

# 使用说明
echo -e "${YELLOW}使用说明:${NC}"
echo "1. 不带参数运行（默认 localhost:8080，无 API Key）:"
echo "   ./test_sync_status_api.sh"
echo ""
echo "2. 指定 API 地址:"
echo "   ./test_sync_status_api.sh http://your-server:8080"
echo ""
echo "3. 指定 API 地址和 API Key:"
echo "   ./test_sync_status_api.sh http://your-server:8080 your-api-key"
echo ""
