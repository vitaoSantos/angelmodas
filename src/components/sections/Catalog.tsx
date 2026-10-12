import { AnimatePresence, motion, useInView } from 'motion/react'
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TbArrowLeft, TbArrowRight, TbHandFinger, TbLayoutGrid, TbHanger } from 'react-icons/tb'
import { useLook } from '../../context/LookContext'
import { useSiteData } from '../../context/SiteDataContext'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { priceLabel } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { newRackMotion, RACK_SPACING, type RackMotion } from '../three/shared'
import { easeOut } from '../ui/motion'
import { PieceThumb } from '../ui/PieceThumb'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'
import { ProductSheet } from './ProductSheet'

const RackStage = lazy(() => import('../three/RackStage'))

class RackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const ALL = 'tudo'
const NEW = 'novidades'

export function Catalog() {
  const { catalog, categories, settings, loaded } = useSiteData()
  const [filter, setFilter] = useState(ALL)
  const [view, setView] = useState<'arara' | 'lista'>('arara')
  const [open, setOpen] = useState<Product | null>(null)
  const [webgl] = useState(() => {
    try {
      return Boolean(document.createElement('canvas').getContext('webgl2'))
    } catch {
      return false
    }
  })

  const chips = useMemo(() => {
    const list = [{ id: ALL, label: 'Tudo', count: catalog.length }]
    const fresh = catalog.filter((p) => p.isNew).length
    if (fresh) list.push({ id: NEW, label: 'Novidades', count: fresh })
    for (const c of categories) {
      const count = catalog.filter((p) => p.category === c.id).length
      if (count) list.push({ id: c.id, label: c.label, count })
    }
    return list
  }, [catalog, categories])

  const products = useMemo(
    () => (filter === ALL ? catalog : filter === NEW ? catalog.filter((p) => p.isNew) : catalog.filter((p) => p.category === filter)),
    [catalog, filter],
  )
  const close = useCallback(() => setOpen(null), [])
  const showRack = view === 'arara' && webgl

  return (
    <section id="catalogo" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionLabel>Catálogo</SectionLabel>
          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              A arara está cheia de <span className="text-gradient font-script text-[1.1em]">novidades.</span>
            </h2>
            <p className="max-w-sm text-muted">
              Arraste para passar as peças e toque num cabide para ver de perto, escolher a cor e provar no manequim.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filtrar por categoria" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                aria-pressed={filter === c.id}
                className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                  filter === c.id ? 'bg-cream text-ink' : 'border border-line text-muted hover:border-line-strong hover:text-cream'
                }`}
              >
                {c.label} <span className={filter === c.id ? 'text-ink/55' : 'text-faint'}>{c.count}</span>
              </button>
            ))}
          </div>
          {webgl && (
            <div className="flex shrink-0 self-start rounded-full border border-line p-1 text-sm sm:self-auto">
              {(
                [
                  ['arara', 'Arara 3D', TbHanger],
                  ['lista', 'Lista', TbLayoutGrid],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors ${
                    view === id ? 'bg-gold/15 text-cream' : 'text-muted hover:text-cream'
                  }`}
                >
                  <Icon aria-hidden /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!loaded ? (
        <div aria-busy="true" className="mt-10 h-[68svh] min-h-[30rem] lg:h-[78svh]" />
      ) : products.length === 0 ? (
        <p className="container-x mt-10 text-muted">Nenhuma peça nesta categoria por enquanto.</p>
      ) : showRack ? (
        <RackView key={filter} products={products} onSelect={setOpen} showPrices={settings.showPrices} />
      ) : (
        <GridView products={products} onSelect={setOpen} />
      )}

      <AnimatePresence>{open && <ProductSheet key={open.id} product={open} onClose={close} />}</AnimatePresence>
    </section>
  )
}

