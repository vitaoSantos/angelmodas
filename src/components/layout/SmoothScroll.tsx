import { ReactLenis } from 'lenis/react'
import type { ReactNode } from 'react'
import { useReducedMotion } from '../../hooks/useMediaQuery'

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>

  return (
    <ReactLenis root options={{ autoRaf: true, lerp: 0.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
