import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TbArrowRight, TbHanger } from 'react-icons/tb'
import { useIntro } from '../../context/IntroContext'
import { useSheet } from '../../context/SheetContext'
import { useSiteData } from '../../context/SiteDataContext'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { coverUrl, priceLabel } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { useScrollTo } from '../layout/Navbar'
import { LogoMark } from '../ui/Logo'
import { Magnetic } from '../ui/Magnetic'
import { easeOut } from '../ui/motion'
import { SplitText } from '../ui/SplitText'

// Capa do site: as fotos reais das peças, como uma revista. As novidades passam sozinhas
// (uma cortina revela a próxima foto) e a etiqueta abre a ficha da peça.
// No celular a foto ocupa a tela inteira, como um story; no computador, fica ao lado do título.
const SLIDE_MS = 5600
const MAX_SLIDES = 6

export function Hero() {
  const { catalog, loaded } = useSiteData()
  const { introDone, markReady } = useIntro()
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const inView = useInView(section)
  const slides = useMemo(() => catalog.filter((p) => p.photos.length).slice(0, MAX_SLIDES), [catalog])
  const [index, setIndex] = useState(0)
  const current = slides.length ? slides[index % slides.length] : null

  // a tela de carregamento espera a primeira foto (ou os dados, se não houver foto)
  useEffect(() => {
    if (loaded && !slides.length) markReady('hero')
  }, [loaded, slides.length, markReady])

  // passa sozinha enquanto a capa está na tela
  useEffect(() => {
    if (slides.length < 2 || !introDone || !inView || reduced) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [index, slides.length, introDone, inView, reduced])

  // deixa a próxima foto baixada antes da hora
  useEffect(() => {
    const next = slides[(index + 1) % Math.max(1, slides.length)]
    if (next && slides.length > 1) new Image().src = coverUrl(next, 'full')
  }, [index, slides])

  const go = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length)

  return (
    <section id="inicio" ref={section} aria-label="Abertura" className="relative">
      {desktop ? (
        <div className="container-x grid min-h-[100svh] grid-cols-[1.05fr_1fr] items-center gap-14 pb-16 pt-28">
          <Title compact={false} />
          {current ? (
            <Collage slides={slides} index={index % slides.length} onReady={() => markReady('hero')} onPick={setIndex} />
          ) : (
            <Placeholder />
          )}
        </div>
      ) : (
        <div className="relative h-[100svh] min-h-[34rem] overflow-hidden">
          {current ? (
            <FullBleed slides={slides} index={index % slides.length} onReady={() => markReady('hero')} onStep={go} />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-velvet opacity-60">
              <LogoMark className="h-[45vh] w-auto opacity-40" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-ink via-ink/75 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 pb-10">
            <div className="container-x">
              {current && <SlideTag product={current} />}
              <Title compact />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Title({ compact }: { compact: boolean }) {
  const { introDone } = useIntro()
  const scrollTo = useScrollTo()
  const fade = (delay: number) => ({
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: introDone ? { opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } } : { opacity: 0, transform: 'translateY(20px)' },
    transition: { duration: 0.9, ease: easeOut, delay },
  })
  return (
    <div className={compact ? 'pointer-events-auto' : ''}>
      <motion.p {...fade(0)} className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
        <span aria-hidden className="h-px w-10 bg-gradient-brand" />
        Moda feminina · Novidades toda semana
      </motion.p>
      <h1 className={`font-display leading-[0.9] tracking-tight ${compact ? 'text-[clamp(2.7rem,12vw,4rem)]' : 'text-[clamp(3.4rem,6.6vw,6.6rem)]'}`}>
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
      {!compact && (
        <motion.p {...fade(0.8)} className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
          Vestidos, blusas, tricôs, conjuntos e fitness escolhidos a dedo. Passe as peças na arara, monte o seu look e peça pelo WhatsApp.
        </motion.p>
      )}
      <motion.div {...fade(compact ? 0.6 : 1)} className={`flex flex-wrap items-center gap-3 ${compact ? 'mt-6' : 'mt-9 gap-4'}`}>
        <Magnetic>
          <button
            type="button"
            onClick={() => scrollTo('catalogo')}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3.5 font-semibold text-ink shadow-[0_0_44px_-10px_rgb(216_185_138/0.8)] transition-[filter] hover:brightness-110 sm:px-7 sm:py-4"
          >
            <TbHanger aria-hidden className="text-lg" />
            Ver a arara
            <TbArrowRight aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </Magnetic>
        <Magnetic>
          <button
            type="button"
            onClick={() => scrollTo('provador')}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink/30 px-6 py-3.5 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10 sm:px-7 sm:py-4"
          >
            Montar meu look
          </button>
        </Magnetic>
      </motion.div>
    </div>
  )
}

// Foto que entra com uma cortina de baixo para cima e um zoom lento (como uma vitrine se abrindo)
function PhotoReveal({ product, onReady, priority }: { product: Product; onReady?: () => void; priority?: boolean }) {
  const reduced = useReducedMotion()
  const photo = product.photos[0]
  return (
    <motion.div
      className="absolute inset-0"
      initial={reduced ? { opacity: 0 } : { clipPath: 'inset(100% 0% 0% 0%)' }}
      animate={reduced ? { opacity: 1 } : { clipPath: 'inset(0% 0% 0% 0%)' }}
      exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.5 } }}
      transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.img
        src={coverUrl(product, 'full')}
        alt={product.name}
        width={photo.width}
        height={photo.height}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={onReady}
        onError={onReady}
        className="h-full w-full object-cover"
        initial={{ scale: reduced ? 1 : 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: SLIDE_MS / 1000 + 1, ease: 'linear' }}
        style={{ backgroundImage: `url("${coverUrl(product, 'thumb')}")`, backgroundSize: 'cover' }}
      />
    </motion.div>
  )
}

// Barrinhas de progresso, como nos stories
function Progress({ count, index, onPick }: { count: number; index: number; onPick?: (i: number) => void }) {
  if (count < 2) return null
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick?.(i)}
          aria-label={`Foto ${i + 1} de ${count}`}
          aria-current={i === index}
          className="relative h-1 flex-1 overflow-hidden rounded-full bg-cream/25"
        >
          {i < index && <span className="absolute inset-0 bg-cream/90" />}
          {i === index && (
            <motion.span
              key={index}
              className="absolute inset-y-0 left-0 bg-cream/90"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// Etiqueta da peça da foto: nome, preço e o caminho para a ficha
function SlideTag({ product }: { product: Product }) {
  const { openProduct } = useSheet()
  const price = priceLabel(product)
  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={product.id}
        type="button"
        onClick={() => openProduct(product)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.45, ease: easeOut }}
        className="mb-5 inline-flex max-w-full items-center gap-3 rounded-full border border-cream/20 bg-ink/55 py-1.5 pl-4 pr-1.5 text-left text-sm text-cream backdrop-blur-sm"
      >
        <span className="truncate">{product.isNew && <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-soft">Novidade</span>}{product.name}</span>
        {price && <span className="shrink-0 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink">{price}</span>}
        <TbArrowRight aria-hidden className="mr-1.5 shrink-0" />
      </motion.button>
    </AnimatePresence>
  )
}

function FullBleed({ slides, index, onReady, onStep }: { slides: Product[]; index: number; onReady: () => void; onStep: (step: number) => void }) {
  return (
    <>
      <AnimatePresence initial={false}>
        <PhotoReveal key={slides[index].id} product={slides[index]} onReady={index === 0 ? onReady : undefined} priority={index === 0} />
      </AnimatePresence>
      {/* toque na metade esquerda volta, na direita avança */}
      <button type="button" aria-label="Foto anterior" onClick={() => onStep(-1)} className="absolute inset-y-0 left-0 w-1/3" />
      <button type="button" aria-label="Próxima foto" onClick={() => onStep(1)} className="absolute inset-y-0 right-0 w-1/3" />
      <div className="absolute inset-x-0 top-[4.75rem] z-[1]">
        <div className="container-x">
          <Progress count={slides.length} index={index} onPick={(i) => onStep(i - index)} />
        </div>
      </div>
    </>
  )
}

function Collage({ slides, index, onReady, onPick }: { slides: Product[]; index: number; onReady: () => void; onPick: (i: number) => void }) {
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : null
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      {/* a próxima peça, atrás, como uma foto encostada */}
      {next && (
        <div className="absolute -right-8 top-10 aspect-[4/5] w-[46%] rotate-[5deg] overflow-hidden rounded-[1.5rem] opacity-70 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]">
          <img src={coverUrl(next, 'thumb')} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/35" />
        </div>
      )}
      <div className="border-gradient relative aspect-[4/5] max-h-[76svh] overflow-hidden rounded-[2rem] bg-ink-3 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]">
        <AnimatePresence initial={false}>
          <PhotoReveal key={slides[index].id} product={slides[index]} onReady={index === 0 ? onReady : undefined} priority={index === 0} />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/80 to-transparent" />
        <div className="absolute inset-x-5 top-5">
          <Progress count={slides.length} index={index} onPick={onPick} />
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <SlideTag product={slides[index]} />
        </div>
      </div>
    </div>
  )
}

function Placeholder() {
  return (
    <div className="relative mx-auto grid aspect-[4/5] w-full max-w-[30rem] place-items-center overflow-hidden rounded-[2rem] bg-velvet">
      <LogoMark className="h-1/2 w-auto opacity-60" />
    </div>
  )
}
