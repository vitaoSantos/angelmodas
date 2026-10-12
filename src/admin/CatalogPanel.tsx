import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  TbArrowLeft,
  TbCheck,
  TbColorPicker,
  TbCloudUpload,
  TbEyeOff,
  TbHanger,
  TbLoader2,
  TbPencil,
  TbPhotoPlus,
  TbPlus,
  TbSearch,
  TbSparkles,
  TbStar,
  TbTrash,
  TbX,
} from 'react-icons/tb'
import { PieceImage } from '../components/ui/PieceImage'
import { PieceThumb } from '../components/ui/PieceThumb'
import { categories, categoryById, fabrics, formatPrice, nearestColorName, palette, sizes, sortSizes } from '../data/catalog'
import { suggestedFits, validFits, wearOptionOf, wearOptions, type Slot } from '../data/fits'
import {
  adminAddProductPhoto,
  adminAnalyzePhoto,
  adminCoverProductPhoto,
  adminCreateProduct,
  adminDeleteProduct,
  adminDeleteProductPhoto,
  adminSetPiece,
  adminUpdateProduct,
  pieceUrl,
  productPhotoUrl,
  swatchUrl,
  type PhotoUpload,
} from '../lib/api'
import { removeBackground } from '../lib/cutout'
import { cropSwatch, decodeImage, encodeImage, pickColor, suggestColor, toBase64 } from '../lib/images'
import type { PieceSource } from '../lib/products'
import { productOrder, type PiecePhoto, type Product, type ProductFields } from '../lib/siteTypes'
import { field, Notice, PanelHeader, Switch, useLeaveWarning, type PanelProps } from './ui'

// Tamanhos gerados no navegador antes do envio: a foto grande (ficha da peça) e a miniatura (arara e listas)
const FULL = { max: 1600, quality: 0.82 }
const THUMB = { max: 720, quality: 0.8 }
const MAX_FILE = 40 * 1024 * 1024
const MAX_PHOTOS = 6

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Não foi possível salvar agora.')

async function preparePhoto(file: File): Promise<PhotoUpload> {
  if (file.size > MAX_FILE) throw new Error('Arquivo grande demais (máximo de 40 MB).')
  const bitmap = await decodeImage(file)
  try {
    const full = await encodeImage(bitmap, FULL.max, FULL.quality)
    const thumb = await encodeImage(bitmap, THUMB.max, THUMB.quality)
    return { full: await toBase64(full.blob), thumb: await toBase64(thumb.blob), width: full.width, height: full.height }
  } finally {
    bitmap.close()
  }
}

const emptyFields = (): ProductFields => ({
  name: '',
  category: categories[0].id,
  fits: suggestedFits[categories[0].id] ?? [],
  fabric: 'malha',
  colors: [],
  sizes: ['P', 'M', 'G'],
  price: 0,
  description: '',
  isNew: true,
  soldOut: false,
  hidden: false,
})

const fieldsOf = (p: Product): ProductFields => ({
  name: p.name,
  category: p.category,
  fits: p.fits,
  fabric: p.fabric,
  colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
  sizes: p.sizes,
  price: p.price,
  description: p.description,
  isNew: p.isNew,
  soldOut: p.soldOut,
  hidden: p.hidden,
})

