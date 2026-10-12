import { getStore } from '@netlify/blobs'
import { purgeCache } from '@netlify/functions'
// Traz a declaração do objeto global Netlify (Netlify.env)
import type {} from '@netlify/functions'
import type { CommunityConfig, MuralPhoto, Product, StoredComment, VisitStats } from '../../src/lib/siteTypes'

// Armazenamento chave-valor do próprio Netlify (Netlify Blobs): sem banco de dados para manter
export const store = () => getStore({ name: 'anghel-modas', consistency: 'strong' })

export type PhotoIndex = { photos: MuralPhoto[] }
export const EMPTY_INDEX: PhotoIndex = { photos: [] }

export type ProductIndex = { products: Product[] }
export const EMPTY_PRODUCTS: ProductIndex = { products: [] }

export const KEYS = {
  products: 'catalogo/index',
  productPhoto: (id: string, key: string, size: 'thumb' | 'full') => `catalogo/${id}/foto/${key}/${size}`,
  swatch: (id: string, key: string) => `catalogo/${id}/tecido/${key}`,
  piece: (id: string, key: string) => `catalogo/${id}/peca/${key}`,
  photos: 'mural/index',
  settings: 'settings',
  photo: (id: string, size: 'thumb' | 'full') => `mural/${id}/${size}`,
  comments: 'community/comments',
  community: 'community/config',
  commentRate: (who: string) => `community/rate/${who}`,
  visits: 'stats/visits',
}

// Ids gerados pelas funções: letras minúsculas e números
export const ITEM_ID = /^[a-z0-9]{8,40}$/
export const newId = () => Date.now().toString(36) + hex(crypto.getRandomValues(new Uint8Array(5)))

export type CommentIndex = { comments: StoredComment[] }
export const EMPTY_COMMENTS: CommentIndex = { comments: [] }

// Contador de visitas. `caps` guarda, só do dia atual, quantas visitas cada endereço de internet
// (embaralhado, nunca o endereço em si) já somou: evita que alguém infle o número recarregando.
export type StoredVisits = VisitStats & { caps?: { day: string; ips: Record<string, number> } }
export const EMPTY_VISITS: StoredVisits = { total: 0, days: {} }

export async function readCommunity(): Promise<CommunityConfig> {
  const raw = (await store().get(KEYS.community, { type: 'json' })) as Partial<CommunityConfig> | null
  return { autoPublish: raw?.autoPublish === true }
}

export async function readComments() {
  return ((await store().get(KEYS.comments, { type: 'json' })) as CommentIndex | null)?.comments ?? []
}

export async function readProducts() {
  return ((await store().get(KEYS.products, { type: 'json' })) as ProductIndex | null)?.products ?? []
}

export async function readVisits(): Promise<VisitStats> {
  const raw = (await store().get(KEYS.visits, { type: 'json' })) as StoredVisits | null
  return { total: raw?.total ?? 0, days: raw?.days ?? {} }
}

// Dia de hoje no horário de Brasília, no formato "2026-10-11"
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Robôs de busca, prévias de link (WhatsApp, Facebook…) e ferramentas não contam visita nem deixam recado
export const isBot = (userAgent: string | null) =>
  !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|lighthouse|headless|python|curl|wget|httpclient/i.test(userAgent)

// Endereço de internet embaralhado, para limitar abusos sem guardar o IP. O segredo do painel entra
// na mistura: sem ele não dá para descobrir o IP testando todos os endereços possíveis.
export async function ipKey(ip: string | undefined, salt: string) {
  return hex((await sha256(`${ip ?? 'desconhecido'}:${salt}:${env('ADMIN_PASSWORD') ?? ''}:anghel-modas`)).slice(0, 8))
}

// Respostas públicas (site e fotos) ficam guardadas na CDN do Netlify e são limpas quando o painel muda algo
export const CACHE_TAG = 'site'

export async function purgeSite(extraTags: string[] = []) {
  try {
    await purgeCache({ tags: [CACHE_TAG, ...extraTags] })
  } catch {
    // rodando fora do Netlify (local) não há cache para limpar
  }
}

// Lê, altera e grava um JSON com controle de concorrência (etag): se outra requisição
// gravou no meio do caminho, tenta de novo com o valor atualizado
export async function updateJSON<T>(key: string, fallback: T, update: (current: T) => T, attempts = 6): Promise<T> {
  const s = store()
  for (let i = 0; i < attempts; i++) {
    const entry = await s.getWithMetadata(key, { type: 'json' })
    const current = (entry?.data as T | undefined) ?? fallback
    const next = update(current)
    if (next === current) return current // nada mudou: não grava
    const result = !entry
      ? await s.setJSON(key, next, { onlyIfNew: true })
      : entry.etag
        ? await s.setJSON(key, next, { onlyIfMatch: entry.etag })
        : await s.setJSON(key, next)
    if (result.modified) return next
  }
  throw new Error('Conflito ao gravar, tente novamente')
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(digest)
}

export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

// Comparação em tempo constante para não vazar a senha pelo tempo de resposta
export async function safeEqual(a: string, b: string) {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i]
  return diff === 0
}

export function env(name: string) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined
}
