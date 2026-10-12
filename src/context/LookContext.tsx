import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { canWear, priceLabel, productSlots } from '../lib/products'
import type { Product } from '../lib/siteTypes'
import { useSiteData } from './SiteDataContext'

// O look montado no provador ("Monte o seu look"). Fica aqui para o catálogo (botão "provar"),
// o provador e o formulário de contato usarem o mesmo look.
// O look tem uma parte de cima e uma de baixo, ou uma peça inteira (vestido, macacão ou conjunto).

type Pick = { id: string; color: number }
type LookSlots = { top: Pick | null; bottom: Pick | null; whole: Pick | null }

export type WornItem = { product: Product; color: number; label: string }

// As faixas do quadro do provador: cima e baixo, ou uma faixa só com a peça inteira
export type Row = 'top' | 'bottom' | 'whole'

type LookState = {
  size: string
  setSize: (size: string) => void
  wear: (product: Product, color?: number) => void
  setColor: (productId: string, color: number) => void
  takeOff: (productId: string) => void
  surprise: () => void
  // passa para a próxima (1) ou anterior (-1) peça daquela faixa
  cycle: (row: Row, step: 1 | -1) => void
  isWorn: (productId: string) => boolean
  // o que está em cada faixa agora
  board: Record<Row, { product: Product; color: number } | null>
  // as peças que podem entrar em cada faixa
  options: Record<Row, Product[]>
  // o que está vestido agora, para as listas e a mensagem
  items: WornItem[]
  wearable: Product[]
  touched: boolean
  // look em linhas (mensagem do WhatsApp) e numa linha só (formulário)
  lines: string[]
  summary: string
}

const LookContext = createContext<LookState | null>(null)

const EMPTY: LookSlots = { top: null, bottom: null, whole: null }

// Em qual faixa a peça entra: conjunto e peça inteira ficam na faixa única
export function rowOf(product: Product): Row | null {
  const slots = productSlots(product)
  if (slots.includes('full') || slots.length === 2) return 'whole'
  if (slots[0] === 'top') return 'top'
  if (slots[0] === 'bottom') return 'bottom'
  return null
}

const LABELS: Record<Row, string> = { top: 'Parte de cima', bottom: 'Parte de baixo', whole: 'Peça inteira' }

function optionsOf(list: Product[]): Record<Row, Product[]> {
  return {
    top: list.filter((p) => rowOf(p) === 'top'),
    bottom: list.filter((p) => rowOf(p) === 'bottom'),
    whole: list.filter((p) => rowOf(p) === 'whole'),
  }
}

// Primeiro look: uma parte de cima com uma de baixo (ou uma peça inteira, se não tiver as duas)
function defaultLook(options: Record<Row, Product[]>): LookSlots {
  const [top] = options.top
  const [bottom] = options.bottom
  if (top && bottom) return { top: { id: top.id, color: 0 }, bottom: { id: bottom.id, color: 0 }, whole: null }
  const [whole] = options.whole
  if (whole) return { ...EMPTY, whole: { id: whole.id, color: 0 } }
  return { top: top ? { id: top.id, color: 0 } : null, bottom: bottom ? { id: bottom.id, color: 0 } : null, whole: null }
}

function wearOn(current: LookSlots, product: Product, color: number, options: Record<Row, Product[]>): LookSlots {
  const row = rowOf(product)
  const pick = { id: product.id, color }
  if (!row) return current
  if (row === 'whole') return { ...EMPTY, whole: pick }
  const next: LookSlots = { ...current, [row]: pick, whole: null }
  // sem a outra parte, completa com a primeira do catálogo
  const other = row === 'top' ? 'bottom' : 'top'
  if (!next[other]) {
    const [fallback] = options[other]
    if (fallback) next[other] = { id: fallback.id, color: 0 }
  }
  return next
}

