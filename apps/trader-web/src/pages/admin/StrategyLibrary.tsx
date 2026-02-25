import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Typography,
  Modal,
  Toast,
  Empty,
  Popconfirm,
  Form,
  Select,
} from '@douyinfe/semi-ui-19'
import { IconPlus, IconEdit, IconDelete, IconCopy, IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategyApi } from '@/api'
import { StrategyEditor } from '@/components/editor/StrategyEditor'
import { formatDateTime } from '@/utils/format'
import type { Strategy, StrategyTag, StrategyStatus } from '@/types'

const { Title, Text } = Typography

const DSL_PROMPT = `你是一个量化交易策略 DSL 代码生成器。请根据用户的自然语言描述，生成符合 HQuant DSL 语法的策略代码。

## 语法规则

每行只能是以下三种之一：
1. 注释行：以 # 或 // 开头
2. 变量定义：LET <变量名> = <表达式>
3. 条件规则：IF <条件表达式> THEN <动作>

关键字不区分大小写（LET/let/Let 均可），但建议统一使用大写。
变量名由字母、数字、下划线组成，首字符必须为字母或下划线，不能与内置字段名重复，不允许重复定义。

## 关键字清单

| 关键字 | 用途 | 示例 |
|--------|------|------|
| LET | 定义变量 | LET rsi = RSI(14) |
| IF | 条件判断开始 | IF rsi < 30 THEN BUY |
| THEN | 条件满足时执行动作 | IF ... THEN SELL("reason") |
| AND | 逻辑与 | IF rsi < 30 AND close > ma THEN BUY |
| OR | 逻辑或 | IF rsi > 70 OR close < ma THEN SELL |
| NOT | 逻辑非（也可用 !） | IF NOT (rsi > 50) THEN HOLD |
| BUY | 买入动作 | BUY 或 BUY("oversold") |
| SELL | 卖出动作 | SELL 或 SELL("overbought") |
| HOLD | 持有动作 | HOLD 或 HOLD("waiting") |

## 比较运算符

== 等于, != 不等于, < 小于, > 大于, <= 小于等于, >= 大于等于

## 内置字段（保留名，不可作为变量名）

| 字段 | 说明 |
|------|------|
| open | 开盘价 |
| high | 最高价 |
| low | 最低价 |
| close | 收盘价 |
| volume | 成交量 |
| buy_volume | 主买量 |

字段支持多周期引用，语法为 字段@周期，周期单位：ms, s, m, h, d。
示例：close@4h（4小时收盘价）、close@1d（日线收盘价）、volume@15m（15分钟成交量）

## 技术指标函数

### RSI - 相对强弱指标
- 签名：RSI(周期) 或 RSI(close, 周期) 或 RSI(close@4h, 周期)
- 返回：单个数值（0-100）
- 注意：RSI 仅支持 close 字段
- 示例：LET rsi = RSI(14)

### SMA - 简单移动平均
- 签名：SMA(周期) 或 SMA(字段, 周期)
- 字段缺省为 close
- 返回：单个数值
- 示例：LET ma = SMA(close, 20)、LET vol_ma = SMA(volume, 20)

### EMA - 指数移动平均
- 签名：EMA(周期) 或 EMA(字段, 周期)
- 字段缺省为 close
- 返回：单个数值
- 示例：LET ema12 = EMA(close, 12)、LET ema_4h = EMA(close@4h, 20)

### STDDEV - 标准差
- 签名：STDDEV(周期) 或 STDDEV(字段, 周期)
- 字段缺省为 close
- 返回：单个数值
- 示例：LET std = STDDEV(close, 20)

### BOLL - 布林带
- 签名：BOLL(周期, k)
- k 为标准差倍数，常用 2.0
- 返回：复合值，可通过 .mid .upper .lower 访问
- 示例：LET boll = BOLL(20, 2.0)，然后用 boll.lower、boll.upper、boll.mid

### MACD - 移动平均收敛散度
- 签名：MACD(快线周期, 慢线周期, 信号线周期)
- 返回：复合值，可通过 .macd .signal .hist 访问
- 示例：LET macd = MACD(12, 26, 9)，然后用 macd.hist、macd.macd、macd.signal

## 向量与模式识别函数

### NORMALIZE - 向量归一化
- 签名：NORMALIZE(字段, 长度, method="方法名")
- 字段缺省为 close，长度为向量的 K 线根数
- method 可选值："minmax"（默认）、"zscore"、"l2"、"none"
- 示例：LET pattern = NORMALIZE(close, 30, method="minmax")

### VEC_STORE - 引用向量存储
- 签名：VEC_STORE("存储名称")
- 参数必须为字符串字面量
- 示例：LET store = VEC_STORE("bullish_patterns")

### SIMILARITY - 相似度匹配
- 签名：SIMILARITY(存储, 查询向量, method="方法", threshold=阈值)
- 存储：VEC_STORE("name") 或直接字符串 "name"
- 查询向量：必须为 NORMALIZE(...) 表达式
- method 可选值："cosine"（默认）、"pearson"、"euclidean"、"manhattan"、"chebyshev"
- threshold 可选，匹配分数低于此值返回 NaN
- 返回：最佳匹配分数（0-1），未达阈值返回 NaN
- 示例：LET sim = SIMILARITY(VEC_STORE("patterns"), NORMALIZE(close, 30), method="cosine", threshold=0.85)

## 动作元数据

动作后可附加原因说明，支持两种写法：
- 字符串写法（推荐）：BUY("oversold signal")
- 裸文本写法：BUY(oversold signal)
- 也可无元数据：BUY

## 完整策略示例

### RSI 超买超卖
LET rsi = RSI(14)
IF rsi < 30 THEN BUY("oversold")
IF rsi > 70 THEN SELL("overbought")

### MACD 金叉死叉
LET macd = MACD(12, 26, 9)
IF macd.hist > 0 AND macd.macd > macd.signal THEN BUY("golden cross")
IF macd.hist < 0 THEN SELL("death cross")

### 均线交叉
LET ma_fast = EMA(close, 12)
LET ma_slow = EMA(close, 26)
IF ma_fast > ma_slow THEN BUY("ma crossover up")
IF ma_fast < ma_slow THEN SELL("ma crossover down")

### 布林带突破
LET boll = BOLL(20, 2.0)
IF close < boll.lower THEN BUY("bollinger lower break")
IF close > boll.upper THEN SELL("bollinger upper break")

### 多周期趋势
LET trend_4h = EMA(close@4h, 20)
LET trend_1d = EMA(close@1d, 20)
IF close > trend_4h AND close > trend_1d THEN BUY("multi-period uptrend")
IF close < trend_4h OR close < trend_1d THEN SELL("multi-period downtrend")

### 复合条件
LET rsi = RSI(14)
LET ma = EMA(close, 20)
LET boll = BOLL(20, 2.0)
IF rsi < 30 AND close < boll.lower AND close > ma THEN BUY("composite buy signal")
IF rsi > 70 OR close > boll.upper THEN SELL("composite sell signal")

### 向量相似度模式识别
LET pattern = NORMALIZE(close, 30, method="minmax")
LET sim = SIMILARITY(VEC_STORE("bullish_patterns"), pattern, method="cosine", threshold=0.85)
IF sim > 0.85 THEN BUY("pattern match")

## 注意事项
1. 每行一条语句，不支持多行语句
2. 规则按从上到下的顺序求值，第一个条件为真的规则触发信号
3. 变量必须先定义后使用，不允许重复定义
4. 括号 () 可用于分组条件表达式
5. 数值支持整数和小数，可带负号
6. 字符串用双引号包裹
`

