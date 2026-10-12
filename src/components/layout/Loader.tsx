import { useLenis } from 'lenis/react'
import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useIntro } from '../../context/IntroContext'
import { LogoMark } from '../ui/Logo'

// Tela de abertura: a cortina de veludo do provador. Enquanto o 3D é preparado por trás,
// o fio dourado desenha o manequim do logo e o contador vai a 100%. Quando tudo está pronto,
// a cortina abre para os lados.
// O contador é escrito direto no DOM e a cortina abre com transform (sem re-render a cada quadro).
const FILL_SECONDS = 1.7
const OPEN_MS = 1300

export function Loader() {
  const { showLoader, finishIntro, heroReady, scenesReady } = useIntro()
  const lenis = useLenis()
  const counter = useRef<HTMLSpanElement>(null)
  const [filled, setFilled] = useState(false)
  const [opening, setOpening] = useState(false)
  const [visible, setVisible] = useState(showLoader)
  const released = useRef(false)
  const filledAt = useRef(0)
  const heroReadyAt = useRef(0)

  useEffect(() => {
    if (!visible) return
    lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
  }, [visible, lenis])

  useEffect(() => {
    if (!showLoader) return
    let cancelled = false
    const controls = animate(0, 100, {
      duration: FILL_SECONDS,
      ease: [0.45, 0, 0.25, 1],
      onUpdate: (v) => {
        if (counter.current) counter.current.textContent = Math.round(v).toString().padStart(3, '0')
      },
    })
    Promise.all([controls, document.fonts.ready]).then(() => {
      if (cancelled) return
      filledAt.current = performance.now()
      setFilled(true)
    })
    return () => {
      cancelled = true
      controls.stop()
    }
  }, [showLoader])

  useEffect(() => {
    if (heroReady && !heroReadyAt.current) heroReadyAt.current = performance.now()
  }, [heroReady])

  // Abre quando o contador chegou e as cenas estão prontas. Se o aparelho for lento, não segura
  // ninguém: no máximo 1,2 s depois da abertura pronta (o provador termina por trás) ou 3,5 s no total.
  useEffect(() => {
    if (!filled) return
    const go = () => {
      if (released.current) return
      released.current = true
      setOpening(true)
      setTimeout(finishIntro, 350)
      setTimeout(() => {
        setVisible(false)
        document.documentElement.style.overflow = ''
        lenis?.start()
      }, OPEN_MS)
    }
    const now = performance.now()
    const deadlines = [filledAt.current + 3500]
    if (heroReady) deadlines.push(heroReadyAt.current + 1200)
    if (scenesReady) deadlines.push(now + 150)
    const id = setTimeout(go, Math.max(0, Math.min(...deadlines) - now))
    return () => clearTimeout(id)
  }, [filled, heroReady, scenesReady, finishIntro, lenis])

  if (!visible) return null

  const half = 'bg-velvet absolute inset-y-0 w-[51%] shadow-[0_0_60px_rgb(0_0_0/0.6)] transition-transform ease-[cubic-bezier(0.76,0,0.24,1)]'

  return (
    <div className="fixed inset-0 z-[95]" aria-hidden={opening}>
      <div
        className={`${half} left-0 origin-left`}
        style={{ transform: opening ? 'translateX(-102%) scaleX(0.7)' : 'none', transitionDuration: `${OPEN_MS}ms` }}
      />
      <div
        className={`${half} right-0 origin-right`}
        style={{ transform: opening ? 'translateX(102%) scaleX(0.7)' : 'none', transitionDuration: `${OPEN_MS}ms` }}
      />

      {/* varão dourado com as argolas */}
      <div
        className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-[#f0d9ad] via-[#c79c62] to-[#7c5a2e] shadow-[0_4px_12px_rgb(0_0_0/0.5)] transition-opacity duration-700"
        style={{ opacity: opening ? 0 : 1 }}
      />

      <div
        className="relative flex h-full flex-col justify-between p-6 transition-opacity duration-500 sm:p-10"
        style={{ opacity: opening ? 0 : 1 }}
      >
        <div className="flex items-center justify-between pt-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold-soft/70">
          <span>Anghel Modas</span>
          <span>Provador</span>
        </div>

        <div className="flex flex-col items-center gap-5 text-center">
          <div className="logo-pop">
            <div className="sway">
              <LogoMark draw className="h-32 w-auto drop-shadow-[0_12px_30px_rgb(0_0_0/0.5)] sm:h-40" />
            </div>
          </div>
          <p className="font-script text-4xl text-gold-soft sm:text-5xl">{filled ? 'Pode entrar!' : 'Arrumando a vitrine…'}</p>
        </div>

        <div className="flex items-end justify-between">
          <span className="max-w-[12rem] text-xs font-semibold uppercase tracking-[0.24em] text-cream/60">Moda feminina</span>
          <span className="font-display text-6xl tabular-nums text-cream sm:text-8xl">
            <span ref={counter}>000</span>
            <span className="text-gradient">%</span>
          </span>
        </div>
      </div>
    </div>
  )
}
