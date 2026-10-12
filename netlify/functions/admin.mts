import type { Context } from '@netlify/functions'
import { newestFirst, productOrder, type AdminData, type MuralPhoto, type Product, type ProductPhoto } from '../../src/lib/siteTypes'
import { AnalysisError, analyzePhoto } from '../lib/analyze'
import { cleanProductFields } from '../lib/products'
import { cleanSettings, hasCategoryOn } from '../lib/settings'
import { clean } from '../lib/text'
import {
  EMPTY_COMMENTS,
  EMPTY_INDEX,
  EMPTY_PRODUCTS,
  env,
  hex,
  ITEM_ID,
  json,
  KEYS,
  newId,
  purgeSite,
  readComments,
  readCommunity,
  readProducts,
  readVisits,
  safeEqual,
  sha256,
  store,
  updateJSON,
  type CommentIndex,
  type PhotoIndex,
  type ProductIndex,
} from '../lib/store'

// Painel (/admin), protegido pela senha da variável de ambiente ADMIN_PASSWORD.
// GET: tudo o que o painel mostra. POST JSON { action }: peças do catálogo (criar, editar, fotos, apagar, analisar a foto com IA),
// fotos do mural de clientes, opções do site, recados e se os recados entram direto ou esperam aprovação.

// O Netlify aceita até 6 MB por chamada (contando o base64): a foto grande cabe com folga
const LIMITS = { title: 90, look: 60, thumb: 600 * 1024, full: 3 * 1024 * 1024, swatch: 120 * 1024, analyze: 1024 * 1024, photos: 400, products: 300, productPhotos: 6 }
const LOCK = { attempts: 8, ms: 15 * 60_000 }

type Body = Record<string, unknown>

// Data da foto do mural: "2025", "2025-03" ou "2025-03-15" (opcional)
function cleanDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/.test(text) ? text : ''
}

function size(value: unknown) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : 0
}

// A imagem chega em base64 dentro do JSON (o mesmo caminho funciona no Netlify e no `npm run dev`)
function bytes(value: unknown, max: number) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(max / 3) * 4) return null
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

// Confere os primeiros bytes do arquivo: só aceita imagem de verdade (WebP, JPEG ou PNG)
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

const validId = (value: unknown): value is string => typeof value === 'string' && ITEM_ID.test(value)

// Foto grande + miniatura vindas do painel (já reduzidas no navegador)
function readPhoto(body: Body): { full: Uint8Array; thumb: Uint8Array; fullType: string; thumbType: string; width: number; height: number } | Response {
  if (typeof body.full !== 'string' || typeof body.thumb !== 'string') return json({ error: 'Envie a foto.' }, 400)
  const full = bytes(body.full, LIMITS.full)
  const thumb = bytes(body.thumb, LIMITS.thumb)
  if (!full || !thumb) return json({ error: 'Foto grande demais ou com defeito.' }, 413)
  const fullType = sniff(full)
  const thumbType = sniff(thumb)
  if (!fullType || !thumbType) return json({ error: 'Formato de imagem não aceito. Use JPG, PNG ou WebP.' }, 415)
  const width = size(body.width)
  const height = size(body.height)
  if (!width || !height) return json({ error: 'Envio inválido.' }, 400)
  return { full, thumb, fullType, thumbType, width, height }
}

// Recorte do tecido (pequeno), usado como textura no manequim 3D
function readSwatch(value: unknown): { data: Uint8Array; type: string } | Response {
  const data = bytes(value, LIMITS.swatch)
  if (!data) return json({ error: 'Recorte do tecido inválido.' }, 400)
  const type = sniff(data)
  if (!type) return json({ error: 'Recorte do tecido inválido.' }, 415)
  return { data, type }
}

async function loadAll(): Promise<AdminData> {
  const s = store()
  const [settings, products, index, comments, visits, community] = await Promise.all([
    s.get(KEYS.settings, { type: 'json' }),
    readProducts(),
    s.get(KEYS.photos, { type: 'json' }),
    readComments(),
    readVisits(),
    readCommunity(),
  ])
  return { settings: cleanSettings(settings), products, photos: (index as PhotoIndex | null)?.photos ?? [], comments, visits, community }
}

// ---------- Catálogo ----------

// Foto reduzida no navegador → sugestões para o formulário da peça (não salva nada)
async function analyzeProduct(body: Body) {
  const image = bytes(body.image, LIMITS.analyze)
  if (!image) return json({ error: 'Foto grande demais ou com defeito.' }, 413)
  const type = sniff(image)
  if (!type) return json({ error: 'Formato de imagem não aceito. Use JPG, PNG ou WebP.' }, 415)
  try {
    return json({ analysis: await analyzePhoto(body.image as string, type) })
  } catch (err) {
    if (err instanceof AnalysisError) return json({ error: err.message }, err.status)
    throw err
  }
}


