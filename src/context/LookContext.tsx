import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WornPiece } from '../components/three/Mannequin'
import { canWear, priceLabel, productSlots, wornPieces } from '../lib/products'
import type { Product } from '../lib/siteTypes'
import { useSiteData } from './SiteDataContext'

// O look montado no provador 3D. Fica aqui para o catálogo (botão "provar"), o provador e o
// formulário de contato usarem o mesmo look.

type Pick = { id: string; color: number }
type LookSlots = { top: Pick | null; bottom: Pick | null; full: Pick | null }

export type WornItem = { product: Product; color: number; label: string }

type LookState = {
  look: LookSlots
  size: string
  setSize: (size: string) => void
  wear: (product: Product, color?: number) => void
  setColor: (productId: string, color: number) => void
  takeOff: (productId: string) => void
  surprise: () => void
  isWorn: (productId: string) => boolean
  // o que está vestido agora (um conjunto aparece uma vez só)
  items: WornItem[]
  pieces: WornPiece[]
  wearable: Product[]
  touched: boolean
  // look em linhas (mensagem do WhatsApp) e numa linha só (formulário)
  lines: string[]
  summary: string
}

const LookContext = createContext<LookState | null>(null)

const EMPTY: LookSlots = { top: null, bottom: null, full: null }

const firstWith = (list: Product[], slot: 'top' | 'bottom' | 'full', single = true) =>
  list.find((p) => {
    const slots = productSlots(p)
    return slots.includes(slot) && (!single || slots.length === 1)
  })

// Primeiro look: uma parte de cima com uma de baixo (ou um vestido, se não tiver as duas)
function defaultLook(list: Product[]): LookSlots {
  const top = firstWith(list, 'top')
  const bottom = firstWith(list, 'bottom')
  if (top && bottom) return { top: { id: top.id, color: 0 }, bottom: { id: bottom.id, color: 0 }, full: null }
  const full = firstWith(list, 'full')
  if (full) return { ...EMPTY, full: { id: full.id, color: 0 } }
  const set = list.find((p) => productSlots(p).length === 2)
  if (set) return { top: { id: set.id, color: 0 }, bottom: { id: set.id, color: 0 }, full: null }
  return EMPTY
}

function wearOn(current: LookSlots, product: Product, color: number, list: Product[]): LookSlots {
  const slots = productSlots(product)
  const pick = { id: product.id, color }
  if (slots.includes('full')) return { ...current, full: pick }
  if (slots.length === 2) return { top: pick, bottom: pick, full: null }
  const slot = slots[0] as 'top' | 'bottom'
  const next: LookSlots = { ...current, [slot]: pick, full: null }
  // sem a outra parte, veste a primeira que tiver no catálogo (se trocar uma parte de um conjunto,
  // a outra parte dele continua)
  const other = slot === 'top' ? 'bottom' : 'top'
  if (!next[other]) {
    const fallback = firstWith(list, other)
    if (fallback) next[other] = { id: fallback.id, color: 0 }
  }
  return next
}

