import { categories } from '../data/catalog'

// Tipos compartilhados entre o site e as Netlify Functions (netlify/functions)

// Foto de uma peça. A primeira da lista é a capa.
export type ProductPhoto = { key: string; width: number; height: number }

// Foto da peça sozinha (esticada ou no cabide), uma por cor: é o que aparece no provador.
// `cutout`: o fundo foi tirado no painel (imagem com transparência)
export type PiecePhoto = ProductPhoto & { cutout: boolean }

// Cor em que a peça existe. A primeira é a cor das fotos.
export type ProductColor = { name: string; hex: string; piece?: PiecePhoto }

// Peça do catálogo, cadastrada pelo painel (/admin)
export type Product = {
  id: string
  name: string
  category: string
  fits: string[] // onde veste no provador (data/fits.ts): nenhum, cima, baixo, inteira, ou cima + baixo (conjunto)
  fabric: string
  colors: ProductColor[]
  sizes: string[]
  price: number // em centavos; 0 = não mostra preço
  description: string
  isNew: boolean
  soldOut: boolean
  hidden: boolean // escondida do site (continua no painel)
  photos: ProductPhoto[]
  swatch: string // recorte do tecido tirado da foto ('' = sem recorte): o "tecido de perto" da ficha
  createdAt: string
}

// Campos que o painel edita (o resto é gerado pelas funções)
export type ProductFields = Pick<
  Product,
  'name' | 'category' | 'fits' | 'fabric' | 'colors' | 'sizes' | 'price' | 'description' | 'isNew' | 'soldOut' | 'hidden'
>

// Foto do mural de clientes (lookbook), enviada pelo painel
export type MuralPhoto = {
  id: string
  title: string
  look: string
  date: string // "2025", "2025-03" ou "2025-03-15" (opcional, pode vir vazio)
  width: number
  height: number
  createdAt: string
}

// O que foi mudado no painel. Opção ausente = vale o padrão do código.
export type SiteSettings = {
  categories: Record<string, boolean>
  showPrices: boolean
}

// Recado deixado na seção Comunidade
export type CommunityComment = {
  id: string
  name: string
  city: string
  message: string
  rating: number // 1 a 5; 0 = sem nota
  createdAt: string
}

// Como o recado fica guardado: só os aprovados aparecem no site
export type StoredComment = CommunityComment & { status: 'pending' | 'approved' }

// Configuração dos recados: publicar direto ou esperar aprovação no painel
export type CommunityConfig = { autoPublish: boolean }

// Visitas por dia ("2026-10-11"), mais o total desde o começo
export type VisitStats = { total: number; days: Record<string, number> }

// O que o site recebe ao abrir (público)
export type SiteData = {
  settings: SiteSettings
  products: Product[] // só as que aparecem no site
  photos: MuralPhoto[]
  comments: CommunityComment[] // só os aprovados, mais recentes primeiro
  visits: number
  moderated: boolean // recados passam por aprovação antes de aparecer
}

// O que o painel recebe (com senha)
export type AdminData = {
  settings: SiteSettings
  products: Product[]
  photos: MuralPhoto[]
  comments: StoredComment[]
  visits: VisitStats
  community: CommunityConfig
}

export const emptySettings = (): SiteSettings => ({ categories: {}, showPrices: true })

export const categoryOn = (settings: SiteSettings, id: string) => settings.categories[id] ?? true

export function availableCategories(settings: SiteSettings) {
  return categories.filter((c) => categoryOn(settings, c.id))
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// Peças: as novidades primeiro, depois as mais recentes
export const productOrder = (a: Product, b: Product) => Number(b.isNew) - Number(a.isNew) || compare(b.createdAt, a.createdAt)

// Mural: mais recentes primeiro, pela data da foto (ou do envio, se não tiver data)
export const newestFirst = (a: MuralPhoto, b: MuralPhoto) =>
  compare(b.date || b.createdAt, a.date || a.createdAt) || compare(b.createdAt, a.createdAt)

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// "2025-03" → "março de 2025", "2025-03-15" → "15 de março de 2025", "2025" → "2025"
export function eventDateLabel(date: string) {
  const [year, month, day] = date.split('-')
  const name = month ? MONTHS[Number(month) - 1] : undefined
  if (!year || !name) return year ?? ''
  return day ? `${Number(day)} de ${name} de ${year}` : `${name} de ${year}`
}

// Média das notas (só conta quem deu nota)
export function averageRating(comments: CommunityComment[]) {
  const rated = comments.filter((c) => c.rating > 0)
  return { count: rated.length, average: rated.length ? rated.reduce((sum, c) => sum + c.rating, 0) / rated.length : 0 }
}
