import { formatPrice } from '../data/catalog'
import { fitById, type Slot } from '../data/fits'
import { pieceUrl, productPhotoUrl } from './api'
import type { Product } from './siteTypes'

// Ajudas para mostrar as peças do catálogo e montar os looks do provador

export function coverUrl(product: Product, size: 'thumb' | 'full' = 'thumb') {
  const photo = product.photos[0]
  return photo ? productPhotoUrl(product.id, photo.key, size) : ''
}

export function photoUrls(product: Product, size: 'thumb' | 'full') {
  return product.photos.map((photo) => productPhotoUrl(product.id, photo.key, size))
}

export const priceLabel = (product: Product) => (product.price > 0 ? formatPrice(product.price) : '')

// Onde a peça veste no provador (vazio = não aparece no provador, ex.: acessórios)
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

// O que mostrar da peça numa cor: a foto da peça sozinha (com ou sem fundo) ou, sem ela,
// a foto de capa (com modelo), recortada na parte certa do corpo
export type PieceSource = { kind: 'piece' | 'photo' | 'none'; url: string; cutout: boolean }

export function pieceSource(product: Product, colorIndex = 0): PieceSource {
  const color = product.colors[colorIndex] ?? product.colors[0]
  if (color?.piece) return { kind: 'piece', url: pieceUrl(product.id, color.piece.key), cutout: color.piece.cutout }
  const cover = product.photos[0]
  if (cover) return { kind: 'photo', url: productPhotoUrl(product.id, cover.key, 'thumb'), cutout: false }
  return { kind: 'none', url: '', cutout: false }
}

// Todas as fotos da peça para a ficha: as fotos com modelo e as fotos da peça sozinha de cada cor
export function galleryOf(product: Product) {
  const photos = product.photos.map((p) => ({
    full: productPhotoUrl(product.id, p.key, 'full'),
    thumb: productPhotoUrl(product.id, p.key, 'thumb'),
    cutout: false,
    color: 0,
    piece: false,
  }))
  const pieces = product.colors.flatMap((c, i) =>
    c.piece ? [{ full: pieceUrl(product.id, c.piece.key), thumb: pieceUrl(product.id, c.piece.key), cutout: c.piece.cutout, color: i, piece: true }] : [],
  )
  return [...photos, ...pieces]
}
