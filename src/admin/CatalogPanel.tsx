import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  TbArrowLeft,
  TbCheck,
  TbColorPicker,
  TbCloudUpload,
  TbEyeOff,
  TbLoader2,
  TbPencil,
  TbPhotoPlus,
  TbPlus,
  TbSearch,
  TbStar,
  TbTrash,
  TbX,
} from 'react-icons/tb'
import type { WornPiece } from '../components/three/Mannequin'
import { newSpin } from '../components/three/shared'
import { PieceThumb } from '../components/ui/PieceThumb'
import { categories, categoryById, fabrics, formatPrice, nearestColorName, palette, sizes, sortSizes } from '../data/catalog'
import { fitById, fits, suggestedFits, validFits, type Slot } from '../data/fits'
import { useSpinDrag } from '../hooks/useSpinDrag'
import {
  adminAddProductPhoto,
  adminCoverProductPhoto,
  adminCreateProduct,
  adminDeleteProduct,
  adminDeleteProductPhoto,
  adminUpdateProduct,
  productPhotoUrl,
  swatchUrl,
  type PhotoUpload,
} from '../lib/api'
import { cropSwatch, decodeImage, encodeImage, pickColor, suggestColor, toBase64 } from '../lib/images'
import { productOrder, type Product, type ProductFields } from '../lib/siteTypes'
import { field, Notice, PanelHeader, Switch, useLeaveWarning, type PanelProps } from './ui'

