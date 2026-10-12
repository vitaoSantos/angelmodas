import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)')
