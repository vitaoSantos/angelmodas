import { categories, fabrics, sizes } from '../../src/data/catalog'
import { validFits } from '../../src/data/fits'
import type { ProductColor, ProductFields } from '../../src/lib/siteTypes'
import { clean, cleanMultiline } from './text'

// Confere e limpa os campos de uma peça que chegam do painel
export const PRODUCT_LIMITS = { name: 80, description: 600, colors: 8, colorName: 30, price: 10_000_000 }

const HEX = /^#[0-9a-f]{6}$/

function cleanColors(raw: unknown): ProductColor[] {
  if (!Array.isArray(raw)) return []
  const out: ProductColor[] = []
  for (const item of raw.slice(0, PRODUCT_LIMITS.colors)) {
    if (!item || typeof item !== 'object') continue
    const hex = String((item as Record<string, unknown>).hex ?? '').toLowerCase()
    const name = clean((item as Record<string, unknown>).name, PRODUCT_LIMITS.colorName)
    if (HEX.test(hex) && name) out.push({ name, hex })
  }
  return out
}

export function cleanProductFields(body: Record<string, unknown>): { fields: ProductFields } | { error: string } {
  const name = clean(body.name, PRODUCT_LIMITS.name)
  if (name.length < 2) return { error: 'Dê um nome para a peça.' }
  const category = typeof body.category === 'string' && categories.some((c) => c.id === body.category) ? body.category : ''
  if (!category) return { error: 'Escolha a categoria da peça.' }
  const fabric = typeof body.fabric === 'string' && fabrics.some((f) => f.id === body.fabric) ? body.fabric : fabrics[0].id
  const colors = cleanColors(body.colors)
  if (!colors.length) return { error: 'Coloque pelo menos uma cor.' }
  const list = Array.isArray(body.sizes) ? body.sizes.filter((s): s is string => typeof s === 'string') : []
  const price = Math.round(Number(body.price))
  return {
    fields: {
      name,
      category,
      fits: validFits(Array.isArray(body.fits) ? body.fits.filter((f): f is string => typeof f === 'string') : []),
      fabric,
      colors,
      sizes: sizes.filter((s) => list.includes(s)),
      price: Number.isFinite(price) && price > 0 && price <= PRODUCT_LIMITS.price ? price : 0,
      description: cleanMultiline(body.description, PRODUCT_LIMITS.description),
      isNew: body.isNew === true,
      soldOut: body.soldOut === true,
      hidden: body.hidden === true,
    },
  }
}
