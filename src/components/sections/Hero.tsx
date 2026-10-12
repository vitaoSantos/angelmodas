import { motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react'
import { Component, lazy, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { TbArrowDown, TbArrowRight, TbHanger } from 'react-icons/tb'
import { useIntro } from '../../context/IntroContext'
import { useLook } from '../../context/LookContext'
import { useSiteData } from '../../context/SiteDataContext'
import { fabricById } from '../../data/catalog'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { canWear, showcaseLooks } from '../../lib/products'
import { useScrollTo } from '../layout/Navbar'
import { LogoMark } from '../ui/Logo'
import { Magnetic } from '../ui/Magnetic'
import { easeOut } from '../ui/motion'
import { SplitText } from '../ui/SplitText'

const HeroStage = lazy(() => import('../three/HeroStage'))

// Mesmos marcos e listas da cena 3D (copiados para não baixar o three.js só por causa deles)
const STORY = { explode: [0.1, 0.27], fabric: [0.3, 0.5], color: [0.53, 0.77], spin: [0.8, 0.97] } as const
const STORY_FABRICS = ['linho', 'tricot', 'canelado', 'cetim', 'renda']
const STORY_COLORS = [
  { hex: '#3d2318', name: 'Chocolate' },
  { hex: '#efe18f', name: 'Manteiga' },
  { hex: '#c48a84', name: 'Rosé' },
  { hex: '#a9533a', name: 'Terracota' },
  { hex: '#a8c5e6', name: 'Azul bebê' },
  { hex: '#161414', name: 'Preto' },
]

// Se o WebGL falhar, fica o manequim do logo no lugar do 3D
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const steps = [
  {
    range: STORY.explode,
    n: '01',
    kicker: 'A peça',
    title: 'Escolhida a dedo.',
    text: 'Cada peça passa pela nossa mão antes de chegar na vitrine: tecido bom, costura caprichada e modelagem que veste bem.',
  },
  {
    range: STORY.fabric,
    n: '02',
    kicker: 'O tecido',
    title: 'Sinta o toque.',
    text: 'Linho fresquinho, tricô macio, canelado que abraça, cetim que brilha. Tem tecido para cada momento do seu dia.',
  },
  {
    range: STORY.color,
    n: '03',
    kicker: 'A cor',
    title: 'As cores da estação.',
    text: 'Dos neutros que combinam com tudo aos tons que iluminam o rosto: cada peça vem em várias cores.',
  },
  {
    range: STORY.spin,
    n: '04',
    kicker: 'O look',
    title: 'Agora é a sua vez.',
    text: 'Escolha as peças no catálogo e veja tudo vestido no manequim 3D, girando, antes de pedir.',
  },
] as const

function StepExtra({ progress, n }: { progress: MotionValue<number>; n: string }) {
  const [index, setIndex] = useState(0)
  const range = n === '02' ? STORY.fabric : STORY.color
  const count = n === '02' ? STORY_FABRICS.length : STORY_COLORS.length
  useMotionValueEvent(progress, 'change', (v) => {
    const t = Math.min(1, Math.max(0, (v - range[0]) / (range[1] - range[0])))
    setIndex(n === '02' ? Math.min(count - 1, Math.floor(t * count)) : Math.min(count - 1, Math.round(t * (count - 1))))
  })
  if (n === '02') {
    return (
      <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tecidos">
        {STORY_FABRICS.map((id, i) => (
          <li
            key={id}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors duration-300 ${
              i === index ? 'border-gold bg-gold/15 text-cream' : 'border-line text-muted'
            }`}
          >
            {fabricById(id).label}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="mt-6 flex flex-wrap items-center gap-3" aria-label="Cores">
      {STORY_COLORS.map((c, i) => (
        <li key={c.hex} className="flex flex-col items-center gap-1.5">
          <span
            className={`block size-9 rounded-full border-2 transition-transform duration-300 ${i === index ? 'scale-110 border-cream' : 'border-transparent'}`}
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${c.hex} 60%)` }}
          />
          <span className={`text-[11px] transition-colors ${i === index ? 'text-cream' : 'text-faint'}`}>{c.name}</span>
        </li>
      ))}
    </ul>
  )
}

function Step({ progress, step, last }: { progress: MotionValue<number>; step: (typeof steps)[number]; last: boolean }) {
  const [a, b] = step.range
  const opacity = useTransform(progress, last ? [a - 0.03, a + 0.02] : [a - 0.03, a + 0.02, b - 0.03, b], last ? [0, 1] : [0, 1, 1, 0])
  const y = useTransform(progress, [a - 0.03, a + 0.03], [40, 0])
  const pointerEvents = useTransform(opacity, (v) => (v > 0.5 ? 'auto' : 'none'))
  const scrollTo = useScrollTo()

  return (
    <motion.div style={{ opacity, y, pointerEvents }} className="absolute inset-x-0 bottom-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2">
      <div className="container-x pb-12 lg:pb-0">
        <div className="max-w-md">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.26em] text-gold">
            <span className="font-display text-2xl tracking-normal text-cream/40">{step.n}</span>
            {step.kicker}
          </p>
          <h2 className="mt-4 font-display text-[clamp(2.3rem,5.2vw,4rem)] leading-[1] tracking-tight">{step.title}</h2>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">{step.text}</p>
          {(step.n === '02' || step.n === '03') && <StepExtra progress={progress} n={step.n} />}
          {last && (
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => scrollTo('provador')}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-brand px-7 py-4 font-semibold text-ink transition-[filter] hover:brightness-110"
              >
                Entrar no provador
                <TbArrowDown aria-hidden className="transition-transform group-hover:translate-y-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo('catalogo')}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-7 py-4 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
              >
                Ver catálogo
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Intro({ progress }: { progress: MotionValue<number> }) {
  const { introDone } = useIntro()
  const scrollTo = useScrollTo()
  const opacity = useTransform(progress, [0, 0.07], [1, 0])
  const y = useTransform(progress, [0, 0.08], [0, -60])
  const pointerEvents = useTransform(opacity, (v) => (v > 0.5 ? 'auto' : 'none'))
  // opacity + transform: o navegador anima sozinho (WAAPI), sem disputar a thread com o 3D
  const fade = (delay: number) => ({
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: introDone ? { opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } } : { opacity: 0, transform: 'translateY(20px)' },
    transition: { duration: 0.9, ease: easeOut, delay },
  })

  return (
    <motion.div style={{ opacity, y, pointerEvents }} className="absolute inset-x-0 bottom-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2">
      <div className="container-x pb-24 lg:pb-0">
        <motion.p {...fade(0)} className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
          <span aria-hidden className="h-px w-10 bg-gradient-brand" />
          Moda feminina · Provador 3D
        </motion.p>
        <h1 className="max-w-3xl font-display text-[clamp(3rem,8.6vw,7.5rem)] leading-[0.9] tracking-tight">
          <SplitText text="Elegância que" play={introDone} delay={0.1} />
          <br />
          {/* a palavra em degradê sobe inteira: o degradê recortado no texto some se cada letra for animada */}
          <span className="inline-block overflow-hidden pb-[0.18em] align-bottom">
            <motion.span
              className="text-gradient inline-block pr-4 font-script text-[1.08em] leading-[1.15]"
              initial={{ transform: 'translateY(115%)' }}
              animate={introDone ? { transform: 'translateY(0%)', transitionEnd: { transform: 'none' } } : { transform: 'translateY(115%)' }}
              transition={{ duration: 1, ease: easeOut, delay: 0.45 }}
            >
              veste você.
            </motion.span>
          </span>
        </h1>
        <motion.p {...fade(0.8)} className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
          <span className="sm:hidden">Escolha as peças e veja tudo vestido no manequim 3D.</span>
          <span className="hidden sm:inline">
            Vestidos, blusas, tricôs, conjuntos e fitness escolhidos a dedo. Veja cada peça vestida no manequim 3D, monte o seu look e peça
            pelo WhatsApp.
          </span>
        </motion.p>
        <motion.div {...fade(1)} className="mt-7 flex flex-wrap items-center gap-3 sm:mt-9 sm:gap-4">
          <Magnetic>
            <button
              type="button"
              onClick={() => scrollTo('catalogo')}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3.5 font-semibold text-ink shadow-[0_0_44px_-10px_rgb(216_185_138/0.8)] transition-[filter] hover:brightness-110 sm:px-7 sm:py-4"
            >
              <TbHanger aria-hidden className="text-lg" />
              Ver catálogo
              <TbArrowRight aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </Magnetic>
          <Magnetic>
            <button
              type="button"
              onClick={() => scrollTo('provador')}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3.5 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10 sm:px-7 sm:py-4"
            >
              Montar meu look
            </button>
          </Magnetic>
        </motion.div>
      </div>
    </motion.div>
  )
}

function ScrollHint({ progress }: { progress: MotionValue<number> }) {
  const { introDone } = useIntro()
  const opacity = useTransform(progress, [0, 0.04], [1, 0])
  return (
    <motion.div style={{ opacity }} className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: introDone ? 1 : 0 }}
        transition={{ delay: 3.8, duration: 1 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="whitespace-nowrap font-script text-2xl text-cream/80">role para entrar na vitrine</span>
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="grid size-9 place-items-center rounded-full border border-line-strong text-gold"
        >
          <TbArrowDown aria-hidden />
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

function Rail({ progress }: { progress: MotionValue<number> }) {
  // scaleY em vez de height: não recalcula o layout da página a cada quadro
  const scaleY = useTransform(progress, [0.08, 1], [0, 1])
  return (
    <div aria-hidden className="absolute left-5 top-1/2 hidden h-56 -translate-y-1/2 items-stretch gap-3 min-[1360px]:flex">
      <div className="relative w-px bg-line-strong">
        <motion.div style={{ scaleY }} className="absolute inset-0 origin-top bg-gradient-to-b from-gold to-rose" />
      </div>
      <ol className="flex flex-col justify-between font-display text-xs text-cream/40">
        {steps.map((s) => (
          <li key={s.n}>{s.n}</li>
        ))}
      </ol>
    </div>
  )
}

export function Hero() {
  const section = useRef<HTMLElement>(null)
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const { introDone, markReady } = useIntro()
  const { showcase } = useSiteData()
  const { skin } = useLook()
  const looks = useMemo(() => showcaseLooks(showcase.filter(canWear), 6), [showcase])
  const onReady = useCallback(() => markReady('hero'), [markReady])
  const inView = useInView(section)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })

  const fallback = (
    <div className="grid h-full place-items-center lg:justify-end lg:pr-[12%]">
      <LogoMark className="h-[55vh] w-auto opacity-60" />
    </div>
  )

  return (
    <section id="inicio" ref={section} aria-label="Abertura" className="relative h-[480vh] lg:h-[560vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0" data-cursor="scene">
          <SceneBoundary fallback={fallback}>
            <Suspense fallback={null}>
              <HeroStage progress={scrollYProgress} looks={looks} play={introDone} reduced={reduced} mobile={!desktop} active={inView} onReady={onReady} skin={skin} />
            </Suspense>
          </SceneBoundary>
        </div>

        {/* garante a leitura do texto sobre o 3D */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(14_12_11/0.96)_0%,rgb(14_12_11/0.6)_34%,transparent_62%)] lg:bg-[radial-gradient(ellipse_70%_90%_at_10%_50%,rgb(14_12_11/0.9),transparent_70%)]"
        />

        <div className="pointer-events-none absolute inset-0">
          <Intro progress={scrollYProgress} />
          {steps.map((step, i) => (
            <Step key={step.n} progress={scrollYProgress} step={step} last={i === steps.length - 1} />
          ))}
        </div>

        {/* emenda suave com a seção seguinte */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink" />

        <Rail progress={scrollYProgress} />
        <ScrollHint progress={scrollYProgress} />
      </div>
    </section>
  )
}
