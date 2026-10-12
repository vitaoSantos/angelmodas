import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { easeOut } from './motion'

type Props = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  as?: 'div' | 'li'
}

// Aparece subindo quando entra na tela (opacity + transform: animado pelo navegador, fora da thread principal)
export function Reveal({ children, className, delay = 0, y = 28, as = 'div' }: Props) {
  const Component = as === 'li' ? motion.li : motion.div
  return (
    <Component
      className={className}
      initial={{ opacity: 0, transform: `translateY(${y}px)` }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: easeOut, delay }}
    >
      {children}
    </Component>
  )
}
