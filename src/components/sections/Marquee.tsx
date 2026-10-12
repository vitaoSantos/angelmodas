import type { CSSProperties } from 'react'

const words = ['Vestidos', 'Blusas', 'Tricô', 'Conjuntos', 'Moda fitness', 'Calças', 'Saias', 'Linho', 'Novidades toda semana']

function Band({ reverse = false, className = '', duration = 38 }: { reverse?: boolean; className?: string; duration?: number }) {
  return (
    <div className={`flex overflow-hidden py-4 ${className}`}>
      <ul className="marquee-track flex w-max shrink-0" data-reverse={reverse} style={{ '--marquee-duration': `${duration}s` } as CSSProperties}>
        {[...words, ...words].map((item, i) => (
          <li key={i} aria-hidden={i >= words.length} className="flex shrink-0 items-center gap-6 pr-6 font-display text-3xl italic tracking-tight sm:text-4xl">
            {item}
            <span aria-hidden className="not-italic text-lg">
              ✦
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Duas faixas cruzadas: uma de veludo do provador, outra dourada
export function Marquee() {
  return (
    <section aria-label="O que tem na loja" className="relative -mt-px overflow-hidden py-16 sm:py-24">
      <div className="relative">
        <Band reverse duration={46} className="absolute inset-x-[-5%] top-1/2 -translate-y-1/2 rotate-[3deg] bg-gradient-brand text-ink" />
        <Band className="bg-velvet relative -mx-[5%] -rotate-[2.5deg] text-gold-soft shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]" />
      </div>
    </section>
  )
}
