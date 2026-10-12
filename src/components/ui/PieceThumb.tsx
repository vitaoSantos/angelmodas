import { useState } from 'react'
import { fabricById } from '../../data/catalog'
import { coverUrl } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { LogoMark } from './Logo'

// Miniatura da peça: a foto de capa ou, sem foto, um "tecido" na cor da peça com o manequim do logo
export function PieceThumb({ product, color = 0, className = '', size = 'thumb' }: { product: Product; color?: number; className?: string; size?: 'thumb' | 'full' }) {
  const url = coverUrl(product, size)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const hex = product.colors[color]?.hex ?? product.colors[0]?.hex ?? '#888'
  if (url && !failed) {
    const photo = product.photos[0]
    return (
      <img
        src={attempt ? `${url}&de-novo=${attempt}` : url}
        alt={product.name}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        // rede instável: tenta mais uma vez; depois fica o tecido na cor da peça
        onError={() => (attempt ? setFailed(true) : window.setTimeout(() => setAttempt(1), 1500))}
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label={product.name}
      className={`relative grid h-full w-full place-items-center overflow-hidden ${className}`}
      style={{ background: `radial-gradient(120% 90% at 30% 15%, #ffffff40, transparent 55%), ${hex}` }}
    >
      {/* textura do tecido em CSS: nervuras, tricô ou trama */}
      <span aria-hidden className="absolute inset-0 opacity-25 mix-blend-overlay" style={fabricPattern(product.fabric)} />
      <LogoMark className="relative h-3/4 w-auto opacity-70 mix-blend-luminosity" />
      <span className="absolute bottom-2 left-2 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cream">
        {fabricById(product.fabric).label}
      </span>
    </span>
  )
}

function fabricPattern(fabric: string) {
  if (fabric === 'canelado') return { backgroundImage: 'repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 5px)' }
  if (fabric === 'tricot')
    return { backgroundImage: 'repeating-linear-gradient(60deg, #000 0 2px, transparent 2px 7px), repeating-linear-gradient(-60deg, #000 0 2px, transparent 2px 7px)' }
  if (fabric === 'jeans') return { backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 1px, #000 1px 3px)' }
  if (fabric === 'linho')
    return { backgroundImage: 'repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 4px)' }
  if (fabric === 'renda') return { backgroundImage: 'radial-gradient(circle, #000 2px, transparent 3px)', backgroundSize: '9px 9px' }
  return { backgroundImage: 'linear-gradient(180deg, #fff, #000)' }
}