// Altera uma peça já cadastrada; devolve a peça atualizada (ou null se não existe)
async function changeProduct(id: string, change: (p: Product) => Product) {
  const index = await updateJSON<ProductIndex>(KEYS.products, EMPTY_PRODUCTS, (current) =>
    current.products.some((p) => p.id === id)
      ? { products: current.products.map((p) => (p.id === id ? change(p) : p)).sort(productOrder) }
      : current,
  )
  return index.products.find((p) => p.id === id) ?? null
}

async function createProduct(body: Body) {
  const result = cleanProductFields(body)
  if ('error' in result) return json({ error: result.error }, 400)

  const s = store()
  if ((await readProducts()).length >= LIMITS.products) {
    return json({ error: `O catálogo chegou a ${LIMITS.products} peças. Apague algumas antigas para cadastrar novas.` }, 409)
  }

  const id = newId()
  const photos: ProductPhoto[] = []
  const writes: Promise<unknown>[] = []
  // a foto é opcional: sem foto, a arara mostra o manequim vestido com a peça
  if (body.full !== undefined) {
    const photo = readPhoto(body)
    if (photo instanceof Response) return photo
    const key = newId()
    photos.push({ key, width: photo.width, height: photo.height })
    writes.push(
      s.set(KEYS.productPhoto(id, key, 'full'), photo.full.buffer as ArrayBuffer, { metadata: { type: photo.fullType } }),
      s.set(KEYS.productPhoto(id, key, 'thumb'), photo.thumb.buffer as ArrayBuffer, { metadata: { type: photo.thumbType } }),
    )
  }
  let swatch = ''
  if (body.swatch !== undefined && body.swatch !== '') {
    const piece = readSwatch(body.swatch)
    if (piece instanceof Response) return piece
    swatch = newId()
    writes.push(s.set(KEYS.swatch(id, swatch), piece.data.buffer as ArrayBuffer, { metadata: { type: piece.type } }))
  }
  await Promise.all(writes)

  const product: Product = { id, ...result.fields, photos, swatch, createdAt: new Date().toISOString() }
  await updateJSON<ProductIndex>(KEYS.products, EMPTY_PRODUCTS, (current) => ({
    products: [product, ...current.products.filter((p) => p.id !== id)].sort(productOrder),
  }))
  await purgeSite()
  return json({ product }, 201)
}

async function updateProduct(body: Body) {
  if (!validId(body.id)) return json({ error: 'Peça inválida.' }, 400)
  const result = cleanProductFields(body)
  if ('error' in result) return json({ error: result.error }, 400)

  // recorte do tecido: mantém (ausente), tira ('') ou troca (imagem nova)
  let swatch: string | undefined
  const s = store()
  if (body.swatch === '') swatch = ''
  else if (body.swatch !== undefined) {
    const piece = readSwatch(body.swatch)
    if (piece instanceof Response) return piece
    swatch = newId()
    await s.set(KEYS.swatch(body.id, swatch), piece.data.buffer as ArrayBuffer, { metadata: { type: piece.type } })
  }

  const previous = { swatch: '' }
  const product = await changeProduct(body.id, (p) => {
    previous.swatch = p.swatch
    return { ...p, ...result.fields, swatch: swatch ?? p.swatch }
  })
  if (!product) return json({ error: 'Peça não encontrada.' }, 404)
  if (swatch !== undefined && previous.swatch && previous.swatch !== swatch) await s.delete(KEYS.swatch(body.id, previous.swatch))
  await purgeSite()
  return json({ product })
}

async function addProductPhoto(body: Body) {
  if (!validId(body.id)) return json({ error: 'Peça inválida.' }, 400)
  const current = (await readProducts()).find((p) => p.id === body.id)
  if (!current) return json({ error: 'Peça não encontrada.' }, 404)
  if (current.photos.length >= LIMITS.productPhotos) return json({ error: `Cada peça pode ter até ${LIMITS.productPhotos} fotos.` }, 409)
  const photo = readPhoto(body)
  if (photo instanceof Response) return photo

  const s = store()
  const key = newId()
  await Promise.all([
    s.set(KEYS.productPhoto(body.id, key, 'full'), photo.full.buffer as ArrayBuffer, { metadata: { type: photo.fullType } }),
    s.set(KEYS.productPhoto(body.id, key, 'thumb'), photo.thumb.buffer as ArrayBuffer, { metadata: { type: photo.thumbType } }),
  ])
  const product = await changeProduct(body.id, (p) => ({ ...p, photos: [...p.photos, { key, width: photo.width, height: photo.height }] }))
  if (!product) return json({ error: 'Peça não encontrada.' }, 404)
  await purgeSite()
  return json({ product }, 201)
}

