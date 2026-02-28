import { useCallback } from 'react'
import { useNavigate, useSearchParams, type NavigateOptions } from 'react-router-dom'

/**
 * A wrapper around useNavigate that preserves current search params (e.g. exchangeId)
 * when navigating to a new path.
 */
export function useNavigateKeepParams() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  return useCallback(
    (to: string, options?: NavigateOptions) => {
      const params = searchParams.toString()
      const separator = to.includes('?') ? '&' : '?'
      const path = params ? `${to}${separator}${params}` : to
      navigate(path, options)
    },
    [navigate, searchParams],
  )
}