// "129,90" → 12990 centavos
function parsePrice(text: string) {
  const clean = text.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Math.round(Number(clean) * 100)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const priceText = (cents: number) => (cents ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')

export function CatalogPanel({ password, data, update }: PanelProps) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const top = useRef<HTMLDivElement>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.products]
      .sort(productOrder)
      .filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q)))
  }, [data.products, query, category])

  function open(target: Product | 'new') {
    setNotice(null)
    setEditing(target)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div ref={top} className="grid scroll-mt-28 gap-12">
      <PanelHeader title="Catálogo">
        As peças cadastradas aqui aparecem na arara e no provador do site. Pode fotografar direto do celular: o painel diminui a foto,
        gira se precisar e tira a localização antes de publicar.
      </PanelHeader>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {editing ? (
        <ProductEditor
          key={editing === 'new' ? 'new' : editing.id}
          password={password}
          product={editing === 'new' ? null : editing}
          update={update}
          onDone={(text) => {
            setEditing(null)
            if (text) setNotice({ tone: 'ok', text })
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => open('new')}
          className="flex flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-line-strong bg-cream/[0.02] px-6 py-10 text-center transition-colors hover:border-gold/60 hover:bg-gold/[0.05]"
        >
          <span className="grid size-14 place-items-center rounded-full bg-gradient-brand text-2xl text-ink">
            <TbPlus aria-hidden />
          </span>
          <span className="font-display text-2xl">Cadastrar peça nova</span>
          <span className="max-w-sm text-sm text-muted">Fotos, cores (com a foto da peça sozinha), tamanhos, preço e onde veste no provador.</span>
        </button>
      )}

      <section aria-labelledby="pecas" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-8">
          <h2 id="pecas" className="font-display text-3xl">
            No catálogo <span className="text-base text-muted">· {data.products.length} {data.products.length === 1 ? 'peça' : 'peças'}</span>
          </h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="relative w-full sm:w-56">
              <span className="sr-only">Buscar peça</span>
              <TbSearch aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
              <input className={`${field} pl-10`} placeholder="Buscar pelo nome" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="w-full sm:w-52">
              <span className="sr-only">Filtrar por categoria</span>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {data.products.length === 0 ? (
          <p className="text-muted">
            Nenhuma peça ainda. Enquanto o catálogo estiver vazio, o site mostra uma coleção de exemplo (sem preço) para a vitrine não ficar
            vazia. Assim que a primeira peça for cadastrada, a coleção de exemplo some.
          </p>
        ) : list.length === 0 ? (
          <p className="text-muted">Nenhuma peça encontrada.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} password={password} update={update} onEdit={() => open(p)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ProductCard({ product, password, update, onEdit }: { product: Product; password: string; update: PanelProps['update']; onEdit: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!window.confirm(`Apagar "${product.name}" do catálogo? As fotos dela também são apagadas.`)) return
    setBusy(true)
    setError('')
    try {
      await adminDeleteProduct(password, product.id)
      update((d) => ({ ...d, products: d.products.filter((p) => p.id !== product.id) }))
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const badges = [product.isNew && 'Novidade', product.soldOut && 'Esgotado', product.hidden && 'Escondida'].filter(Boolean) as string[]

  return (
    <li className={`flex flex-col gap-3 rounded-[1.5rem] border border-line bg-ink-2 p-2.5 transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-3">
        <PieceThumb product={product} />
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button type="button" onClick={onEdit} disabled={busy} aria-label="Editar peça" className="grid size-9 place-items-center rounded-full bg-ink/80 text-cream hover:bg-ink">
            <TbPencil aria-hidden />
          </button>
          <button type="button" onClick={() => void remove()} disabled={busy} aria-label="Apagar peça" className="grid size-9 place-items-center rounded-full bg-ink/80 text-red-300 hover:bg-ink">
            <TbTrash aria-hidden />
          </button>
        </div>
        {badges.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-soft">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 px-1 pb-1">
        <p className="truncate font-medium">{product.name}</p>
        <p className="truncate text-sm text-muted">
          {categoryById(product.category)?.label} · {product.price ? formatPrice(product.price) : 'sem preço'}
        </p>
        <p className="mt-2 flex gap-1">
          {product.colors.map((c, i) => (
            <span key={c.hex + i} title={c.name} className="size-4 rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]" style={{ background: c.hex }} />
          ))}
        </p>
      </div>
      {error && <p className="px-1 pb-1 text-sm text-red-300">{error}</p>}
    </li>
  )
}

// ---------- Editor da peça ----------

type NewPhoto = { key: string; file: File; preview: string }

// Foto da peça sozinha de cada cor: a que já está publicada, uma nova (com e, se deu, sem fundo) ou nenhuma
type PieceVersion = { blob: Blob; preview: string; width: number; height: number }
type PieceState =
  | { kind: 'saved'; photo: PiecePhoto }
  | { kind: 'new'; plain: PieceVersion; cutout: PieceVersion | null; useCutout: boolean; note: string }
  | { kind: 'busy' }
  | null

const PIECE = { max: 1100, quality: 0.86 }
// recorte do tecido: mantém o que já tem, tira, ou troca por um novo
type SwatchChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; blob: Blob; preview: string }

function ProductEditor({
  password,
  product,
  update,
  onDone,
}: {
  password: string
  product: Product | null
  update: PanelProps['update']
  onDone: (notice?: string) => void
}) {
  const [fields, setFields] = useState<ProductFields>(() => (product ? fieldsOf(product) : emptyFields()))
  const [price, setPrice] = useState(() => priceText(product?.price ?? 0))
  const [photos, setPhotos] = useState<NewPhoto[]>([])
  const [swatch, setSwatch] = useState<SwatchChange>({ kind: 'keep' })
  const [picker, setPicker] = useState<{ bitmap: ImageBitmap; url: string } | null>(null)
  const [pickedColor, setPickedColor] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [ai, setAi] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; text: string }>({ state: 'idle', text: '' })
  const [touchedFits, setTouchedFits] = useState(Boolean(product))
  const [pieces, setPieces] = useState<PieceState[]>(() => (product?.colors ?? []).map((c) => (c.piece ? { kind: 'saved', photo: c.piece } : null)))
  const [current, setCurrent] = useState(product)
  const previews = useRef(new Set<string>())
  const savedPieces = (current?.colors ?? []).map((c) => c.piece?.key ?? '')
  const piecesChanged = fields.colors.some((_, i) => {
    const p = pieces[i]
    return p?.kind === 'new' || (p?.kind === 'saved' ? p.photo.key : '') !== (savedPieces[i] ?? '')
  })
  const dirty =
    Boolean(photos.length) || swatch.kind !== 'keep' || piecesChanged || JSON.stringify(fields) !== JSON.stringify(product ? fieldsOf(product) : emptyFields())
  useLeaveWarning(dirty || Boolean(busy))

  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // a foto do conta-gotas anterior sai da memória quando troca
  useEffect(() => () => picker?.bitmap.close(), [picker])

  const set = (patch: Partial<ProductFields>) => setFields((f) => ({ ...f, ...patch }))

  // Foto para o conta-gotas: a primeira nova ou a capa já publicada
  const pickerSource = photos[0]?.file ?? null
  const coverKey = current?.photos[0]?.key
  useEffect(() => {
    let cancelled = false
    let next: { bitmap: ImageBitmap; url: string } | null = null
    ;(async () => {
      try {
        if (pickerSource) {
          const bitmap = await decodeImage(pickerSource)
          const url = URL.createObjectURL(pickerSource)
          previews.current.add(url)
          next = { bitmap, url }
        } else if (current && coverKey) {
          const url = productPhotoUrl(current.id, coverKey, 'full')
          const blob = await (await fetch(url)).blob()
          next = { bitmap: await decodeImage(blob), url }
        }
        if (cancelled) next?.bitmap.close()
        else setPicker(next)
      } catch {
        if (!cancelled) setPicker(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickerSource, current, coverKey])

  function addFiles(files: FileList | File[]) {
    const room = MAX_PHOTOS - (current?.photos.length ?? 0) - photos.length
    const images = Array.from(files)
      .filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
      .slice(0, Math.max(0, room))
    const fresh = images.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return { key: `${file.name}-${Math.random().toString(36).slice(2)}`, file, preview }
    })
    setPhotos((list) => [...list, ...fresh])
    // primeira foto de uma peça nova: já sugere a cor pelo meio da foto
    if (fresh.length && !fields.colors.length) {
      void decodeImage(fresh[0].file).then((bitmap) => {
        const hex = suggestColor(bitmap)
        bitmap.close()
        setFields((f) => (f.colors.length ? f : { ...f, colors: [{ name: nearestColorName(hex), hex }] }))
      })
    }
  }

  // Foto da peça sozinha numa cor: tenta tirar o fundo na hora; se não der, fica a foto inteira
  async function choosePiece(i: number, file: File) {
    setPieces((list) => list.map((p, k) => (k === i ? { kind: 'busy' } : p)))
    const version = async (blob: Blob, width: number, height: number): Promise<PieceVersion> => {
      const preview = URL.createObjectURL(blob)
      previews.current.add(preview)
      return { blob, preview, width, height }
    }
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await decodeImage(file)
      const encoded = await encodeImage(bitmap, PIECE.max, PIECE.quality)
      const plain = await version(encoded.blob, encoded.width, encoded.height)
      let cutout: PieceVersion | null = null
      let note = ''
      try {
        const result = await removeBackground(bitmap)
        cutout = await version(result.blob, result.width, result.height)
      } catch (err) {
        note = errorText(err)
      }
      setPieces((list) => list.map((p, k) => (k === i ? { kind: 'new', plain, cutout, useCutout: Boolean(cutout), note } : p)))
    } catch (err) {
      setPieces((list) => list.map((p, k) => (k === i ? null : p)))
      setError(errorText(err))
    } finally {
      bitmap?.close()
    }
  }

  // O que a prévia e a lista mostram de cada cor
  function pieceShown(i: number): PieceSource | null {
    const p = pieces[i]
    if (p?.kind === 'saved' && current) return { kind: 'piece', url: pieceUrl(current.id, p.photo.key), cutout: p.photo.cutout }
    if (p?.kind === 'new') {
      const v = p.useCutout && p.cutout ? p.cutout : p.plain
      return { kind: 'piece', url: v.preview, cutout: p.useCutout && Boolean(p.cutout) }
    }
    return null
  }

  function removeColor(i: number) {
    setFields((f) => ({ ...f, colors: f.colors.filter((_, k) => k !== i) }))
    setPieces((list) => list.filter((_, k) => k !== i))
    setPickedColor(0)
  }

  async function pickAt(e: React.MouseEvent<HTMLImageElement>) {
    if (!picker) return
    const rect = e.currentTarget.getBoundingClientRect()
    // a imagem aparece inteira (object-contain): acha onde ela está dentro da caixa
    const scale = Math.min(rect.width / picker.bitmap.width, rect.height / picker.bitmap.height)
    const w = picker.bitmap.width * scale
    const h = picker.bitmap.height * scale
    const x = (e.clientX - rect.left - (rect.width - w) / 2) / w
    const y = (e.clientY - rect.top - (rect.height - h) / 2) / h
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    const hex = pickColor(picker.bitmap, x, y)
    setFields((f) => {
      const colors = [...f.colors]
      const i = Math.min(pickedColor, colors.length)
      // o nome só acompanha a cor nova se ainda for o nome automático (não foi digitado)
      const auto = !colors[i] || colors[i].name === nearestColorName(colors[i].hex)
      colors[i] = { name: auto ? nearestColorName(hex) : colors[i].name, hex }
      return { ...f, colors }
    })
    const blob = await cropSwatch(picker.bitmap, x, y)
    const preview = URL.createObjectURL(blob)
    previews.current.add(preview)
    setSwatch({ kind: 'new', blob, preview })
  }

  // A IA olha a foto e preenche categoria, onde veste, tecido e cores; no ponto que ela indica,
  // o conta-gotas tira a cor exata e o recorte do tecido
  async function analyze() {
    if (!picker) return
    const bitmap = picker.bitmap
    setAi({ state: 'busy', text: '' })
    try {
      const image = await encodeImage(bitmap, 1024, 0.85)
      const { analysis } = await adminAnalyzePhoto(password, await toBase64(image.blob))
      const { x, y } = analysis.point
      const exact = pickColor(bitmap, x, y)
      const colors = analysis.colors.length
        ? analysis.colors.map((c, i) => (i === 0 ? { ...c, hex: exact } : c))
        : [{ name: nearestColorName(exact), hex: exact }]
      setFields((f) => ({
        ...f,
        name: f.name.trim() ? f.name : analysis.name,
        description: f.description.trim() ? f.description : analysis.description,
        category: analysis.category,
        fits: analysis.fits.length ? analysis.fits : (suggestedFits[analysis.category] ?? []),
        fabric: analysis.fabric,
        colors,
      }))
      setPieces((list) => list.slice(0, colors.length))
      setTouchedFits(true)
      setPickedColor(0)
      const blob = await cropSwatch(bitmap, x, y)
      const preview = URL.createObjectURL(blob)
      previews.current.add(preview)
      setSwatch({ kind: 'new', blob, preview })
      setAi({ state: 'done', text: 'Pronto! Confira a categoria, onde veste, o tecido e as cores antes de salvar.' })
    } catch (err) {
      setAi({ state: 'error', text: errorText(err) })
    }
  }

  function changeCategory(id: string) {
    setFields((f) => ({ ...f, category: id, fits: touchedFits ? f.fits : (suggestedFits[id] ?? []) }))
  }

  async function save() {
    if (pieces.some((p) => p?.kind === 'busy')) return setError('Espere terminar de preparar a foto da peça.')
    // cada cor leva de volta a foto da peça que já está publicada (as novas vão depois, uma por vez)
    const colors = fields.colors.map((c, i) => {
      const p = pieces[i]
      return p?.kind === 'saved' ? { ...c, piece: p.photo } : c
    })
    const payload: ProductFields = { ...fields, colors, price: parsePrice(price), fits: validFits(fields.fits), sizes: sortSizes(fields.sizes) }
    if (payload.name.trim().length < 2) return setError('Dê um nome para a peça.')
    if (!payload.colors.length) return setError('Coloque pelo menos uma cor.')
    setError('')
    try {
      const swatchData = swatch.kind === 'new' ? await toBase64(swatch.blob) : swatch.kind === 'remove' ? '' : undefined
      let saved: Product
      const queue = [...photos]
      // cada foto enviada sai da fila na hora: se uma falhar, tentar de novo não repete as que já foram
      const sent = (key: string) => setPhotos((list) => list.filter((p) => p.key !== key))
      if (!current) {
        setBusy('Enviando a capa…')
        const first = queue.shift()
        const cover = first ? await preparePhoto(first.file) : undefined
        saved = (await adminCreateProduct(password, payload, cover, cover ? swatchData : undefined)).product
        if (first) sent(first.key)
      } else {
        setBusy('Salvando…')
        saved = (await adminUpdateProduct(password, current.id, payload, swatchData)).product
      }
      setCurrent(saved)
      setSwatch({ kind: 'keep' })
      update((d) => ({ ...d, products: [saved, ...d.products.filter((p) => p.id !== saved.id)].sort(productOrder) }))
      // fotos da peça sozinha de cada cor
      for (let i = 0; i < fields.colors.length; i++) {
        const p = pieces[i]
        if (p?.kind !== 'new') continue
        setBusy(`Enviando a foto da peça (cor ${i + 1})…`)
        const v = p.useCutout && p.cutout ? p.cutout : p.plain
        const upload = { image: await toBase64(v.blob), width: v.width, height: v.height, cutout: p.useCutout && Boolean(p.cutout) }
        saved = (await adminSetPiece(password, saved.id, i, upload)).product
        const photo = saved.colors[i]?.piece
        setPieces((list) => list.map((x, k) => (k === i && photo ? { kind: 'saved', photo } : x)))
        setCurrent(saved)
        update((d) => ({ ...d, products: d.products.map((x) => (x.id === saved.id ? saved : x)) }))
      }
      // as outras fotos vão uma por vez (cada chamada tem limite de tamanho)
      for (let i = 0; i < queue.length; i++) {
        setBusy(`Enviando foto ${i + 1} de ${queue.length}…`)
        saved = (await adminAddProductPhoto(password, saved.id, await preparePhoto(queue[i].file))).product
        sent(queue[i].key)
        setCurrent(saved)
        update((d) => ({ ...d, products: d.products.map((p) => (p.id === saved.id ? saved : p)) }))
      }
      setBusy('')
      onDone(current ? 'Peça atualizada! Em alguns segundos o site já mostra.' : 'Peça cadastrada! Em alguns segundos ela aparece na arara do site.')
    } catch (err) {
      setError(errorText(err))
      setBusy('')
    }
  }

  async function photoAction(key: string, action: 'cover' | 'delete') {
    if (!current) return
    if (action === 'delete' && !window.confirm('Apagar esta foto da peça?')) return
    setBusy(action === 'delete' ? 'Apagando a foto…' : 'Trocando a capa…')
    setError('')
    try {
      const saved = (action === 'delete' ? await adminDeleteProductPhoto(password, current.id, key) : await adminCoverProductPhoto(password, current.id, key)).product
      setCurrent(saved)
      update((d) => ({ ...d, products: d.products.map((p) => (p.id === saved.id ? saved : p)) }))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  const wear = wearOptionOf(fields.fits)
  const swatchPreview =
    swatch.kind === 'new' ? swatch.preview : swatch.kind === 'keep' && current?.swatch ? swatchUrl(current.id, current.swatch) : ''
  const previewColor = Math.min(pickedColor, Math.max(0, fields.colors.length - 1))
  const previewSource: PieceSource =
    pieceShown(previewColor) ??
    (photos[0] ? { kind: 'photo', url: photos[0].preview, cutout: false } : current?.photos[0] ? { kind: 'photo', url: productPhotoUrl(current.id, current.photos[0].key, 'thumb'), cutout: false } : { kind: 'none', url: '', cutout: false })
  const totalPhotos = (current?.photos.length ?? 0) + photos.length

  return (
    <section aria-label={current ? 'Editar peça' : 'Peça nova'} className="border-gradient grid gap-8 rounded-[2rem] bg-ink-2/80 p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onDone()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-cream">
          <TbArrowLeft aria-hidden /> Voltar para a lista
        </button>
        <h2 className="font-display text-3xl">{current ? 'Editar peça' : 'Peça nova'}</h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Fotos e conta-gotas */}
        <div className="grid content-start gap-5">
          <div>
            <p className="mb-2 text-sm text-muted">
              Fotos <span className="text-faint">· até {MAX_PHOTOS}, a primeira é a capa</span>
            </p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {current?.photos.map((photo, i) => (
                <li key={photo.key} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-ink-3">
                  <img src={productPhotoUrl(current.id, photo.key, 'thumb')} alt="" className="h-full w-full object-cover" />
                  {i === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-ink">Capa</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void photoAction(photo.key, 'cover')}
                      disabled={Boolean(busy)}
                      aria-label="Usar como capa"
                      title="Usar como capa"
                      className="absolute left-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/80 text-gold-soft"
                    >
                      <TbStar aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void photoAction(photo.key, 'delete')}
                    disabled={Boolean(busy)}
                    aria-label="Apagar foto"
                    className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/80 text-red-300"
                  >
                    <TbTrash aria-hidden />
                  </button>
                </li>
              ))}
              {photos.map((photo, i) => (
                <li key={photo.key} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-ink-3 ring-1 ring-gold/40">
                  <img src={photo.preview} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] text-gold-soft">
                    {!current && i === 0 ? 'Capa' : 'Nova'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotos((list) => list.filter((p) => p.key !== photo.key))}
                    disabled={Boolean(busy)}
                    aria-label="Tirar esta foto"
                    className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/80 text-cream"
                  >
                    <TbX aria-hidden />
                  </button>
                </li>
              ))}
              {totalPhotos < MAX_PHOTOS && (
                <li>
                  <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong text-center text-xs text-muted transition-colors hover:border-gold/60 hover:text-cream">
                    <TbPhotoPlus aria-hidden className="text-2xl" />
                    Adicionar
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.files?.length) addFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </li>
              )}
            </ul>
          </div>

          {picker && (
            <div className="grid gap-3 rounded-2xl border border-gold/30 bg-gold/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-sm text-sm text-muted">
                  <span className="font-medium text-cream">Preencher com IA:</span> a IA olha a foto e sugere nome, categoria, onde veste,
                  tecido e cores.
                </p>
                <button
                  type="button"
                  onClick={() => void analyze()}
                  disabled={ai.state === 'busy' || Boolean(busy)}
                  className="inline-flex items-center gap-2 rounded-full border border-gold/60 px-5 py-2.5 text-sm font-semibold text-gold-soft transition-colors hover:bg-gold/10 disabled:opacity-60"
                >
                  {ai.state === 'busy' ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbSparkles aria-hidden />}
                  {ai.state === 'busy' ? 'Analisando a foto…' : 'Analisar a foto'}
                </button>
              </div>
              {ai.text && (
                <p role="status" className={`text-sm ${ai.state === 'error' ? 'text-red-300' : 'text-mint'}`}>
                  {ai.text}
                </p>
              )}
            </div>
          )}

          {picker ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-muted">
                <TbColorPicker aria-hidden className="text-gold" /> Toque no tecido da foto para tirar a cor
                {fields.colors.length > 1 && <> da cor {pickedColor + 1}</>} e o recorte do tecido
              </p>
              <div className="relative overflow-hidden rounded-2xl bg-ink-3">
                <img src={picker.url} alt="Foto para tirar a cor" onClick={(e) => void pickAt(e)} className="max-h-[26rem] w-full cursor-crosshair object-contain" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {swatchPreview ? (
                  <>
                    <span className="size-12 rounded-full bg-cover bg-center ring-2 ring-gold/60" style={{ backgroundImage: `url("${swatchPreview}")` }} />
                    <span className="text-muted">Tecido de perto (aparece na ficha da peça)</span>
                    <button type="button" onClick={() => setSwatch({ kind: 'remove' })} className="text-gold hover:underline">
                      tirar recorte
                    </button>
                  </>
                ) : (
                  <span className="text-faint">Sem recorte de tecido: a ficha mostra só a cor.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-line px-4 py-3 text-sm text-faint">
              Com uma foto, dá para tocar no tecido e tirar a cor certinha e um recorte do tecido.
            </p>
          )}
        </div>

        {/* Campos */}
        <div className="grid content-start gap-5">
          <label className="grid gap-2 text-sm text-muted">
            Nome da peça
            <input className={field} value={fields.name} maxLength={80} placeholder="Ex.: Vestido longo canelado" onChange={(e) => set({ name: e.target.value })} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-muted">
              Categoria
              <select className={field} value={fields.category} onChange={(e) => changeCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-muted">
              Tecido
              <select className={field} value={fields.fabric} onChange={(e) => set({ fabric: e.target.value })}>
                {fabrics.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm text-muted">
            Onde veste no provador
            <select
              className={field}
              value={wear}
              onChange={(e) => {
                setTouchedFits(true)
                set({ fits: [...(wearOptions.find((o) => o.id === e.target.value)?.fits ?? [])] })
              }}
            >
              {wearOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-faint">No provador, a cliente combina a parte de cima com a de baixo, ou escolhe uma peça inteira.</span>
          </label>

          <div className="grid gap-2 text-sm text-muted">
            <span>
              Cores <span className="text-faint">· em cada cor, a foto da peça sozinha (esticada ou no cabide) é a que aparece no provador</span>
            </span>
            <ul className="grid gap-2">
              {fields.colors.map((c, i) => (
                <li key={i} className={`grid gap-2 rounded-2xl border p-2 ${pickedColor === i ? 'border-gold/60 bg-gold/[0.05]' : 'border-line'}`}>
                  <div className="flex items-center gap-2">
                  <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-line-strong" style={{ background: c.hex }}>
                    <span className="sr-only">Escolher a cor {i + 1}</span>
                    <input
                      type="color"
                      value={c.hex}
                      onChange={(e) => {
                        const hex = e.target.value
                        setFields((f) => ({ ...f, colors: f.colors.map((x, k) => (k === i ? { ...x, hex } : x)) }))
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <input
                    className={`${field} py-2`}
                    value={c.name}
                    maxLength={30}
                    aria-label={`Nome da cor ${i + 1}`}
                    onFocus={() => setPickedColor(i)}
                    onChange={(e) => setFields((f) => ({ ...f, colors: f.colors.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) }))}
                  />
                  <button
                    type="button"
                    onClick={() => setPickedColor(i)}
                    aria-label={`Usar o conta-gotas na cor ${i + 1}`}
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${pickedColor === i ? 'text-gold' : 'text-muted hover:text-cream'}`}
                  >
                    <TbColorPicker aria-hidden />
                  </button>
                  <PieceSlot
                    state={pieces[i] ?? null}
                    shown={pieceShown(i)}
                    color={i + 1}
                    disabled={Boolean(busy)}
                    onFile={(file) => {
                      setPickedColor(i)
                      void choosePiece(i, file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    aria-label={`Tirar a cor ${i + 1}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:text-red-300"
                  >
                    <TbX aria-hidden />
                  </button>
                  </div>
                  <PieceStatus
                    state={pieces[i] ?? null}
                    onToggle={() => setPieces((list) => list.map((p, k) => (k === i && p?.kind === 'new' ? { ...p, useCutout: !p.useCutout } : p)))}
                    onRemove={() => setPieces((list) => list.map((p, k) => (k === i ? null : p)))}
                  />
                </li>
              ))}
            </ul>
            {fields.colors.length < 8 && (
              <div className="flex flex-wrap gap-1.5">
                {palette.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    title={p.label}
                    aria-label={`Adicionar a cor ${p.label}`}
                    onClick={() => {
                      setFields((f) => ({ ...f, colors: [...f.colors, { name: p.label, hex: p.color }] }))
                      setPieces((list) => [...list.slice(0, fields.colors.length), null])
                      setPickedColor(fields.colors.length)
                    }}
                    className="size-7 rounded-full ring-1 ring-line-strong transition-transform hover:scale-110"
                    style={{ background: p.color }}
                  />
                ))}
              </div>
            )}
            <span className="text-xs text-faint">A primeira cor é a da foto. Os nomes aparecem no site e na mensagem do WhatsApp.</span>
          </div>

          <div className="grid gap-2 text-sm text-muted">
            <span>Tamanhos</span>
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => {
                const on = fields.sizes.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ sizes: on ? fields.sizes.filter((x) => x !== s) : [...fields.sizes, s] })}
                    className={`min-w-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-gold bg-gold/15 text-cream' : 'border-line text-muted hover:text-cream'}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-muted">
              Preço (opcional)
              <span className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">R$</span>
                <input className={`${field} pl-11`} inputMode="decimal" placeholder="129,90" value={price} onChange={(e) => setPrice(e.target.value)} />
              </span>
            </label>
            <div className="grid content-end gap-3 pb-1">
              <Toggle on={fields.isNew} label="Novidade" onToggle={() => set({ isNew: !fields.isNew })} />
              <Toggle on={fields.soldOut} label="Esgotada" onToggle={() => set({ soldOut: !fields.soldOut })} />
              <Toggle on={fields.hidden} label="Esconder do site" onToggle={() => set({ hidden: !fields.hidden })} icon={<TbEyeOff aria-hidden />} />
            </div>
          </div>

          <label className="grid gap-2 text-sm text-muted">
            Descrição (opcional)
            <textarea
              className={`${field} resize-none`}
              rows={3}
              maxLength={600}
              value={fields.description}
              placeholder="Ex.: Canelado encorpado, manguinha e fenda lateral."
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* Prévia no provador */}
      {wear !== 'nenhum' && (
        <ProvadorPreview
          source={previewSource}
          slot={wear === 'cima' ? 'top' : wear === 'baixo' ? 'bottom' : 'full'}
          name={fields.name || 'Peça nova'}
          hex={fields.colors[previewColor]?.hex}
          colorName={fields.colors[previewColor]?.name}
        />
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-7 py-3.5 font-semibold text-ink disabled:opacity-60"
        >
          {busy ? <TbLoader2 aria-hidden className="animate-spin" /> : current ? <TbCheck aria-hidden /> : <TbCloudUpload aria-hidden className="text-lg" />}
          {busy || (current ? 'Salvar mudanças' : 'Publicar peça')}
        </button>
        <button type="button" onClick={() => onDone()} disabled={Boolean(busy)} className="rounded-full px-5 py-3 text-sm text-muted hover:text-cream">
          Cancelar
        </button>
      </div>
    </section>
  )
}

function Toggle({ on, label, onToggle, icon }: { on: boolean; label: string; onToggle: () => void; icon?: ReactNode }) {
  return (
    <span className="flex items-center gap-3 text-sm text-cream">
      <Switch on={on} onToggle={onToggle} label={label} />
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </span>
  )
}

// Botão da foto da peça sozinha numa cor (miniatura quando já tem)
function PieceSlot({
  state,
  shown,
  color,
  disabled,
  onFile,
}: {
  state: PieceState
  shown: PieceSource | null
  color: number
  disabled: boolean
  onFile: (file: File) => void
}) {
  return (
    <label
      className={`relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl text-lg ring-1 transition-colors ${
        shown ? 'bg-[#efe6da] ring-gold/50' : 'border border-dashed border-line-strong text-muted ring-transparent hover:text-cream'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      title={shown ? 'Trocar a foto da peça' : 'Foto da peça sozinha'}
    >
      <span className="sr-only">{shown ? `Trocar a foto da peça da cor ${color}` : `Foto da peça sozinha na cor ${color}`}</span>
      {state?.kind === 'busy' ? (
        <TbLoader2 aria-hidden className="animate-spin text-gold" />
      ) : shown ? (
        <img src={shown.url} alt="" className={`h-full w-full ${shown.cutout ? 'object-contain p-0.5' : 'object-cover'}`} />
      ) : (
        <TbHanger aria-hidden />
      )}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}

// Linha embaixo da cor: se o fundo saiu, a escolha entre com e sem fundo, e o botão de tirar a foto
function PieceStatus({ state, onToggle, onRemove }: { state: PieceState; onToggle: () => void; onRemove: () => void }) {
  if (!state || state.kind === 'busy') {
    return state?.kind === 'busy' ? <p className="px-1 text-xs text-gold-soft">Tirando o fundo da foto…</p> : null
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
      {state.kind === 'new' ? (
        state.cutout ? (
          <span className="flex items-center gap-2 text-muted">
            <Switch on={state.useCutout} onToggle={onToggle} label="Usar sem fundo" />
            {state.useCutout ? 'Sem fundo' : 'Com o fundo da foto'}
          </span>
        ) : (
          <span className="text-muted">Foto com fundo. {state.note}</span>
        )
      ) : (
        <span className="text-faint">Foto da peça publicada{state.photo.cutout ? ', sem fundo' : ''}</span>
      )}
      <button type="button" onClick={onRemove} className="text-gold hover:underline">
        tirar a foto da peça
      </button>
    </div>
  )
}

// Prévia: a peça no papel do provador, do jeito que a cliente vai ver
function ProvadorPreview({ source, slot, name, hex, colorName }: { source: PieceSource; slot: Slot; name: string; hex?: string; colorName?: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted">
        Prévia no provador{colorName ? ` · cor ${colorName.toLowerCase()}` : ''}
        {source.kind === 'photo' && <span className="text-faint"> · sem a foto da peça sozinha, o provador usa a foto com modelo</span>}
      </p>
      <div className="grid justify-items-center rounded-2xl bg-ink-3 p-6">
        <div className={`w-full max-w-xs rounded-[1.5rem] bg-[#efe6da] ${slot === 'full' ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}>
          <PieceImage source={source} slot={slot} name={name} hex={hex} eager />
        </div>
      </div>
    </div>
  )
}
