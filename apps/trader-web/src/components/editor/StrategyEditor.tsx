import React, { useCallback, useState } from 'react'
import * as monaco from 'monaco-editor'
import { Modal, Button } from '@douyinfe/semi-ui-19'
import { IconMaximize } from '@douyinfe/semi-icons'
import { Editor } from './Editor'

interface StrategyEditorProps {
  value?: string
  onChange?: (value: string) => void
  height?: string | number
  readOnly?: boolean
  showMaximize?: boolean
}

export const StrategyEditor: React.FC<StrategyEditorProps> = ({
  value = '',
  onChange,
  height = 400,
  readOnly = false,
  showMaximize = true,
}) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const handleEditorMount = useCallback((_editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    // 注册自定义 DSL 语言
    monacoInstance.languages.register({ id: 'hquant-dsl' })

    // 定义语法高亮规则
    monacoInstance.languages.setMonarchTokensProvider('hquant-dsl', {
      keywords: [
        'LET', 'IF', 'THEN', 'OR', 'AND', 'NOT',
        'BUY', 'SELL', 'HOLD',
        'VEC_STORE', 'NORMALIZE', 'SIMILARITY',
      ],
      operators: [
        '=', '==', '!=', '<', '>', '<=', '>=',
        '!', '@', '(', ')', ',',
      ],
      tokenizer: {
        root: [
          // 关键字
          [/\b(LET|IF|THEN|OR|AND|NOT|BUY|SELL|HOLD)\b/i, 'keyword'],
          
          // 函数调用
          [/[a-zA-Z_][a-zA-Z0-9_]*(?=\()/, 'function'],
          
          // 标识符和序列引用
          [/[a-zA-Z_][a-zA-Z0-9_]*(@[a-zA-Z0-9_]+)?/, 'variable'],
          
          // 数字
          [/-?\d+(\.\d+)?/, 'number'],
          
          // 字符串
          [/"([^"\\]|\\.)*"/, 'string'],
          
          // 操作符
          [/[=!<>]=?|[@(),]/, 'operator'],
          
          // 空白
          [/[ \t\r\n]+/, 'white'],
        ],
      },
    })

    // 定义主题
    monacoInstance.editor.defineTheme('hquant-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
      },
    })

    // 配置自动补全
    monacoInstance.languages.registerCompletionItemProvider('hquant-dsl', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions: monaco.languages.CompletionItem[] = [
          // 关键字
          {
            label: 'LET',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: 'LET ${1:var} = ${2:value}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '定义变量',
            detail: '变量定义',
            range,
          },
          {
            label: 'IF',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: 'IF ${1:condition} THEN ${2:action}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '条件判断',
            detail: '条件语句',
            range,
          },
          {
            label: 'THEN',
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: 'THEN ',
            documentation: '条件满足时执行',
            range,
          },
          {
            label: 'AND',
            kind: monacoInstance.languages.CompletionItemKind.Operator,
            insertText: 'AND ',
            documentation: '逻辑与',
            range,
          },
          {
            label: 'OR',
            kind: monacoInstance.languages.CompletionItemKind.Operator,
            insertText: 'OR ',
            documentation: '逻辑或',
            range,
          },
          {
            label: 'NOT',
            kind: monacoInstance.languages.CompletionItemKind.Operator,
            insertText: 'NOT ',
            documentation: '逻辑非',
            range,
          },
          // 动作
          {
            label: 'BUY',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'BUY',
            documentation: '买入信号',
            detail: '交易动作',
            range,
          },
          {
            label: 'SELL',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'SELL',
            documentation: '卖出信号',
            detail: '交易动作',
            range,
          },
          {
            label: 'HOLD',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'HOLD',
            documentation: '持有信号',
            detail: '交易动作',
            range,
          },
          // 技术指标 - 移动平均
          {
            label: 'SMA',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'SMA(${1:close}, ${2:20})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '简单移动平均线 (Simple Moving Average)\n参数:\n  field: 字段 (open/high/low/close/volume)\n  period: 周期',
            detail: '技术指标',
            range,
          },
          {
            label: 'EMA',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'EMA(${1:close}, ${2:12})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '指数移动平均线 (Exponential Moving Average)\n参数:\n  field: 字段 (open/high/low/close/volume)\n  period: 周期',
            detail: '技术指标',
            range,
          },
          // 技术指标 - 波动率
          {
            label: 'STDDEV',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'STDDEV(${1:close}, ${2:20})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '标准差 (Standard Deviation)\n参数:\n  field: 字段 (open/high/low/close/volume)\n  period: 周期',
            detail: '技术指标',
            range,
          },
          {
            label: 'BOLL',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'BOLL(${1:20}, ${2:2.0})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '布林带 (Bollinger Bands)\n参数:\n  period: 周期\n  k: 标准差倍数\n返回: {mid, upper, lower}',
            detail: '技术指标',
            range,
          },
          // 技术指标 - 动量
          {
            label: 'RSI',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'RSI(${1:14})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '相对强弱指标 (Relative Strength Index)\n参数:\n  period: 周期 (通常为14)\n返回: 0-100之间的值',
            detail: '技术指标',
            range,
          },
          {
            label: 'MACD',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'MACD(${1:12}, ${2:26}, ${3:9})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'MACD指标 (Moving Average Convergence Divergence)\n参数:\n  fast: 快线周期 (通常为12)\n  slow: 慢线周期 (通常为26)\n  signal: 信号线周期 (通常为9)\n返回: {macd, signal, hist}',
            detail: '技术指标',
            range,
          },
          // 向量和相似度
          {
            label: 'VEC_STORE',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'VEC_STORE("${1:store_name}")',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '向量存储引用\n参数:\n  name: 存储名称（字符串）\n用于 SIMILARITY 函数',
            detail: '向量函数',
            range,
          },
          {
            label: 'NORMALIZE',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'NORMALIZE(${1:close}, ${2:30}, method="${3:minmax}")',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '向量归一化\n参数:\n  series: 序列 (close/open/high/low/volume)\n  length: 向量长度\n  method: 归一化方法 (minmax/zscore/l2/none)\n返回: 归一化后的向量',
            detail: '向量函数',
            range,
          },
          {
            label: 'SIMILARITY',
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: 'SIMILARITY(VEC_STORE("${1:store}"), NORMALIZE(${2:close}, ${3:30}), method="${4:cosine}", threshold=${5:0.8})',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '向量相似度计算\n参数:\n  store: 向量存储 (VEC_STORE)\n  vector: 查询向量 (NORMALIZE)\n  method: 相似度方法 (cosine/euclidean/manhattan)\n  threshold: 相似度阈值\n返回: 相似度分数',
            detail: '向量函数',
            range,
          },
          // 字段引用
          {
            label: 'open',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'open',
            documentation: '开盘价',
            detail: 'K线字段',
            range,
          },
          {
            label: 'high',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'high',
            documentation: '最高价',
            detail: 'K线字段',
            range,
          },
          {
            label: 'low',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'low',
            documentation: '最低价',
            detail: 'K线字段',
            range,
          },
          {
            label: 'close',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'close',
            documentation: '收盘价',
            detail: 'K线字段',
            range,
          },
          {
            label: 'volume',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'volume',
            documentation: '成交量',
            detail: 'K线字段',
            range,
          },
          {
            label: 'buy_volume',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'buy_volume',
            documentation: '主动买入量',
            detail: 'K线字段',
            range,
          },
          // 周期引用示例
          {
            label: 'close@4h',
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: 'close@${1:4h}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '引用指定周期的收盘价\n示例: close@4h, close@1d',
            detail: '周期引用',
            range,
          },
          // 示例策略
          {
            label: 'RSI策略示例',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: [
              'LET rsi = RSI(14)',
              'IF rsi < 30 THEN BUY',
              'IF rsi > 70 THEN SELL',
            ].join('\n'),
            documentation: 'RSI超买超卖策略示例',
            detail: '策略模板',
            range,
          },
          {
            label: 'MACD策略示例',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: [
              'LET macd = MACD(12, 26, 9)',
              'IF macd.hist > 0 AND macd.macd > macd.signal THEN BUY',
              'IF macd.hist < 0 THEN SELL',
            ].join('\n'),
            documentation: 'MACD金叉死叉策略示例',
            detail: '策略模板',
            range,
          },
          {
            label: '均线交叉策略示例',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: [
              'LET ma_fast = EMA(close, 12)',
              'LET ma_slow = EMA(close, 26)',
              'IF ma_fast > ma_slow THEN BUY',
              'IF ma_fast < ma_slow THEN SELL',
            ].join('\n'),
            documentation: '快慢均线交叉策略示例',
            detail: '策略模板',
            range,
          },
          {
            label: '布林带策略示例',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: [
              'LET boll = BOLL(20, 2.0)',
              'IF close < boll.lower THEN BUY',
              'IF close > boll.upper THEN SELL',
            ].join('\n'),
            documentation: '布林带突破策略示例',
            detail: '策略模板',
            range,
          },
          {
            label: '向量相似度策略示例',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: [
              'LET pattern = NORMALIZE(close, 30, method="minmax")',
              'LET similarity = SIMILARITY(VEC_STORE("bullish_patterns"), pattern, method="cosine", threshold=0.85)',
              'IF similarity > 0.85 THEN BUY',
            ].join('\n'),
            documentation: '基于向量相似度的模式识别策略',
            detail: '策略模板',
            range,
          },
        ]

        return { suggestions }
      },
    })

    // 应用主题
    monacoInstance.editor.setTheme('hquant-theme')
  }, [])

  return (
    <>
      <div style={{ position: 'relative' }}>
        {showMaximize && (
          <Button
            icon={<IconMaximize />}
            size="small"
            className="monaco-editor-maximize-btn"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              opacity: 0.7,
            }}
            onClick={() => setIsMaximized(true)}
            title="最大化编辑器"
          />
        )}
        <Editor
          value={value}
          onChange={onChange}
          language="hquant-dsl"
          theme="hquant-theme"
          height={height}
          readOnly={readOnly}
          onMount={handleEditorMount}
        />
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>策略代码编辑器</span>
          </div>
        }
        visible={isMaximized}
        onCancel={() => setIsMaximized(false)}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setIsMaximized(false)}>
              关闭
            </Button>
          </div>
        }
        width="95vw"
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, height: 'calc(90vh - 120px)' }}
      >
        <Editor
          value={value}
          onChange={onChange}
          language="hquant-dsl"
          theme="hquant-theme"
          height="100%"
          readOnly={readOnly}
          onMount={handleEditorMount}
        />
      </Modal>
    </>
  )
}