export function LookProvider({ children }: { children: ReactNode }) {
  const { catalog } = useSiteData()
  const wearable = useMemo(() => catalog.filter(canWear), [catalog])
  const options = useMemo(() => optionsOf(wearable), [wearable])
  const byId = useMemo(() => new Map(wearable.map((p) => [p.id, p])), [wearable])
  const [look, setLook] = useState<LookSlots>(() => defaultLook(options))
  const [size, setSizeState] = useState('M')
  const [touched, setTouched] = useState(false)

  // Catálogo mudou (carregou do painel): se alguma peça vestida sumiu, volta para o look inicial
  useEffect(() => {
    setLook((current) => {
      const picks = [current.top, current.bottom, current.whole].filter((p): p is Pick => Boolean(p))
      return picks.length && picks.every((p) => byId.has(p.id)) ? current : defaultLook(options)
    })
  }, [byId, options])

  const wear = useCallback(
    (product: Product, color = 0) => {
      setTouched(true)
      setLook((current) => wearOn(current, product, color, options))
    },
    [options],
  )

  const cycle = useCallback(
    (row: Row, step: 1 | -1) => {
      const list = options[row]
      if (!list.length) return
      setTouched(true)
      setLook((current) => {
        const at = list.findIndex((p) => p.id === current[row]?.id)
        const next = list[(at + step + list.length) % list.length]
        return wearOn(current, next, 0, options)
      })
    },
    [options],
  )

  const setColor = useCallback((productId: string, color: number) => {
    setTouched(true)
    setLook((current) => {
      const change = (p: Pick | null) => (p && p.id === productId ? { ...p, color } : p)
      return { top: change(current.top), bottom: change(current.bottom), whole: change(current.whole) }
    })
  }, [])

  const takeOff = useCallback((productId: string) => {
    setTouched(true)
    setLook((current) => {
      const off = (p: Pick | null) => (p && p.id === productId ? null : p)
      return { top: off(current.top), bottom: off(current.bottom), whole: off(current.whole) }
    })
  }, [])

  const surprise = useCallback(() => {
    setTouched(true)
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
    const color = (p: Product) => Math.floor(Math.random() * p.colors.length)
    setLook(() => {
      const pair = options.top.length && options.bottom.length
      if (options.whole.length && (Math.random() < 0.35 || !pair)) {
        const p = pick(options.whole)
        return { ...EMPTY, whole: { id: p.id, color: color(p) } }
      }
      const top = pick(options.top)
      const bottom = pick(options.bottom)
      if (!top && !bottom) return defaultLook(options)
      return { top: top ? { id: top.id, color: color(top) } : null, bottom: bottom ? { id: bottom.id, color: color(bottom) } : null, whole: null }
    })
  }, [options])

  const setSize = useCallback((value: string) => {
    setTouched(true)
    setSizeState(value)
  }, [])

  const value = useMemo<LookState>(() => {
    const at = (p: Pick | null) => {
      const product = p && byId.get(p.id)
      return product ? { product, color: Math.min(p.color, Math.max(0, product.colors.length - 1)) } : null
    }
    const board = look.whole ? { top: null, bottom: null, whole: at(look.whole) } : { top: at(look.top), bottom: at(look.bottom), whole: null }
    const items: WornItem[] = (['whole', 'top', 'bottom'] as const).flatMap((row) => {
      const worn = board[row]
      if (!worn) return []
      const label = row === 'whole' && productSlots(worn.product).length === 2 ? 'Conjunto' : LABELS[row]
      return [{ ...worn, label }]
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
      size,
      setSize,
      wear,
      setColor,
      takeOff,
      surprise,
      cycle,
      isWorn: (id: string) => items.some((i) => i.product.id === id),
      board,
      options,
      items,
      wearable,
      touched,
      lines,
      summary: lines.join(' | '),
    }
  }, [look, size, setSize, wear, setColor, takeOff, surprise, cycle, byId, options, wearable, touched])

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>
}

export function useLook() {
  const ctx = useContext(LookContext)
  if (!ctx) throw new Error('useLook precisa estar dentro de LookProvider')
  return ctx
}