const StrategyLibrary: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [formApi, setFormApi] = useState<any>(null)
  const [code, setCode] = useState('')
  const [showDslRef, setShowDslRef] = useState(false)

  const { data: strategies, isLoading } = useQuery({
    queryKey: ['strategies', 'available'],
    queryFn: strategyApi.listAvailable,
  })

  const createMutation = useMutation({
    mutationFn: strategyApi.create,
    onSuccess: () => {
      Toast.success('策略创建成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setModalVisible(false)
      formApi?.reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof strategyApi.update>[1] }) =>
      strategyApi.update(id, data),
    onSuccess: () => {
      Toast.success('策略更新成功')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setModalVisible(false)
      setEditingStrategy(null)
      formApi?.reset()
    },
    onError: (error: Error) => {
      Toast.error(error.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: strategyApi.delete,
    onSuccess: () => {
      Toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
    },
    onError: (error: Error) => {
      Toast.error(error.message || '删除失败')
    },
  })

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy)
    setCode(strategy.code || '')
    setModalVisible(true)
  }

  const handleCreate = () => {
    setEditingStrategy(null)
    setCode('')
    setModalVisible(false)
    setTimeout(() => setModalVisible(true), 0)
  }

  const handleSubmit = (values: Record<string, unknown>) => {
    const data = {
      name: values.name as string,
      description: values.description as string,
      tag: values.tag as StrategyTag,
      code: code,
      version: values.version as string,
      status: values.status as StrategyStatus,
      isPublic: values.isPublic as boolean,
      params: values.params as Record<string, unknown>,
    }

    if (editingStrategy) {
      updateMutation.mutate({ id: editingStrategy.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'tag',
      width: 100,
      render: (tag: StrategyTag) => (
        <Tag
          color={
            tag === 'long' ? 'green' : tag === 'short' ? 'red' : 'blue'
          }
        >
          {tag === 'long' ? '做多' : tag === 'short' ? '做空' : '中性'}
        </Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: StrategyStatus) => (
        <Tag color={status === 'active' ? 'green' : 'grey'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      width: 120,
      render: (creator: any) => creator?.displayname || creator?.username || '-',
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      width: 80,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'blue' : 'grey'}>{isPublic ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: Strategy) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<IconEdit />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此策略吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" type="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title heading={4}>策略库管理</Title>
        <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
          创建策略
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={strategies || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
          }}
          empty={<Empty description="暂无策略" />}
        />
      </Card>

      <Modal
        title={editingStrategy ? '编辑策略' : '创建策略'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingStrategy(null)
        }}
        footer={null}
        width={800}
      >
        <Form
          getFormApi={(api) => setFormApi(api)}
          onSubmit={handleSubmit}
          labelPosition="left"
          labelWidth={100}
          initValues={
            editingStrategy
              ? {
                  name: editingStrategy.name,
                  description: editingStrategy.description,
                  tag: editingStrategy.tag,
                  code: editingStrategy.code,
                  version: editingStrategy.version,
                  status: editingStrategy.status,
                  isPublic: editingStrategy.isPublic,
                  params: editingStrategy.params,
                }
              : {
                  tag: 'neutral',
                  version: 'v1',
                  status: 'active',
                  isPublic: true,
                  params: {},
                }
          }
        >
          <Form.Input
            field="name"
            label="策略名称"
            placeholder="输入策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
            style={{ width: '100%' }}
          />

          <Form.TextArea
            field="description"
            label="策略描述"
            placeholder="输入策略描述"
            rows={2}
            style={{ width: '100%' }}
          />

          <Form.Select field="tag" label="策略类型" style={{ width: '100%' }}>
            <Select.Option value="neutral">中性</Select.Option>
            <Select.Option value="long">做多</Select.Option>
            <Select.Option value="short">做空</Select.Option>
          </Form.Select>

          <Form.Input
            field="version"
            label="版本"
            placeholder="v1"
            style={{ width: '100%' }}
          />

          <Form.Select field="status" label="状态" style={{ width: '100%' }}>
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">禁用</Select.Option>
          </Form.Select>

          <Form.Switch
            field="isPublic"
            label="公开策略"
            checkedText="是"
            uncheckedText="否"
          />

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontWeight: 500 }}>策略代码</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  icon={showDslRef ? <IconChevronUp /> : <IconChevronDown />}
                  onClick={() => setShowDslRef(!showDslRef)}
                >
                  DSL 语法参考
                </Button>
                <Button
                  size="small"
                  icon={<IconCopy />}
                  onClick={() => {
                    navigator.clipboard.writeText(DSL_PROMPT)
                    Toast.success('已复制 DSL 模板到剪贴板')
                  }}
                >
                  复制模板
                </Button>
              </div>
            </div>
            {showDslRef && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  background: 'var(--semi-color-fill-0)',
                  borderRadius: 6,
                  border: '1px solid var(--semi-color-border)',
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--semi-color-text-1)' }}>
                  {DSL_PROMPT}
                </pre>
              </div>
            )}
            <StrategyEditor
              value={code}
              onChange={setCode}
              height={300}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setModalVisible(false)
                setEditingStrategy(null)
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingStrategy ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default StrategyLibrary
