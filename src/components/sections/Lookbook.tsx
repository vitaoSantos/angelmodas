import { useLenis } from 'lenis/react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { TbArrowLeft, TbArrowRight, TbBrandInstagram, TbPlus, TbX } from 'react-icons/tb'
import { useSiteData } from '../../context/SiteDataContext'
import { brand, instagramUrl } from '../../data/brand'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { muralUrl } from '../../lib/api'
import { toColumns } from '../../lib/masonry'
import { eventDateLabel, type MuralPhoto } from '../../lib/siteTypes'
import { easeOut } from '../ui/motion'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

// Uma foto do mural de clientes, enviada pelo painel (/admin)
type MuralItem = {
  key: string
  thumb: string
  full: string
  width: number
  height: number
  title: string
  note: string
  alt: string
}

function fromPanel(photo: MuralPhoto): MuralItem {
  // o que tiver primeiro (título, look, data) vira a legenda escrita à mão; o resto vai embaixo
  const parts = [photo.title, photo.look, eventDateLabel(photo.date)].filter(Boolean)
  return {
    key: photo.id,
    thumb: muralUrl(photo.id, 'thumb'),
    full: muralUrl(photo.id, 'full'),
    width: photo.width,
    height: photo.height,
    title: parts[0] ?? 'Linda de Anghel',
    note: parts.slice(1).join(' · '),
    alt: [`Cliente da ${brand.name}`, photo.look && `com ${photo.look}`, photo.title].filter(Boolean).join(', '),
  }
}

const PAGE = 9
// inclinação de cada foto no mural, em graus (repete a cada seis)
const TILTS = [-2.2, 1.6, -1.2, 2.3, -1.7, 1.1]

// altura relativa de cada foto no mural: a foto + moldura e legenda
const photoHeight = (item: MuralItem) => item.height / item.width + 0.3

