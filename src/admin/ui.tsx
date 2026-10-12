import { useEffect, type ReactNode } from 'react'
import type { AdminData } from '../lib/siteTypes'

// Peças comuns às abas do painel

export type PanelProps = {
  password: string
  data: AdminData
  // altera os dados já carregados (depois que a função confirmou a mudança)
  update: (change: (data: AdminData) => AdminData) => void
}

export const field =
  'w-full rounded-2xl border border-line bg-cream/[0.04] px-4 py-3 text-sm text-cream placeholder:text-faint outline-none transition-colors focus:border-gold/70 focus:bg-gold/[0.06] disabled:opacity-50'

export function PanelHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[clamp(2.2rem,4.4vw,3.4rem)] leading-tight tracking-tight">{title}</h1>
      <div className="mt-2 text-muted">{children}</div>
    </div>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-red-400/30 bg-red-400/5 text-red-200' : 'border-mint/30 bg-mint/5 text-mint'
      }`}
    >
      {children}
    </p>
  )
}

export function Switch({ on, onToggle, label, disabled = false }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="relative block h-7 w-12 shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`absolute inset-0 rounded-full transition-colors ${on ? 'bg-gradient-brand' : 'bg-cream/15'}`} />
      <span
        className={`absolute left-1 top-1 size-5 rounded-full bg-cream shadow transition-transform duration-300 ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}

// Pede confirmação antes de fechar a aba com algo por salvar ou enviando
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // navegadores mais antigos
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
}
