import { useId } from 'react'

// Marca: o manequim de costura do logo da loja, em traço dourado
export function LogoMark({ className = '', draw = false }: { className?: string; draw?: boolean }) {
  const id = useId()
  // `draw`: o traço se desenha sozinho (tela de abertura)
  const stroke = draw ? { pathLength: 1, className: 'thread-draw' } : {}
  return (
    <svg viewBox="0 0 48 64" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id={`${id}-g`} x1="8" y1="0" x2="40" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3e2c0" />
          <stop offset="0.55" stopColor="#d8b98a" />
          <stop offset="1" stopColor="#b88a52" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id}-g)`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="4.6" r="1.8" {...stroke} />
        <path d="M22.6 6.6h2.8v4.2h-2.8z" {...stroke} />
        <path
          d="M17 12.2c3-1.6 11-1.6 14 0c2.2 1.6 2.8 5.4 1.2 8.6c-1.6 3-2.6 6-2 9.2c.8 3 2.6 5.8 2.2 9H15.6c-.4-3.2 1.4-6 2.2-9c.6-3.2-.4-6.2-2-9.2c-1.6-3.2-1-7 1.2-8.6z"
          {...stroke}
        />
        <path d="M18.2 18.6c1.6 2.2 4 2.6 5.8.8c1.8 1.8 4.2 1.4 5.8-.8" strokeWidth="1.1" {...stroke} />
        <path d="M24 12v27" strokeWidth="0.9" strokeDasharray="1.4 1.6" />
        <path d="M15.4 39.2c2.4 1.4 14.8 1.4 17.2 0" {...stroke} />
        <path d="M24 40.6v13" {...stroke} />
        <path d="M24 53.6l-8 8M24 53.6l8 8M24 53.6v8.4" {...stroke} />
      </g>
    </svg>
  )
}

export function Logo({ className = '', mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {mark && <LogoMark className="h-[1.7em] w-auto" />}
      <span className="font-script text-[1.35em] leading-none text-gold-soft">
        Anghel <span className="text-gradient pr-1">Modas</span>
      </span>
    </span>
  )
}
