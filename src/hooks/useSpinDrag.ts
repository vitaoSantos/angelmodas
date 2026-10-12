import { useCallback, useEffect, useRef, type MutableRefObject, type PointerEvent } from 'react'
import type { Spin } from '../components/three/shared'

// Arrastar para girar o manequim (mouse ou dedo). O giro automático volta alguns segundos depois.
export function useSpinDrag(spin: MutableRefObject<Spin>) {
  const idleTimer = useRef(0)
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    window.clearTimeout(idleTimer.current)
    cleanup.current?.()
  }, [])

  return useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      const s = spin.current
      s.dragging = true
      s.auto = false
      window.clearTimeout(idleTimer.current)
      let lastX = e.clientX
      let lastT = performance.now()
      const width = e.currentTarget.clientWidth || 400
      const move = (ev: globalThis.PointerEvent) => {
        const now = performance.now()
        const dx = ev.clientX - lastX
        const angle = (dx / width) * Math.PI * 1.6
        s.angle += angle
        s.velocity = angle / Math.max(0.008, (now - lastT) / 1000)
        lastX = ev.clientX
        lastT = now
      }
      const up = () => {
        s.dragging = false
        if (performance.now() - lastT > 80) s.velocity = 0
        cleanup.current?.()
        idleTimer.current = window.setTimeout(() => (spin.current.auto = true), 6000)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      cleanup.current = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        cleanup.current = null
      }
    },
    [spin],
  )
}
