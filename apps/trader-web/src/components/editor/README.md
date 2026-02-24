# Monaco Editor 组件

基于 Monaco Editor 的代码编辑器组件，支持自定义 DSL 语法高亮和智能提示。

## 组件说明

### Editor (基础组件)

通用的 Monaco Editor 封装组件，支持多种语言。

```tsx
import { Editor } from '@/components/editor'

<Editor
  value={code}
  onChange={setCode}
  language="javascript"
  theme="vs-dark"
  height={400}
/>
```

#### Props

- `value?: string` - 编辑器内容（受控）
- `defaultValue?: string` - 默认内容
- `language?: string` - 语言类型（默认: 'javascript'）
- `theme?: string` - 主题（默认: 'vs-dark'）
- `height?: string | number` - 高度（默认: 400）
- `width?: string | number` - 宽度（默认: '100%'）
- `readOnly?: boolean` - 只读模式
- `options?: monaco.editor.IStandaloneEditorConstructionOptions` - Monaco 编辑器配置
- `onChange?: (value: string) => void` - 内容变化回调
- `onMount?: (editor, monaco) => void` - 编辑器挂载回调

### StrategyEditor (业务组件)

专门用于策略代码编辑的组件，支持 HQuant DSL 语法。

```tsx
import { StrategyEditor } from '@/components/editor'

<StrategyEditor
  value={strategyCode}
  onChange={setStrategyCode}
  height={400}
  showMaximize={true}
/>
```

#### Props

- `value?: string` - 编辑器内容（受控）
- `onChange?: (value: string) => void` - 内容变化回调
- `height?: string | number` - 高度（默认: 400）
- `readOnly?: boolean` - 只读模式
- `showMaximize?: boolean` - 是否显示最大化按钮（默认: true）

#### 特性

0. **最大化编辑**
   - 点击右上角最大化按钮，编辑器以 Modal 形式全屏显示
   - 提供更大的编辑空间，方便编写复杂策略
   - 支持通过 `showMaximize` prop 控制是否显示最大化按钮

1. **自定义 DSL 语法高亮**
   - 关键字: LET, IF, THEN, OR, AND, NOT, BUY, SELL, HOLD
   - 函数调用识别
   - 变量和序列引用（支持 @ 语法）
   - 数字、字符串、操作符

2. **智能提示 (IntelliSense)**
   - 关键字提示
   - 技术指标函数提示（SMA, EMA, RSI, MACD, BOLL, STDDEV）
   - K线字段提示（open, high, low, close, volume, buy_volume）
   - 周期引用提示（如 close@4h）
   - 策略模板（RSI、MACD、均线交叉、布林带）

3. **自定义主题**
   - 基于 vs-dark 的深色主题
   - 针对 DSL 语法优化的配色方案

#### DSL 语法示例

```
LET rsi = RSI(14)
IF rsi < 30 THEN BUY
IF rsi > 70 THEN SELL
```

```
LET macd = MACD(12, 26, 9)
IF macd.hist > 0 AND macd.macd > macd.signal THEN BUY
IF macd.hist < 0 THEN SELL
```

```
LET ma_fast = EMA(close@4h, 12)
LET ma_slow = EMA(close@4h, 26)
IF ma_fast > ma_slow THEN BUY
IF ma_fast < ma_slow THEN SELL
```

**向量相似度策略**：
```
LET pattern = NORMALIZE(close, 30, method="minmax")
LET similarity = SIMILARITY(VEC_STORE("bullish_patterns"), pattern, method="cosine", threshold=0.85)
IF similarity > 0.85 THEN BUY
```

## 技术实现

### ESM 按需引入

使用 Monaco Editor 的 ESM 模块，减少打包体积：

```typescript
import * as monaco from 'monaco-editor'
```

### Worker 配置

通过 `self.MonacoEnvironment` 配置 Web Worker，支持语法检查和智能提示：

```typescript
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    // 根据语言类型返回对应的 worker
    return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' })
  },
}
```

### Vite 配置

在 `vite.config.ts` 中添加 Monaco Editor 优化配置：

```typescript
optimizeDeps: {
  include: ['monaco-editor'],
}
```

## 支持的技术指标

### 移动平均
- `SMA(field, period)` - 简单移动平均线
- `EMA(field, period)` - 指数移动平均线

### 波动率
- `STDDEV(field, period)` - 标准差
- `BOLL(period, k)` - 布林带，返回 {mid, upper, lower}

### 动量
- `RSI(period)` - 相对强弱指标
- `MACD(fast, slow, signal)` - MACD指标，返回 {macd, signal, hist}

### 向量和相似度
- `VEC_STORE(name)` - 向量存储引用，用于相似度计算
- `NORMALIZE(series, length, method)` - 向量归一化
  - series: 序列字段 (close/open/high/low/volume)
  - length: 向量长度
  - method: 归一化方法 (minmax/zscore/l2/none)
- `SIMILARITY(store, vector, method, threshold)` - 向量相似度计算
  - store: 向量存储 (VEC_STORE)
  - vector: 查询向量 (NORMALIZE)
  - method: 相似度方法 (cosine/euclidean/manhattan)
  - threshold: 相似度阈值
  - 返回: 相似度分数

## 注意事项

1. Monaco Editor 需要 Web Worker 支持，确保浏览器环境支持
2. 首次加载可能需要下载 worker 文件，建议显示加载状态
3. 编辑器实例会在组件卸载时自动销毁
4. 使用受控模式时，避免频繁更新 value 导致性能问题
