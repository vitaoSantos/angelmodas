import { AnimatePresence } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ProductSheet } from '../components/sections/ProductSheet'
import type { Product } from '../lib/siteTypes'

// Ficha da peça: abre de qualquer lugar do site (capa, arara, lista)
const SheetContext = createContext<{ openProduct: (product: Product) => void } | null>(null)

export function SheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Product | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const value = useMemo(() => ({ openProduct: setOpen }), [])
  return (
    <SheetContext.Provider value={value}>
      {children}
      <AnimatePresence>{open && <ProductSheet key={open.id} product={open} onClose={close} />}</AnimatePresence>
    </SheetContext.Provider>
  )
}

export function useSheet() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('useSheet precisa estar dentro de SheetProvider')
  return ctx
}
