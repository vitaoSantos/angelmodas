import { useLenis } from 'lenis/react'
import { AnimatePresence, motion } from 'motion/react'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TbArrowLeft, TbArrowRight, TbBrandWhatsapp, TbHanger, TbHandFinger, TbX } from 'react-icons/tb'
import { useLook } from '../../context/LookContext'
import { brand, whatsappUrl } from '../../data/brand'
import { categoryById, fabricById, sortSizes } from '../../data/catalog'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { useSpinDrag } from '../../hooks/useSpinDrag'
import { canWear, photoUrls, priceLabel, wearLabel, wornPieces } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { newSpin } from '../three/shared'
import { useScrollTo } from '../layout/Navbar'
import { easeOut } from '../ui/motion'
import { PieceThumb } from '../ui/PieceThumb'

const FittingStage = lazy(() => import('../three/FittingStage'))

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// Ficha da peça: fotos (ou o manequim vestido), cores, tamanhos e os botões de provar e pedir
export function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const lenis = useLenis()
  const { wear, skin } = useLook()
  const scrollTo = useScrollTo()
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const photos = useMemo(() => ({ full: photoUrls(product, 'full'), thumb: photoUrls(product, 'thumb') }), [product])
  const wearable = canWear(product)
  const [view, setView] = useState<'fotos' | 'manequim'>(photos.full.length ? 'fotos' : 'manequim')
  const [photo, setPhoto] = useState(0)
  const [color, setColor] = useState(0)
  const sizes = sortSizes(product.sizes)
  const [size, setSize] = useState(sizes.length === 1 ? sizes[0] : '')
  const spin = useRef(newSpin())
  const onDrag = useSpinDrag(spin)
  const pieces = useMemo(() => wornPieces(product, color), [product, color])
  const price = priceLabel(product)
  const category = categoryById(product.category)?.label

  useEffect(() => {
    lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
      lenis?.start()
    }
  }, [lenis, onClose])

  const colorName = product.colors[color]?.name
  const details = [colorName && `cor ${colorName.toLowerCase()}`, size && `tamanho ${size}`, price].filter(Boolean).join(' · ')
  const message = product.soldOut
    ? `Olá, ${brand.name}! Quero ser avisada quando chegar: ${product.name}${details ? ` (${details})` : ''}.`
    : `Olá, ${brand.name}! Tenho interesse nesta peça:\n• ${product.name}${details ? ` · ${details}` : ''}\nEstá disponível?`

  function tryOn() {
    wear(product, color)
    onClose()
    window.setTimeout(() => scrollTo('provador'), 80)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/85 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.45, ease: easeOut }}
        data-lenis-prevent
        className="border-gradient relative grid max-h-[94svh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-ink-2 sm:rounded-[2rem] md:grid-cols-[1.05fr_1fr]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-line-strong bg-ink/70 text-xl text-cream"
        >
          <TbX aria-hidden />
        </button>

        {/* Fotos ou manequim */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-3 md:aspect-auto md:min-h-[34rem]">
          {view === 'fotos' && photos.full.length > 0 ? (
            <>
              <AnimatePresence mode="wait">
                <motion.img
                  key={photos.full[photo]}
                  src={photos.full[photo]}
                  alt={`${product.name}, foto ${photo + 1}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 h-full w-full bg-cover bg-center object-cover"
                  style={{ backgroundImage: `url("${photos.thumb[photo]}")` }}
                />
              </AnimatePresence>
              {photos.full.length > 1 && (
                <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPhoto((i) => (i - 1 + photos.full.length) % photos.full.length)}
                    aria-label="Foto anterior"
                    className="grid size-10 place-items-center rounded-full bg-ink/70 text-cream"
                  >
                    <TbArrowLeft aria-hidden />
                  </button>
                  <span className="rounded-full bg-ink/70 px-3 py-1 text-xs tabular-nums text-cream">
                    {photo + 1} / {photos.full.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhoto((i) => (i + 1) % photos.full.length)}
                    aria-label="Próxima foto"
                    className="grid size-10 place-items-center rounded-full bg-ink/70 text-cream"
                  >
                    <TbArrowRight aria-hidden />
                  </button>
                </div>
              )}
            </>
          ) : wearable ? (
            <div className="absolute inset-0 touch-pan-y select-none" data-cursor="drag" onPointerDown={onDrag}>
              <div className="absolute inset-0 grid place-items-center">
                <PieceThumb product={product} color={color} className="opacity-30" />
              </div>
              <Boundary>
                <Suspense fallback={null}>
                  <FittingStage pieces={pieces} spin={spin} active mobile={!desktop} reduced={reduced} background="#211c19" skin={skin} />
                </Suspense>
              </Boundary>
              <span className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-ink/60 px-3 py-1.5 text-xs text-muted">
                <TbHandFinger aria-hidden /> arraste para girar
              </span>
            </div>
          ) : (
            <PieceThumb product={product} />
          )}

          {photos.full.length > 0 && wearable && (
            <div className="absolute left-4 top-4 flex rounded-full border border-line bg-ink/75 p-1 text-xs">
              {(['fotos', 'manequim'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-full px-3 py-1.5 transition-colors ${view === v ? 'bg-cream text-ink' : 'text-muted hover:text-cream'}`}
                >
                  {v === 'fotos' ? 'Fotos' : 'No manequim 3D'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="grid content-start gap-6 p-6 sm:p-8">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              {category}
              {product.isNew && <span className="rounded-full bg-rose/20 px-2 py-0.5 text-[10px] tracking-[0.16em] text-rose-soft">Novidade</span>}
              {product.soldOut && <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] tracking-[0.16em] text-red-200">Esgotado</span>}
            </p>
            <h3 className="mt-3 pr-10 font-display text-4xl leading-[1.05] tracking-tight">{product.name}</h3>
            {price ? <p className="mt-3 text-2xl font-semibold text-gold-soft">{price}</p> : <p className="mt-3 text-muted">Valor sob consulta no WhatsApp</p>}
            {product.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted">{product.description}</p>}
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-faint">
              Cor <span className="ml-1 normal-case tracking-normal text-cream">{colorName}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c, i) => (
                <button
                  key={c.hex + i}
                  type="button"
                  onClick={() => {
                    setColor(i)
                    if (wearable) setView('manequim')
                  }}
                  aria-pressed={i === color}
                  aria-label={`Cor ${c.name}`}
                  title={c.name}
                  className={`size-10 rounded-full border-2 transition-transform ${i === color ? 'scale-110 border-cream' : 'border-transparent hover:scale-105'}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, #ffffff66, ${c.hex} 58%)` }}
                />
              ))}
            </div>
          </div>

          {sizes.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-faint">Tamanho</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize((v) => (v === s ? '' : s))}
                    aria-pressed={size === s}
                    className={`min-w-12 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      size === s ? 'border-gold bg-gold/15 text-cream' : 'border-line text-muted hover:border-line-strong hover:text-cream'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-muted">
            Tecido: <span className="text-cream">{fabricById(product.fabric).label}</span> · {fabricById(product.fabric).hint}
          </p>

          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <a
              href={whatsappUrl(message)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-7 py-4 font-semibold text-ink transition-[filter] hover:brightness-110"
            >
              <TbBrandWhatsapp aria-hidden className="text-lg" />
              {product.soldOut ? 'Avise-me quando chegar' : 'Quero esta peça'}
            </a>
            {wearable && (
              <button
                type="button"
                onClick={tryOn}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line-strong px-7 py-4 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
              >
                <TbHanger aria-hidden className="text-lg" />
                Provar no manequim ({wearLabel(product).toLowerCase()})
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
