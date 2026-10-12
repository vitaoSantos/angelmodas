import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Category } from '../data/catalog'
import { fetchSiteData, postVisit } from '../lib/api'
import { availableCategories, categoryOn, emptySettings, productOrder, type CommunityComment, type Product, type SiteData } from '../lib/siteTypes'

type SiteDataState = SiteData & {
  loaded: boolean
  // peças que aparecem no site: as do painel, nas categorias ligadas (vazio até os dados chegarem)
  catalog: Product[]
  categories: Category[]
  // recado publicado na hora (painel em "publicar direto"): entra na lista sem recarregar
  addComment: (comment: CommunityComment) => void
}

const SiteDataContext = createContext<SiteDataState | null>(null)

// Visita conta uma vez por dia em cada navegador
const VISIT_KEY = 'anghel-visita'

function localDay() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function countedToday() {
  try {
    return localStorage.getItem(VISIT_KEY) === localDay()
  } catch {
    return true // sem como lembrar: melhor não contar do que contar a cada recarga
  }
}

function markCounted() {
  try {
    localStorage.setItem(VISIT_KEY, localDay())
  } catch {
    // sem localStorage: segue sem lembrar
  }
}

// Opções do painel, catálogo, fotos do mural, recados e visitas. Se a função não responder (rodando
// sem o Netlify, por exemplo), o site segue com os padrões do código e o catálogo vazio.
export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData & { loaded: boolean }>({
    settings: emptySettings(),
    products: [],
    photos: [],
    comments: [],
    visits: 0,
    moderated: true,
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    fetchSiteData()
      .then((site) => {
        if (cancelled) return
        setData((d) => ({
          settings: { ...emptySettings(), ...site.settings },
          products: Array.isArray(site.products) ? site.products : [],
          photos: Array.isArray(site.photos) ? site.photos : [],
          comments: Array.isArray(site.comments) ? site.comments : [],
          // o contador pode já ter vindo mais novo da visita contada agora
          visits: Math.max(d.visits, Number(site.visits) || 0),
          moderated: site.moderated !== false,
          loaded: true,
        }))
      })
      .catch(() => {
        if (!cancelled) setData((d) => ({ ...d, loaded: true }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Conta a visita alguns segundos depois de abrir, para não disputar com a abertura
  useEffect(() => {
    if (countedToday()) return
    const timer = window.setTimeout(() => {
      postVisit()
        .then(({ total }) => {
          markCounted()
          setData((d) => ({ ...d, visits: Math.max(d.visits, total) }))
        })
        .catch(() => {
          // sem contador desta vez; tenta de novo na próxima visita
        })
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [])

  const addComment = useCallback((comment: CommunityComment) => {
    setData((d) => ({ ...d, comments: [comment, ...d.comments.filter((c) => c.id !== comment.id)] }))
  }, [])

  const value = useMemo(() => {
    const categories = availableCategories(data.settings)
    const catalog = data.products.filter((p) => categoryOn(data.settings, p.category)).sort(productOrder)
    return { ...data, catalog, categories, addComment }
  }, [data, addComment])
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>
}

export function useSiteData() {
  const ctx = useContext(SiteDataContext)
  if (!ctx) throw new Error('useSiteData precisa estar dentro de SiteDataProvider')
  return ctx
}
