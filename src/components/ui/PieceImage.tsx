import type { Slot } from '../../data/fits'
import type { PieceSource } from '../../lib/products'

// A peça no provador: a foto da peça sozinha sem fundo (com a sombra do próprio contorno), a foto
// da peça com fundo (como uma foto pousada no papel) ou, sem nenhuma, a foto com modelo recortada
// na parte do corpo onde a peça veste.
export const FOCUS: Record<Slot, string> = { top: '50% 24%', bottom: '50% 80%', full: '50% 42%' }

export function PieceImage({
  source,
  slot,
  name,
  hex,
  eager = false,
  className = '',
}: {
  source: PieceSource
  slot: Slot
  name: string
  hex?: string
  eager?: boolean
  className?: string
}) {
  if (source.kind === 'none') {
    return (
      <div className={`grid h-full w-full place-items-center p-4 ${className}`}>
        <div
          className="grid h-full w-full place-items-center rounded-2xl p-4 text-center font-display text-xl text-ink/80 shadow-[0_18px_30px_-14px_rgb(60_40_20/0.45)]"
          style={{ background: `linear-gradient(160deg, #ffffff55, ${hex ?? '#d6bf9f'} 70%)` }}
        >
          {name}
        </div>
      </div>
    )
  }
  if (source.cutout) {
    return (
      <img
        src={source.url}
        alt={name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={`h-full w-full object-contain p-3 drop-shadow-[0_16px_14px_rgb(60_40_20/0.3)] ${className}`}
      />
    )
  }
  return (
    <div className={`h-full w-full p-3 ${className}`}>
      <img
        src={source.url}
        alt={name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="h-full w-full rounded-[14px] object-cover shadow-[0_18px_30px_-14px_rgb(60_40_20/0.5)]"
        style={{ objectPosition: source.kind === 'photo' ? FOCUS[slot] : '50% 50%' }}
      />
    </div>
  )
}