function Polaroid({ item, index, onOpen }: { item: MuralItem; index: number; onOpen: () => void }) {
  return (
    <motion.li
      initial={{ opacity: 0, transform: 'translateY(40px)' }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: easeOut, delay: (index % 3) * 0.08 }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver de perto: ${item.title}`}
        style={{ '--tilt': `${TILTS[index % TILTS.length]}deg` } as CSSProperties}
        className="group relative block w-full rotate-(--tilt) rounded-md bg-[#f7efe4] p-2 pb-3 text-left shadow-[0_24px_40px_-20px_rgb(0_0_0/0.85),0_2px_6px_rgb(0_0_0/0.35)] transition-[rotate,translate] duration-500 ease-out hover:-translate-y-1.5 hover:rotate-0 focus-visible:rotate-0 sm:p-3.5 sm:pb-5"
      >
        <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 -rotate-3 rounded-[2px] bg-gold-soft/70 shadow-sm sm:-top-3 sm:h-6 sm:w-20" />
        <span className="block overflow-hidden rounded-[3px] bg-ink-3" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
          <Thumb item={item} />
        </span>
        <span className="mt-2 block px-0.5 font-script text-xl leading-none text-[#2a1d16] sm:mt-3 sm:px-1 sm:text-[1.6rem]">{item.title}</span>
        {item.note && (
          <span className="mt-1.5 block px-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a6a48] sm:mt-2 sm:px-1 sm:text-[11px] sm:tracking-[0.14em]">
            {item.note}
          </span>
        )}
      </button>
    </motion.li>
  )
}

// Miniatura do mural. Se a foto falhar (rede instável), tenta mais uma vez; depois fica só o fundo, sem ícone quebrado.
function Thumb({ item }: { item: MuralItem }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={attempt ? `${item.thumb}${item.thumb.includes('?') ? '&' : '?'}de-novo=${attempt}` : item.thumb}
      alt={item.alt}
      width={item.width}
      height={item.height}
      loading="lazy"
      decoding="async"
      onError={() => (attempt ? setFailed(true) : window.setTimeout(() => setAttempt(1), 1500))}
      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
    />
  )
}

function FullImage({ item }: { item: MuralItem }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={item.full}
      alt={item.alt}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}

function Lightbox({ items, index, onClose, onStep }: { items: MuralItem[]; index: number; onClose: () => void; onStep: (dir: 1 | -1) => void }) {
  const lenis = useLenis()
  const item = items[index]

  useEffect(() => {
    lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onStep(1)
      if (e.key === 'ArrowLeft') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
      lenis?.start()
    }
  }, [lenis, onClose, onStep])

  // já baixa a anterior e a próxima, para a troca ser imediata
  useEffect(() => {
    for (const dir of [1, -1]) {
      const next = items[(index + dir + items.length) % items.length]
      if (next && next !== item) new Image().src = next.full
    }
  }, [items, index, item])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-[90] flex flex-col bg-ink/95 p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-sm text-muted">
          <span className="font-script text-2xl text-cream">{item.title}</span>
          {item.note && <span className="block truncate sm:ml-3 sm:inline">{item.note}</span>}
        </p>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-xl">
          <TbX aria-hidden />
        </button>
      </div>
      {/* a foto ocupa o maior espaço possível sem cortar; a miniatura já carregada aparece enquanto a grande chega */}
      <div className="relative my-4 min-h-0 flex-1 [container-type:size]">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.key}
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: easeOut }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="overflow-hidden rounded-3xl bg-ink-3 bg-cover bg-center shadow-2xl"
              style={{
                aspectRatio: `${item.width} / ${item.height}`,
                width: `min(100cqw, 100cqh * ${(item.width / item.height).toFixed(4)})`,
                backgroundImage: `url("${item.thumb}")`,
              }}
            >
              <FullImage item={item} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onStep(-1)} aria-label="Foto anterior" className="grid size-12 place-items-center rounded-full border border-line-strong text-xl hover:border-gold">
            <TbArrowLeft aria-hidden />
          </button>
          <span className="w-20 text-center text-sm tabular-nums text-muted">
            {index + 1} / {items.length}
          </span>
          <button type="button" onClick={() => onStep(1)} aria-label="Próxima foto" className="grid size-12 place-items-center rounded-full border border-line-strong text-xl hover:border-gold">
            <TbArrowRight aria-hidden />
          </button>
        </div>
      )}
    </motion.div>
  )
}

export function Lookbook() {
  const { photos } = useSiteData()
  const items = useMemo(() => photos.map(fromPanel), [photos])
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((dir: 1 | -1) => setOpen((i) => (i === null ? i : (i + dir + items.length) % items.length)), [items.length])

  const lg = useMediaQuery('(min-width: 1024px)')
  const visible = useMemo(() => items.slice(0, shown), [items, shown])
  // duas colunas já no celular, três no computador
  const count = Math.max(1, Math.min(lg ? 3 : 2, visible.length))
  const columns = useMemo(() => toColumns(visible, count, photoHeight), [visible, count])
  const rest = items.length - visible.length

  return (
    <section id="clientes" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionLabel>Clientes</SectionLabel>
          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              Quem veste Anghel <span className="text-gradient font-script text-[1.1em]">brilha.</span>
            </h2>
            <p className="max-w-sm text-muted">
              O nosso mural de clientes: looks de verdade, do jeitinho que saíram da loja. Toque na foto para ver de perto.
            </p>
          </div>
        </Reveal>

        {items.length === 0 ? (
          <Reveal className="mt-14">
            <div className="grid place-items-center rounded-[2rem] border-2 border-dashed border-line-strong px-6 py-16 text-center">
              <p className="font-script text-4xl text-gold-soft">o mural está esperando você!</p>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Comprou na {brand.name}? Poste o seu look e marque {brand.instagram ? `@${brand.instagram}` : 'a loja'}: as fotos mais lindas
                entram aqui.
              </p>
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-sm font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
                >
                  <TbBrandInstagram aria-hidden className="text-lg" /> @{brand.instagram}
                </a>
              )}
            </div>
          </Reveal>
        ) : (
          <>
            {/* cada coluna é uma lista; a ordem de leitura segue a das fotos, das mais novas para as mais antigas */}
            <div
              className={`mx-auto mt-16 grid items-start gap-x-4 sm:gap-x-10 ${count === 1 ? 'max-w-md' : count === 2 && lg ? 'max-w-4xl' : ''}`}
              style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
            >
              {columns.map((column, c) => (
                <ul key={c} className="grid gap-7 sm:gap-12">
                  {column.items.map(({ item, index }) => (
                    <Polaroid key={item.key} item={item} index={index} onOpen={() => setOpen(index)} />
                  ))}
                </ul>
              ))}
            </div>

            {rest > 0 && (
              <div className="mt-14 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="inline-flex items-center gap-2 rounded-full border border-line-strong px-7 py-3.5 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
                >
                  <TbPlus aria-hidden /> Ver mais fotos <span className="text-muted">({rest})</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>{open !== null && items[open] && <Lightbox items={items} index={open} onClose={close} onStep={step} />}</AnimatePresence>
    </section>
  )
}