const FittingStage = lazy(() => import('../components/three/FittingStage'))

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <p className="p-6 text-sm text-muted">A prévia 3D não abriu neste navegador.</p> : this.props.children
  }
}

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
  colors: p.colors,
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
        As peças cadastradas aqui aparecem na arara 3D e no provador do site. Pode fotografar direto do celular: o painel diminui a foto,
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
          <span className="max-w-sm text-sm text-muted">Fotos, cores, tamanhos, preço e o molde que aparece no manequim 3D.</span>
        </button>
      )}

      <section aria-labelledby="pecas" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-8">
          <h2 id="pecas" className="font-display text-3xl">
            No catálogo <span className="text-base text-muted">· {data.products.length} {data.products.length === 1 ? 'peça' : 'peças'}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Buscar peça</span>
              <TbSearch aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
              <input className={`${field} w-56 pl-10`} placeholder="Buscar pelo nome" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select className={`${field} w-auto`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria">
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
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
  const [touchedFits, setTouchedFits] = useState(Boolean(product))
  const [current, setCurrent] = useState(product)
  const previews = useRef(new Set<string>())
  const dirty = Boolean(photos.length) || swatch.kind !== 'keep' || JSON.stringify(fields) !== JSON.stringify(product ? fieldsOf(product) : emptyFields())
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

  function changeCategory(id: string) {
    setFields((f) => ({ ...f, category: id, fits: touchedFits ? f.fits : (suggestedFits[id] ?? []) }))
  }

  async function save() {
    const payload: ProductFields = { ...fields, price: parsePrice(price), fits: validFits(fields.fits), sizes: sortSizes(fields.sizes) }
    if (payload.name.trim().length < 2) return setError('Dê um nome para a peça.')
    if (!payload.colors.length) return setError('Coloque pelo menos uma cor.')
    setError('')
    try {
      const swatchData = swatch.kind === 'new' ? await toBase64(swatch.blob) : swatch.kind === 'remove' ? '' : undefined
      let saved: Product
      const queue = [...photos]
      if (!current) {
        setBusy('Enviando a capa…')
        const first = queue.shift()
        const cover = first ? await preparePhoto(first.file) : undefined
        saved = (await adminCreateProduct(password, payload, cover, cover ? swatchData : undefined)).product
      } else {
        setBusy('Salvando…')
        saved = (await adminUpdateProduct(password, current.id, payload, swatchData)).product
      }
      setCurrent(saved)
      update((d) => ({ ...d, products: [saved, ...d.products.filter((p) => p.id !== saved.id)].sort(productOrder) }))
      // as outras fotos vão uma por vez (cada chamada tem limite de tamanho)
      for (let i = 0; i < queue.length; i++) {
        setBusy(`Enviando foto ${i + 1} de ${queue.length}…`)
        saved = (await adminAddProductPhoto(password, saved.id, await preparePhoto(queue[i].file))).product
        update((d) => ({ ...d, products: d.products.map((p) => (p.id === saved.id ? saved : p)) }))
      }
      setPhotos([])
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

  const slot = (id: string) => fitById(id)?.slot
  const isSet = fields.category === 'conjuntos'
  const topFit = fields.fits.find((f) => slot(f) === 'top') ?? ''
  const bottomFit = fields.fits.find((f) => slot(f) === 'bottom') ?? ''
  const singleFit = fields.fits[0] ?? ''
  const swatchPreview =
    swatch.kind === 'new' ? swatch.preview : swatch.kind === 'keep' && current?.swatch ? swatchUrl(current.id, current.swatch) : ''
  const previewPieces = useMemo(
    () =>
      validFits(fields.fits).map((fit) => ({
        key: `preview:${fit}`,
        fit,
        color: fields.colors[pickedColor]?.hex ?? fields.colors[0]?.hex ?? '#b9a08a',
        fabric: fields.fabric,
        swatch: swatchPreview && (pickedColor === 0 || fields.fabric !== 'estampado') ? swatchPreview : undefined,
      })),
    [fields.fits, fields.colors, fields.fabric, pickedColor, swatchPreview],
  )
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

          {picker ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-muted">
                <TbColorPicker aria-hidden className="text-gold" /> Toque no tecido da foto para tirar a cor
                {fields.colors.length > 1 && <> da cor {pickedColor + 1}</>} e o recorte do tecido para o manequim 3D
              </p>
              <div className="relative overflow-hidden rounded-2xl bg-ink-3">
                <img src={picker.url} alt="Foto para tirar a cor" onClick={(e) => void pickAt(e)} className="max-h-[26rem] w-full cursor-crosshair object-contain" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {swatchPreview ? (
                  <>
                    <span className="size-12 rounded-full bg-cover bg-center ring-2 ring-gold/60" style={{ backgroundImage: `url("${swatchPreview}")` }} />
                    <span className="text-muted">Recorte do tecido (vira a textura no 3D)</span>
                    <button type="button" onClick={() => setSwatch({ kind: 'remove' })} className="text-gold hover:underline">
                      tirar recorte
                    </button>
                  </>
                ) : (
                  <span className="text-faint">Sem recorte de tecido: o 3D usa só a cor.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-line px-4 py-3 text-sm text-faint">
              Com uma foto, dá para tocar no tecido e tirar a cor certinha e um recorte do tecido para o manequim 3D.
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

          <div className="grid gap-2 text-sm text-muted">
            <span>Molde no provador 3D</span>
            {isSet ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FitSelect
                  label="Parte de cima"
                  slots={['top']}
                  value={topFit}
                  onChange={(v) => {
                    setTouchedFits(true)
                    set({ fits: [v, bottomFit].filter(Boolean) })
                  }}
                />
                <FitSelect
                  label="Parte de baixo"
                  slots={['bottom']}
                  value={bottomFit}
                  onChange={(v) => {
                    setTouchedFits(true)
                    set({ fits: [topFit, v].filter(Boolean) })
                  }}
                />
              </div>
            ) : (
              <FitSelect
                label="Molde"
                slots={['top', 'bottom', 'full']}
                value={singleFit}
                onChange={(v) => {
                  setTouchedFits(true)
                  set({ fits: v ? [v] : [] })
                }}
              />
            )}
            <span className="text-xs text-faint">É o formato que veste o manequim. Escolha o mais parecido; a prévia ao lado mostra como fica.</span>
          </div>

          <div className="grid gap-2 text-sm text-muted">
            <span>Cores {fields.colors.length > 1 && <span className="text-faint">· toque numa cor para usar o conta-gotas nela</span>}</span>
            <ul className="grid gap-2">
              {fields.colors.map((c, i) => (
                <li key={i} className={`flex items-center gap-2 rounded-2xl border p-2 ${pickedColor === i ? 'border-gold/60 bg-gold/[0.05]' : 'border-line'}`}>
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
                  <button
                    type="button"
                    onClick={() => {
                      setFields((f) => ({ ...f, colors: f.colors.filter((_, k) => k !== i) }))
                      setPickedColor(0)
                    }}
                    aria-label={`Tirar a cor ${i + 1}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:text-red-300"
                  >
                    <TbX aria-hidden />
                  </button>
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

      {/* Prévia no manequim */}
      {previewPieces.length > 0 && <Preview pieces={previewPieces} />}

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

const SLOT_LABEL: Record<Slot, string> = { top: 'Parte de cima', bottom: 'Parte de baixo', full: 'Peça inteira' }

function FitSelect({ label, slots, value, onChange }: { label: string; slots: Slot[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className={field} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      <option value="">{slots.length > 1 ? 'Não aparece no provador' : `${label}: nenhuma`}</option>
      {slots.map((slot) => (
        <optgroup key={slot} label={SLOT_LABEL[slot]}>
          {fits
            .filter((f) => f.slot === slot)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  )
}

// Prévia: o manequim vestido com a peça do jeito que está no formulário
function Preview({ pieces }: { pieces: WornPiece[] }) {
  const spin = useRef(newSpin())
  const onDrag = useSpinDrag(spin)
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted">Prévia no manequim 3D · arraste para girar</p>
      <div className="relative h-[28rem] touch-pan-y select-none overflow-hidden rounded-2xl bg-ink-3" data-cursor="drag" onPointerDown={onDrag}>
        <Boundary>
          <Suspense fallback={<p className="p-6 text-sm text-muted">Abrindo a prévia…</p>}>
            <FittingStage pieces={pieces} spin={spin} active mobile={false} reduced={false} background="#211c19" />
          </Suspense>
        </Boundary>
      </div>
    </div>
  )
}
