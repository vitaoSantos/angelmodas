import type {
  AdminData,
  CommunityComment,
  CommunityConfig,
  MuralPhoto,
  Product,
  ProductFields,
  SiteData,
  SiteSettings,
  StoredComment,
} from './siteTypes'

// Chamadas às Netlify Functions (catálogo, mural, recados, visitas e painel)
const FN = '/.netlify/functions'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${FN}/${path}`, init)
  const data = await res.json().catch(() => null)
  if (!res.ok || data === null) throw new Error(data?.error ?? 'Não foi possível completar a ação agora.')
  return data as T
}

export function fetchSiteData() {
  return request<SiteData>('site')
}

// Endereços das imagens guardadas pelo painel
export function muralUrl(id: string, size: 'thumb' | 'full') {
  return `${FN}/image?tipo=mural&id=${encodeURIComponent(id)}&tamanho=${size}`
}

export function productPhotoUrl(id: string, key: string, size: 'thumb' | 'full') {
  return `${FN}/image?tipo=peca&id=${encodeURIComponent(id)}&foto=${encodeURIComponent(key)}&tamanho=${size}`
}

export function swatchUrl(id: string, key: string) {
  return `${FN}/image?tipo=tecido&id=${encodeURIComponent(id)}&foto=${encodeURIComponent(key)}`
}

const postJSON = (body: object) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

// Conta a visita (o site chama no máximo uma vez por dia neste navegador)
export function postVisit() {
  return request<{ total: number; counted: boolean }>('visit', postJSON({}))
}

export type CommentDraft = { name: string; city: string; message: string; rating: number; website: string; elapsed: number }

// Recado da seção Comunidade. Volta "approved" (já aparece) ou "pending" (espera aprovação).
export function postComment(draft: CommentDraft) {
  return request<{ status: 'approved' | 'pending'; comment?: CommunityComment }>('comment', postJSON(draft))
}

// Painel (/admin): a senha vai em um cabeçalho e é conferida na função
const adminHeaders = (password: string) => ({ 'x-admin-password': password })

export function adminLoad(password: string) {
  return request<AdminData>('admin', { headers: adminHeaders(password) })
}

function adminAction<T>(password: string, body: object) {
  return request<T>('admin', {
    method: 'POST',
    headers: { ...adminHeaders(password), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Foto já reduzida no navegador, em base64: a grande e a miniatura
export type PhotoUpload = { full: string; thumb: string; width: number; height: number }

// Peças do catálogo. `swatch`: recorte do tecido em base64 ('' tira o recorte; ausente mantém)
export function adminCreateProduct(password: string, fields: ProductFields, photo?: PhotoUpload, swatch?: string) {
  return adminAction<{ product: Product }>(password, { action: 'product-create', ...fields, ...photo, swatch })
}

export function adminUpdateProduct(password: string, id: string, fields: ProductFields, swatch?: string) {
  return adminAction<{ product: Product }>(password, { action: 'product-update', id, ...fields, swatch })
}

export function adminAddProductPhoto(password: string, id: string, photo: PhotoUpload) {
  return adminAction<{ product: Product }>(password, { action: 'product-photo-add', id, ...photo })
}

export function adminDeleteProductPhoto(password: string, id: string, key: string) {
  return adminAction<{ product: Product }>(password, { action: 'product-photo-delete', id, key })
}

export function adminCoverProductPhoto(password: string, id: string, key: string) {
  return adminAction<{ product: Product }>(password, { action: 'product-photo-cover', id, key })
}

// Sugestões da IA para a peça da foto (`image`: JPEG em base64). `point`: onde o tecido aparece bem (0 a 1)
export type PhotoAnalysis = Pick<ProductFields, 'name' | 'category' | 'fits' | 'fabric' | 'colors' | 'description'> & { point: { x: number; y: number } }

export function adminAnalyzePhoto(password: string, image: string) {
  return adminAction<{ analysis: PhotoAnalysis }>(password, { action: 'product-analyze', image })
}

export function adminDeleteProduct(password: string, id: string) {
  return adminAction<{ ok: true }>(password, { action: 'product-delete', id })
}

// Mural de clientes
export type MuralFields = Pick<MuralPhoto, 'title' | 'look' | 'date'>

export function adminMuralUpload(password: string, photo: MuralFields & PhotoUpload) {
  return adminAction<{ photo: MuralPhoto }>(password, { action: 'mural-upload', ...photo })
}

export function adminMuralEdit(password: string, id: string, fields: MuralFields) {
  return adminAction<{ photo: MuralPhoto }>(password, { action: 'mural-edit', id, ...fields })
}

export function adminMuralDelete(password: string, id: string) {
  return adminAction<{ ok: true }>(password, { action: 'mural-delete', id })
}

export function adminSaveSettings(password: string, settings: SiteSettings) {
  return adminAction<{ settings: SiteSettings }>(password, { action: 'settings', settings })
}

export function adminCommentStatus(password: string, id: string, status: StoredComment['status']) {
  return adminAction<{ comment: StoredComment }>(password, { action: 'comment-status', id, status })
}

export function adminCommentDelete(password: string, id: string) {
  return adminAction<{ ok: true }>(password, { action: 'comment-delete', id })
}

export function adminCommunity(password: string, community: CommunityConfig) {
  return adminAction<{ community: CommunityConfig }>(password, { action: 'community', community })
}