async function deleteProductPhoto(body: Body) {
  if (!validId(body.id) || !validId(body.key)) return json({ error: 'Foto inválida.' }, 400)
  const key = body.key
  const product = await changeProduct(body.id, (p) => ({ ...p, photos: p.photos.filter((photo) => photo.key !== key) }))
  if (!product) return json({ error: 'Peça não encontrada.' }, 404)
  const s = store()
  await Promise.all([s.delete(KEYS.productPhoto(body.id, key, 'full')), s.delete(KEYS.productPhoto(body.id, key, 'thumb'))])
  await purgeSite()
  return json({ product })
}

// Passa uma foto para a frente (vira a capa)
async function coverProductPhoto(body: Body) {
  if (!validId(body.id) || !validId(body.key)) return json({ error: 'Foto inválida.' }, 400)
  const key = body.key
  const product = await changeProduct(body.id, (p) => {
    const chosen = p.photos.find((photo) => photo.key === key)
    return chosen ? { ...p, photos: [chosen, ...p.photos.filter((photo) => photo.key !== key)] } : p
  })
  if (!product) return json({ error: 'Peça não encontrada.' }, 404)
  await purgeSite()
  return json({ product })
}

async function deleteProduct(id: unknown) {
  if (!validId(id)) return json({ error: 'Peça inválida.' }, 400)
  const found: { product?: Product } = {}
  await updateJSON<ProductIndex>(KEYS.products, EMPTY_PRODUCTS, (current) => {
    found.product = current.products.find((p) => p.id === id)
    return found.product ? { products: current.products.filter((p) => p.id !== id) } : current
  })
  const removed = found.product
  if (removed) {
    const s = store()
    await Promise.all([
      ...removed.photos.flatMap((photo) => [s.delete(KEYS.productPhoto(id, photo.key, 'full')), s.delete(KEYS.productPhoto(id, photo.key, 'thumb'))]),
      removed.swatch ? s.delete(KEYS.swatch(id, removed.swatch)) : Promise.resolve(),
    ])
  }
  await purgeSite([`img-${id}`])
  return json({ ok: true })
}

// ---------- Mural de clientes ----------

async function muralUpload(body: Body) {
  const photo = readPhoto(body)
  if (photo instanceof Response) return photo

  const s = store()
  const index = (await s.get(KEYS.photos, { type: 'json' })) as PhotoIndex | null
  if ((index?.photos.length ?? 0) >= LIMITS.photos) {
    return json({ error: `O mural chegou a ${LIMITS.photos} fotos. Apague algumas antigas para enviar novas.` }, 409)
  }

  const id = newId()
  const item: MuralPhoto = {
    id,
    title: clean(body.title, LIMITS.title),
    look: clean(body.look, LIMITS.look),
    date: cleanDate(body.date),
    width: photo.width,
    height: photo.height,
    createdAt: new Date().toISOString(),
  }

  await Promise.all([
    s.set(KEYS.photo(id, 'full'), photo.full.buffer as ArrayBuffer, { metadata: { type: photo.fullType } }),
    s.set(KEYS.photo(id, 'thumb'), photo.thumb.buffer as ArrayBuffer, { metadata: { type: photo.thumbType } }),
  ])
  await updateJSON<PhotoIndex>(KEYS.photos, EMPTY_INDEX, (current) => ({
    photos: [item, ...current.photos.filter((p) => p.id !== id)].sort(newestFirst),
  }))
  await purgeSite()
  return json({ photo: item }, 201)
}

// Corrige título, look ou data de uma foto já publicada
async function muralEdit(body: Body) {
  const id = body.id
  if (!validId(id)) return json({ error: 'Foto inválida.' }, 400)
  const fields = { title: clean(body.title, LIMITS.title), look: clean(body.look, LIMITS.look), date: cleanDate(body.date) }
  const index = await updateJSON<PhotoIndex>(KEYS.photos, EMPTY_INDEX, (current) =>
    current.photos.some((p) => p.id === id)
      ? { photos: current.photos.map((p) => (p.id === id ? { ...p, ...fields } : p)).sort(newestFirst) }
      : current,
  )
  const photo = index.photos.find((p) => p.id === id)
  if (!photo) return json({ error: 'Foto não encontrada.' }, 404)
  await purgeSite()
  return json({ photo })
}

