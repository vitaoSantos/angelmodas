import { motion } from 'motion/react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { easeOut } from './motion'

type Props = {
  text: string
  className?: string
  delay?: number
  stagger?: number
  play?: boolean
}

// Revela o texto de baixo para cima: letra por letra no desktop e palavra por palavra no celular
export function SplitText({ text, className, delay = 0, stagger = 0.028, play = true }: Props) {
  const desktop = useIsDesktop()
  const words = text.split(' ')
  let index = 0

  const piece = (content: string, i: number, step: number) => (
    <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className="inline-block"
        initial={{ transform: 'translateY(115%)' }}
        animate={play ? { transform: 'translateY(0%)', transitionEnd: { transform: 'none' } } : { transform: 'translateY(115%)' }}
        transition={{ duration: 0.9, ease: easeOut, delay: delay + i * step }}
      >
        {content}
      </motion.span>
    </span>
  )

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
          {desktop ? [...word].map((char) => piece(char, index++, stagger)) : piece(word, wi, 0.07)}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}
