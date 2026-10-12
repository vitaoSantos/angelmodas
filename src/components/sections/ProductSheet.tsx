import { useLenis } from 'lenis/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { TbArrowLeft, TbArrowRight, TbBrandWhatsapp, TbHanger, TbX } from 'react-icons/tb'
import { useLook } from '../../context/LookContext'
import { brand, whatsappUrl } from '../../data/brand'
import { categoryById, fabricById, sortSizes } from '../../data/catalog'
import { swatchUrl } from '../../lib/api'
import { canWear, galleryOf, priceLabel } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { useScrollTo } from '../layout/Navbar'
import { easeOut } from '../ui/motion'
import { PieceThumb } from '../ui/PieceThumb'

// Ficha da peça: fotos (com modelo e a peça sozinha em cada cor), cores, tamanhos e os botões de montar o look e pedir
export function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const lenis = useLenis()
  const { wear } = useLook()
  const scrollTo = useScrollTo()
  const gallery = useMemo(() => galleryOf(product), [product])
  const wearable = canWear(product)
  const [photo, setPhoto] = useState(0)
  const [color, setColor] = useState(0)
  const sizes = sortSizes(product.sizes)
  const [size, setSize] = useState(sizes.length === 1 ? sizes[0] : '')
  const shown = gallery[photo]
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
    // espera a ficha fechar (a página volta a rolar) antes de descer até o provador
    window.setTimeout(() => scrollTo('provador'), 650)
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

        {/* Fotos */}
        <div className={`relative aspect-[4/5] w-full overflow-hidden md:aspect-auto md:min-h-[34rem] ${shown?.cutout ? 'bg-[#efe6da]' : 'bg-ink-3'}`}>
          {shown ? (
            <>
              <AnimatePresence mode="wait">
                <motion.img
                  key={shown.full}
                  src={shown.full}
                  alt={`${product.name}, foto ${photo + 1}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute inset-0 h-full w-full bg-center ${
                    shown.cutout ? 'object-contain p-8 drop-shadow-[0_22px_20px_rgb(60_40_20/0.3)]' : 'bg-cover object-cover'
                  }`}
                  style={shown.cutout ? undefined : { backgroundImage: `url("${shown.thumb}")` }}
                />
              </AnimatePresence>
              {gallery.length > 1 && (
                <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPhoto((i) => (i - 1 + gallery.length) % gallery.length)}
                    aria-label="Foto anterior"
                    className="grid size-10 place-items-center rounded-full bg-ink/70 text-cream"
                  >
                    <TbArrowLeft aria-hidden />
                  </button>
                  <span className="rounded-full bg-ink/70 px-3 py-1 text-xs tabular-nums text-cream">
                    {photo + 1} / {gallery.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhoto((i) => (i + 1) % gallery.length)}
                    aria-label="Próxima foto"
                    className="grid size-10 place-items-center rounded-full bg-ink/70 text-cream"
                  >
                    <TbArrowRight aria-hidden />
                  </button>
                </div>
              )}
            </>
          ) : (
            <PieceThumb product={product} color={color} />
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
                    // mostra a foto da peça nessa cor, se tiver
                    const at = gallery.findIndex((g) => g.piece && g.color === i)
                    if (at >= 0) setPhoto(at)
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

          <p className="flex items-center gap-3 text-sm text-muted">
            {product.swatch && (
              <span
                className="size-11 shrink-0 rounded-full bg-cover bg-center ring-1 ring-line-strong"
                title="O tecido de perto"
                style={{ backgroundImage: `url("${swatchUrl(product.id, product.swatch)}")` }}
              />
            )}
            <span>
              Tecido: <span className="text-cream">{fabricById(product.fabric).label}</span> · {fabricById(product.fabric).hint}
            </span>
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
                Montar um look com esta peça
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
