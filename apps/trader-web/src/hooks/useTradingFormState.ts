import React from 'react'

export type TradingFormPatch<T extends Record<string, any>> = Partial<T>

export function useTradingFormState<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = React.useState<T>(initialValues)
  const formApiRef = React.useRef<any>(null)

  const setFormApi = React.useCallback((api: any) => {
    formApiRef.current = api
  }, [])

  const reset = React.useCallback(() => {
    setValues(initialValues)
    formApiRef.current?.reset?.()
  }, [initialValues])

  const onChange = React.useCallback((patch: TradingFormPatch<T>) => {
    setValues((prev) => ({ ...prev, ...patch }))
  }, [])

  const setField = React.useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const prevValuesRef = React.useRef<T | null>(null)

  React.useEffect(() => {
    const formApi = formApiRef.current
    if (!formApi) return
    const prev = prevValuesRef.current
    Object.entries(values).forEach(([key, value]) => {
      if (!prev || prev[key] !== value) {
        formApi.setValue(key, value)
      }
    })
    prevValuesRef.current = values
  }, [values])

  return {
    values,
    setValues,
    onChange,
    setField,
    reset,
    formApiRef,
    setFormApi,
  }
}