export function LookProvider({ children }: { children: ReactNode }) {
  const { catalog } = useSiteData()
  const wearable = useMemo(() => catalog.filter(canWear), [catalog])
  const byId = useMemo(() => new Map(wearable.map((p) => [p.id, p])), [wearable])
  const [look, setLook] = useState<LookSlots>(() => defaultLook(wearable))
  const [size, setSizeState] = useState('M')
  const [touched, setTouched] = useState(false)

  // Catálogo mudou (carregou do painel): se alguma peça vestida sumiu, volta para o look inicial
  useEffect(() => {
    setLook((current) => {
      const picks = [current.top, current.bottom, current.full].filter((p): p is Pick => Boolean(p))
      return picks.length && picks.every((p) => byId.has(p.id)) ? current : defaultLook(wearable)
    })
  }, [byId, wearable])

  const wear = useCallback(
    (product: Product, color = 0) => {
      setTouched(true)
      setLook((current) => wearOn(current, product, color, wearable))
    },
    [wearable],
  )

  const setColor = useCallback((productId: string, color: number) => {
    setTouched(true)
    setLook((current) => {
      const change = (p: Pick | null) => (p && p.id === productId ? { ...p, color } : p)
      return { top: change(current.top), bottom: change(current.bottom), full: change(current.full) }
    })
  }, [])

  const takeOff = useCallback((productId: string) => {
    setTouched(true)
    setLook((current) => {
      const off = (p: Pick | null) => (p && p.id === productId ? null : p)
      return { top: off(current.top), bottom: off(current.bottom), full: off(current.full) }
    })
  }, [])

  const surprise = useCallback(() => {
    setTouched(true)
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
    const fulls = wearable.filter((p) => productSlots(p).includes('full'))
    const tops = wearable.filter((p) => productSlots(p).includes('top'))
    const bottoms = wearable.filter((p) => productSlots(p).includes('bottom') && productSlots(p).length === 1)
    const color = (p: Product) => Math.floor(Math.random() * p.colors.length)
    setLook(() => {
      if (fulls.length && (Math.random() < 0.3 || !tops.length)) {
        const p = pick(fulls)
        return { ...EMPTY, full: { id: p.id, color: color(p) } }
      }
      const top = pick(tops)
      if (!top) return defaultLook(wearable)
      if (productSlots(top).length === 2) return { top: { id: top.id, color: color(top) }, bottom: { id: top.id, color: color(top) }, full: null }
      const bottom = pick(bottoms)
      return { top: { id: top.id, color: color(top) }, bottom: bottom ? { id: bottom.id, color: color(bottom) } : null, full: null }
    })
  }, [wearable])

  const setSize = useCallback((value: string) => {
    setTouched(true)
    setSizeState(value)
  }, [])

  const value = useMemo<LookState>(() => {
    const picks = look.full ? [look.full] : [look.top, look.bottom]
    const items: WornItem[] = []
    for (const pick of picks) {
      const product = pick && byId.get(pick.id)
      if (!product || items.some((i) => i.product.id === product.id)) continue
      const slots = productSlots(product)
      const wholeSet = look.top?.id === product.id && look.bottom?.id === product.id
      const label =
        slots.length === 2
          ? wholeSet
            ? 'Conjunto'
            : look.top?.id === product.id
              ? 'Parte de cima do conjunto'
              : 'Parte de baixo do conjunto'
          : slots[0] === 'full'
            ? 'Peça inteira'
            : slots[0] === 'top'
              ? 'Parte de cima'
              : 'Parte de baixo'
      items.push({ product, color: pick.color, label })
    }
    const pieces = items.flatMap((i) => {
      const all = wornPieces(i.product, i.color)
      // de um conjunto, veste só a parte que está no look (ex.: a camisa do conjunto com outra calça)
      if (productSlots(i.product).length === 2 && !look.full) {
        return all.filter((_, k) => (k === 0 ? look.top?.id === i.product.id : look.bottom?.id === i.product.id))
      }
      return all
    })
    const lines = [
      ...items.map((i) => {
        const color = i.product.colors[i.color]?.name
        const price = priceLabel(i.product)
        return [i.product.name, color && `cor ${color.toLowerCase()}`, price].filter(Boolean).join(' · ')
      }),
      `Tamanho: ${size}`,
    ]
    return {
      look,
      size,
      setSize,
      wear,
      setColor,
      takeOff,
      surprise,
      isWorn: (id: string) => items.some((i) => i.product.id === id),
      items,
      pieces,
      wearable,
      touched,
      lines,
      summary: lines.join(' | '),
    }
  }, [look, size, setSize, wear, setColor, takeOff, surprise, byId, wearable, touched])

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>
}

export function useLook() {
  const ctx = useContext(LookContext)
  if (!ctx) throw new Error('useLook precisa estar dentro de LookProvider')
  return ctx
}
