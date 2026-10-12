import { categories } from '../../src/data/catalog'
import type { SiteSettings } from '../../src/lib/siteTypes'

// Só guarda o que existe no site: liga/desliga de cada categoria e se os preços aparecem
export function cleanSettings(raw: unknown): SiteSettings {
  const out: SiteSettings = { categories: {}, showPrices: true }
  if (!raw || typeof raw !== 'object') return out
  const source = (raw as Record<string, unknown>).categories
  if (source && typeof source === 'object') {
    for (const c of categories) {
      const value = (source as Record<string, unknown>)[c.id]
      if (typeof value === 'boolean') out.categories[c.id] = value
    }
  }
  if ((raw as Record<string, unknown>).showPrices === false) out.showPrices = false
  return out
}

export function hasCategoryOn(settings: SiteSettings) {
  return categories.some((c) => settings.categories[c.id] ?? true)
}