async function muralDelete(id: unknown) {
  if (!validId(id)) return json({ error: 'Foto inválida.' }, 400)
  const s = store()
  await updateJSON<PhotoIndex>(KEYS.photos, EMPTY_INDEX, (current) => ({ photos: current.photos.filter((p) => p.id !== id) }))
  await Promise.all([s.delete(KEYS.photo(id, 'full')), s.delete(KEYS.photo(id, 'thumb'))])
  await purgeSite([`img-${id}`])
  return json({ ok: true })
}

// ---------- Opções e comunidade ----------

async function saveSettings(raw: unknown) {
  const settings = cleanSettings(raw)
  if (!hasCategoryOn(settings)) return json({ error: 'Deixe pelo menos uma categoria ligada.' }, 400)
  await store().setJSON(KEYS.settings, settings)
  await purgeSite()
  return json({ settings })
}

// Recado: aprovar (aparece no site) ou esconder (volta para "aguardando")
async function setCommentStatus(id: unknown, status: unknown) {
  if (!validId(id)) return json({ error: 'Recado inválido.' }, 400)
  if (status !== 'approved' && status !== 'pending') return json({ error: 'Ação inválida.' }, 400)
  const index = await updateJSON<CommentIndex>(KEYS.comments, EMPTY_COMMENTS, (current) =>
    current.comments.some((c) => c.id === id) ? { comments: current.comments.map((c) => (c.id === id ? { ...c, status } : c)) } : current,
  )
  const comment = index.comments.find((c) => c.id === id)
  if (!comment) return json({ error: 'Recado não encontrado.' }, 404)
  await purgeSite()
  return json({ comment })
}

async function deleteComment(id: unknown) {
  if (!validId(id)) return json({ error: 'Recado inválido.' }, 400)
  await updateJSON<CommentIndex>(KEYS.comments, EMPTY_COMMENTS, (current) => ({ comments: current.comments.filter((c) => c.id !== id) }))
  await purgeSite()
  return json({ ok: true })
}

async function saveCommunity(raw: unknown) {
  const community = { autoPublish: (raw as { autoPublish?: unknown } | null)?.autoPublish === true }
  await store().setJSON(KEYS.community, community)
  await purgeSite()
  return json({ community })
}

// Trava por alguns minutos depois de várias senhas erradas seguidas (por IP)
async function lockKey(ip: string) {
  return 'admin-lock/' + hex((await sha256(`${ip}:anghel-modas`)).slice(0, 12))
}

export default async (req: Request, context: Context) => {
  const password = env('ADMIN_PASSWORD')
  if (!password) return json({ error: 'Defina a variável ADMIN_PASSWORD no Netlify para usar o painel.' }, 503)

  const s = store()
  const key = await lockKey(context.ip ?? 'desconhecido')
  const lock = (await s.get(key, { type: 'json' })) as { fails: number; until: number; last?: number } | null
  const now = Date.now()
  if (lock && lock.until > now) return json({ error: 'Muitas tentativas erradas. Tente de novo em alguns minutos.' }, 429)

  const sent = req.headers.get('x-admin-password') ?? ''
  if (!(await safeEqual(sent, password))) {
    // erros antigos (mais de 15 minutos atrás) não contam
    const recent = lock && now - (lock.last ?? 0) < LOCK.ms ? lock.fails : 0
    const fails = recent + 1
    await s.setJSON(key, fails >= LOCK.attempts ? { fails: 0, until: now + LOCK.ms, last: now } : { fails, until: 0, last: now })
    return json({ error: 'Senha incorreta.' }, 401)
  }
  if (lock) await s.delete(key)

  if (req.method === 'GET') return json(await loadAll())
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Envio inválido.' }, 400)
  }
  switch (body.action) {
    case 'product-create':
      return createProduct(body)
    case 'product-update':
      return updateProduct(body)
    case 'product-photo-add':
      return addProductPhoto(body)
    case 'product-photo-delete':
      return deleteProductPhoto(body)
    case 'product-photo-cover':
      return coverProductPhoto(body)
    case 'product-delete':
      return deleteProduct(body.id)
    case 'product-analyze':
      return analyzeProduct(body)
    case 'mural-upload':
      return muralUpload(body)
    case 'mural-edit':
      return muralEdit(body)
    case 'mural-delete':
      return muralDelete(body.id)
    case 'settings':
      return saveSettings(body.settings)
    case 'comment-status':
      return setCommentStatus(body.id, body.status)
    case 'comment-delete':
      return deleteComment(body.id)
    case 'community':
      return saveCommunity(body.community)
    default:
      return json({ error: 'Ação inválida.' }, 400)
  }
}
