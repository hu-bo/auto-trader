import React, { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import './editor.css'

// 配置 Monaco Editor 的 worker
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    const baseUrl = 'https://unpkg.com/monaco-editor@0.55.1/esm/vs'
    if (label === 'json') {
      return new Worker(`${baseUrl}/language/json/json.worker.js`)
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(`${baseUrl}/language/css/css.worker.js`)
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(`${baseUrl}/language/html/html.worker.js`)
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(`${baseUrl}/language/typescript/ts.worker.js`)
    }
    return new Worker(`${baseUrl}/editor/editor.worker.js`)
  },
}

export interface EditorProps {
  value?: string
  defaultValue?: string
  language?: string
  theme?: string
  height?: string | number
  width?: string | number
  readOnly?: boolean
  options?: monaco.editor.IStandaloneEditorConstructionOptions
  onChange?: (value: string) => void
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: any) => void
}

export const Editor: React.FC<EditorProps> = ({
  value,
  defaultValue = '',
  language = 'javascript',
  theme = 'vs-dark',
  height = 400,
  width = '100%',
  readOnly = false,
  options = {},
  onChange,
  onMount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const subscriptionRef = useRef<monaco.IDisposable | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 创建编辑器实例
    const editor = monaco.editor.create(containerRef.current, {
      value: value ?? defaultValue,
      language,
      theme,
      readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: 'on',
      folding: true,
      ...options,
    })

    editorRef.current = editor

    // 监听内容变化
    if (onChange) {
      subscriptionRef.current = editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue()
        onChange(currentValue)
      })
    }

    // 调用 onMount 回调
    if (onMount) {
      onMount(editor, monaco)
    }

    // 清理函数
    return () => {
      subscriptionRef.current?.dispose()
      editor.dispose()
    }
  }, []) // 只在挂载时创建一次

  // 更新编辑器的值（受控模式）
  useEffect(() => {
    if (editorRef.current && value !== undefined) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== value) {
        editorRef.current.setValue(value)
      }
    }
  }, [value])

  // 更新只读状态
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly })
    }
  }, [readOnly])

  // 更新主题
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme)
    }
  }, [theme])

  return (
    <div
      ref={containerRef}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    />
  )
}
