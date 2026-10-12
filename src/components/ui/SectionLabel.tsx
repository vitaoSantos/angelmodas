import type { ReactNode } from 'react'

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold ${className}`}>
      <span aria-hidden className="h-px w-8 bg-gradient-brand" />
      {children}
    </p>
  )
}
