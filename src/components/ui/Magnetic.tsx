import { motion, useMotionValue, useSpring } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import { useFinePointer } from '../../hooks/useMediaQuery'

// O elemento é "puxado" na direção do mouse
export function Magnetic({ children, strength = 0.35, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const fine = useFinePointer()
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 })

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!fine) return
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength)
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength)
  }

  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div className={`inline-block ${className}`} style={{ x, y }} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </motion.div>
  )
}