function RackView({ products, onSelect, showPrices }: { products: Product[]; onSelect: (p: Product) => void; showPrices: boolean }) {
  const { skin } = useLook()
  const wrap = useRef<HTMLDivElement>(null)
  const motionRef = useRef<RackMotion>(newRackMotion())
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const near = useInView(wrap, { margin: '500px 0px', once: true })
  const visible = useInView(wrap)
  const [index, setIndex] = useState(0)

  // número da peça no centro (para o contador e o nome embaixo)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const i = Math.round(motionRef.current.current / RACK_SPACING)
      setIndex((current) => (current === i ? current : i))
      raf = requestAnimationFrame(tick)
    }
    if (visible) raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  const go = useCallback(
    (i: number) => {
      const m = motionRef.current
      m.target = Math.max(0, Math.min(products.length - 1, i)) * RACK_SPACING
    },
    [products.length],
  )

  // arrastar com o mouse ou o dedo (o rolar vertical da página continua normal)
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const m = motionRef.current
    const el = wrap.current
    if (!el) return
    const perUnit = el.clientHeight / 3.4
    const startX = e.clientX
    const startTarget = m.target
    let lastX = e.clientX
    let lastT = performance.now()
    let speed = 0
    m.dragging = true
    m.dragged = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 6) m.dragged = true
      m.target = startTarget - dx / perUnit
      const now = performance.now()
      speed = (ev.clientX - lastX) / Math.max(1, now - lastT)
      lastX = ev.clientX
      lastT = now
    }
    const up = () => {
      m.dragging = false
      // arremesso: continua um pouco na direção do gesto e encaixa no cabide mais perto
      const fling = performance.now() - lastT < 80 ? (-speed * 260) / perUnit : 0
      m.target = Math.round((m.target + fling) / RACK_SPACING) * RACK_SPACING
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // rolagem lateral do trackpad também passa as peças
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    let snap = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const m = motionRef.current
      m.target += e.deltaX / (el.clientHeight / 3.4)
      window.clearTimeout(snap)
      snap = window.setTimeout(() => (m.target = Math.round(m.target / RACK_SPACING) * RACK_SPACING), 160)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const current = products[Math.max(0, Math.min(products.length - 1, index))]
  const arrow =
    'grid size-12 place-items-center rounded-full border border-line-strong bg-ink/70 text-xl text-cream transition-colors hover:border-gold disabled:opacity-30'

  return (
    <div className="mt-10">
      <div
        ref={wrap}
        data-cursor="drag"
        tabIndex={0}
        aria-label="Arara de peças. Use as setas do teclado para passar e Enter para abrir."
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(index + 1)
          if (e.key === 'ArrowLeft') go(index - 1)
          if (e.key === 'Enter' && current) onSelect(current)
        }}
        onPointerDown={onPointerDown}
        className="relative h-[68svh] min-h-[30rem] touch-pan-y select-none outline-none lg:h-[78svh]"
      >
        {near && (
          <RackBoundary fallback={<GridView products={products} onSelect={onSelect} />}>
            <Suspense fallback={null}>
              <RackStage
                products={products}
                motion={motionRef}
                onSelect={onSelect}
                active={visible}
                mobile={!desktop}
                reduced={reduced}
                showPrices={showPrices}
                skin={skin}
              />
            </Suspense>
          </RackBoundary>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-ink to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-ink to-transparent" />
        <span className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-ink/60 px-3 py-1.5 text-xs text-muted">
          <TbHandFinger aria-hidden /> arraste para passar as peças
        </span>
      </div>

      <div className="container-x mt-2 flex items-center justify-between gap-4">
        <button type="button" onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Peça anterior" className={arrow}>
          <TbArrowLeft aria-hidden />
        </button>
        <AnimatePresence mode="wait">
          {current && (
            <motion.button
              key={current.id}
              type="button"
              onClick={() => onSelect(current)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="min-w-0 text-center"
            >
              <span className="block truncate font-display text-2xl text-cream sm:text-3xl">{current.name}</span>
              <span className="mt-1 flex items-baseline justify-center gap-3 text-sm text-muted">
                {showPrices && priceLabel(current) && <span className="text-xl font-semibold text-gold-soft sm:text-2xl">{priceLabel(current)}</span>}
                <span className="text-gold underline-offset-4 hover:underline">ver detalhes</span>
                <span className="tabular-nums text-faint">
                  {index + 1}/{products.length}
                </span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        <button type="button" onClick={() => go(index + 1)} disabled={index >= products.length - 1} aria-label="Próxima peça" className={arrow}>
          <TbArrowRight aria-hidden />
        </button>
      </div>
    </div>
  )
}

function GridView({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  const { settings } = useSiteData()
  return (
    <ul className="container-x mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, transform: 'translateY(24px)' }}
          whileInView={{ opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: easeOut, delay: (i % 4) * 0.06 }}
        >
          <button type="button" onClick={() => onSelect(p)} className="group block w-full text-left">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-ink-3">
              <span className="block h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                <PieceThumb product={p} />
              </span>
              {p.isNew && !p.soldOut && (
                <span className="absolute left-3 top-3 rounded-full bg-rose px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink">
                  Novo
                </span>
              )}
              {p.soldOut && (
                <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-soft">
                  Esgotado
                </span>
              )}
            </span>
            <span className="mt-3 block font-display text-xl leading-tight text-cream">{p.name}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
              <span>{settings.showPrices && priceLabel(p) ? priceLabel(p) : 'consulte'}</span>
              <span className="flex gap-1">
                {p.colors.slice(0, 5).map((c, k) => (
                  <span key={c.hex + k} className="size-3.5 rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]" style={{ background: c.hex }} />
                ))}
              </span>
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  )
}
