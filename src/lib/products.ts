import { fitById, type Slot } from '../data/fits'
import { formatPrice } from '../data/catalog'
import type { WornPiece } from '../components/three/Mannequin'
import { productPhotoUrl, swatchUrl } from './api'
import type { Product } from './siteTypes'

// Ajudas para mostrar e vestir as peças do catálogo

export function coverUrl(product: Product, size: 'thumb' | 'full' = 'thumb') {
  const photo = product.photos[0]
  return photo ? productPhotoUrl(product.id, photo.key, size) : ''
}

export function photoUrls(product: Product, size: 'thumb' | 'full') {
  return product.photos.map((photo) => productPhotoUrl(product.id, photo.key, size))
}

export const priceLabel = (product: Product) => (product.price > 0 ? formatPrice(product.price) : '')

// Onde a peça veste no manequim (vazio = não aparece no provador, ex.: acessórios)
export function productSlots(product: Product): Slot[] {
  return product.fits.map((f) => fitById(f)?.slot).filter((s): s is Slot => Boolean(s))
}

export const canWear = (product: Product) => productSlots(product).length > 0

// Como a peça aparece no provador: "Parte de cima", "Conjunto"…
export function wearLabel(product: Product) {
  const slots = productSlots(product)
  if (slots.length === 2) return 'Conjunto'
  if (slots[0] === 'full') return 'Peça inteira'
  if (slots[0] === 'top') return 'Parte de cima'
  if (slots[0] === 'bottom') return 'Parte de baixo'
  return ''
}

// As partes da peça para vestir no manequim (um conjunto vira duas)
export function wornPieces(product: Product, colorIndex: number): WornPiece[] {
  const color = product.colors[colorIndex] ?? product.colors[0]
  // o recorte do tecido foi tirado da foto, que é da primeira cor
  const swatch = product.swatch ? swatchUrl(product.id, product.swatch) : undefined
  return product.fits.map((fit) => ({
    key: `${product.id}:${fit}`,
    fit,
    color: color?.hex ?? '#888888',
    fabric: product.fabric,
    swatch: product.fabric === 'estampado' && colorIndex > 0 ? undefined : swatch,
  }))
}

// Looks prontos para a vitrine (abertura e desfile): combina partes de cima e de baixo,
// vestidos e conjuntos do catálogo, alternando entre eles
export function showcaseLooks(products: Product[], count = 6): WornPiece[][] {
  const single = (slot: Slot) => products.filter((p) => productSlots(p).length === 1 && productSlots(p)[0] === slot)
  const tops = single('top')
  const bottoms = single('bottom')
  const fulls = single('full')
  const sets = products.filter((p) => productSlots(p).length === 2)
  const looks: WornPiece[][] = []
  for (let i = 0; looks.length < count && i < count * 2; i++) {
    const kind = i % 3
    if (kind === 0 && tops.length && bottoms.length) {
      const top = tops[Math.floor(i / 3) % tops.length]
      const bottom = bottoms[Math.floor(i / 3) % bottoms.length]
      looks.push([...wornPieces(top, 0), ...wornPieces(bottom, 0)])
    } else if (kind === 1 && fulls.length) {
      looks.push(wornPieces(fulls[Math.floor(i / 3) % fulls.length], 0))
    } else if (kind === 2 && sets.length) {
      const set = sets[Math.floor(i / 3) % sets.length]
      looks.push(wornPieces(set, Math.floor(i / 3) % set.colors.length))
    }
  }
  // sem repetir o mesmo look
  const seen = new Set<string>()
  return looks.filter((look) => {
    const key = look.map((p) => p.key + p.color).join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
