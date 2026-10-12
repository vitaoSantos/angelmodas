import { useEffect, useRef, useState, type DragEvent } from 'react'
import { TbCheck, TbCloudUpload, TbExternalLink, TbLoader2, TbPencil, TbPhotoPlus, TbTrash, TbX } from 'react-icons/tb'
import { adminMuralDelete, adminMuralEdit, adminMuralUpload, muralUrl, type MuralFields } from '../lib/api'
import { decodeImage, encodeImage, toBase64 } from '../lib/images'
import { photoMonth } from '../lib/photoDate'
import { eventDateLabel, newestFirst, type MuralPhoto } from '../lib/siteTypes'
import { field, Notice, PanelHeader, useLeaveWarning, type PanelProps } from './ui'

// Tamanhos gerados no navegador antes do envio: a foto grande (para ampliar) e a miniatura do mural
const FULL = { max: 1800, quality: 0.82 }
const THUMB = { max: 800, quality: 0.8 }
const MAX_FILE = 40 * 1024 * 1024

type Draft = MuralFields & {
  key: string
  file: File
  preview: string
  status: 'waiting' | 'sending' | 'error'
  error: string
}

const EMPTY_FIELDS: MuralFields = { title: '', look: '', date: '' }

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Não foi possível enviar agora.')

const tooBig = (file: File) => file.size > MAX_FILE
const canSend = (d: Draft) => d.status !== 'sending' && !tooBig(d.file)

// Reduz a foto, cria a miniatura e envia. A foto é redesenhada do zero, então localização (GPS)
// e outros dados da câmera não vão junto.
async function publish(password: string, draft: Draft) {
  const bitmap = await decodeImage(draft.file)
  try {
    const full = await encodeImage(bitmap, FULL.max, FULL.quality)
    const thumb = await encodeImage(bitmap, THUMB.max, THUMB.quality)
    const upload = {
      full: await toBase64(full.blob),
      thumb: await toBase64(thumb.blob),
      width: full.width,
      height: full.height,
      title: draft.title,
      look: draft.look,
      date: draft.date,
    }
    return (await adminMuralUpload(password, upload)).photo
  } finally {
    bitmap.close()
  }
}

export function MuralPanel({ password, data, update }: PanelProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const previews = useRef(new Set<string>())
  // lista atual, para o envio em sequência pegar o que a pessoa digitou enquanto as outras subiam
  const latest = useRef(drafts)
  useEffect(() => {
    latest.current = drafts
  }, [drafts])

  // libera as prévias quando sai do painel
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function drop(key: string) {
    const gone = latest.current.find((d) => d.key === key)
    if (gone) {
      URL.revokeObjectURL(gone.preview)
      previews.current.delete(gone.preview)
    }
    setDrafts((list) => list.filter((d) => d.key !== key))
  }

  function patch(key: string, change: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)))
  }

  function add(files: FileList | File[]) {
    setNotice(null)
    const images = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
    const skipped = files.length - images.length
    const fresh: Draft[] = images.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      return {
        ...EMPTY_FIELDS,
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        preview,
        status: tooBig(file) ? 'error' : 'waiting',
        error: tooBig(file) ? 'Arquivo grande demais (máximo de 40 MB).' : '',
      }
    })
    setDrafts((list) => [...list, ...fresh])
    if (skipped) {
      setNotice({
        tone: 'error',
        text: skipped === 1 ? 'Um dos arquivos não é imagem e ficou de fora.' : `${skipped} arquivos não são imagens e ficaram de fora.`,
      })
    }
    // já sugere o mês pela data em que a foto foi tirada
    for (const d of fresh) {
      void photoMonth(d.file).then((date) => {
        if (date) setDrafts((list) => list.map((x) => (x.key === d.key && !x.date ? { ...x, date } : x)))
      })
    }
  }

  async function publishAll() {
    const queue = drafts.filter(canSend).map((d) => d.key)
    if (!queue.length) return
    setSending(true)
    setNotice(null)
    let done = 0
    let failed = 0
    for (const key of queue) {
      const draft = latest.current.find((d) => d.key === key)
      if (!draft) continue // tirada da lista enquanto as outras subiam
      patch(key, { status: 'sending', error: '' })
      try {
        const photo = await publish(password, draft)
        update((d) => ({ ...d, photos: [photo, ...d.photos.filter((p) => p.id !== photo.id)].sort(newestFirst) }))
        drop(key)
        done++
      } catch (err) {
        patch(key, { status: 'error', error: errorText(err) })
        failed++
      }
    }
    setSending(false)
    if (!done && !failed) return // todas foram tiradas da lista no meio do envio
    const sent = done === 1 ? '1 foto publicada no mural.' : `${done} fotos publicadas no mural.`
    if (!failed) setNotice({ tone: 'ok', text: `${sent} Em alguns segundos ${done === 1 ? 'ela já aparece' : 'elas já aparecem'} no site.` })
    else setNotice({ tone: 'error', text: `${done ? `${sent} ` : ''}${failed === 1 ? 'Uma foto não foi enviada' : `${failed} fotos não foram enviadas`}: veja o aviso abaixo dela.` })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) add(e.dataTransfer.files)
  }

  const waiting = drafts.filter(canSend).length
  useLeaveWarning(sending || drafts.length > 0)

  return (
    <div className="grid gap-12">
      <PanelHeader title="Mural de clientes">
        Fotos de clientes usando as peças da loja (com a autorização delas). Aparecem na seção Clientes do site, das mais recentes para as
        mais antigas. Pode mandar direto do celular: o painel diminui a foto, gira se precisar e tira a localização antes de publicar.
      </PanelHeader>

      <section aria-labelledby="enviar" className="grid gap-5">
        <h2 id="enviar" className="sr-only">
          Enviar fotos
        </h2>
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:border-gold ${
            dragging ? 'border-gold bg-gold/10' : 'border-line-strong bg-cream/[0.02] hover:border-gold/60 hover:bg-gold/[0.05]'
          }`}
        >
          <span className="grid size-14 place-items-center rounded-full bg-gradient-brand text-2xl text-ink">
            <TbPhotoPlus aria-hidden />
          </span>
          <span className="font-display text-2xl">Escolher fotos</span>
          <span className="max-w-sm text-sm text-muted">Toque para escolher ou arraste as fotos para cá. Dá para enviar várias de uma vez.</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

        {drafts.length > 0 && (
          <>
            <ul className="grid gap-4 lg:grid-cols-2">
              {drafts.map((d) => (
                <li key={d.key} className="flex gap-4 rounded-[1.5rem] border border-line bg-ink-2 p-3 sm:p-4">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-ink-3 sm:size-32">
                    <img src={d.preview} alt="" decoding="async" className="h-full w-full object-cover" />
                    {d.status === 'sending' && (
                      <span className="absolute inset-0 grid place-items-center bg-ink/70 text-2xl text-gold">
                        <TbLoader2 aria-hidden className="animate-spin" />
                      </span>
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate pt-1 text-xs text-faint" title={d.file.name}>
                        {d.status === 'sending' ? 'Enviando…' : d.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => drop(d.key)}
                        disabled={d.status === 'sending'}
                        aria-label="Tirar esta foto"
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-cream/10 hover:text-cream disabled:opacity-40"
                      >
                        <TbX aria-hidden />
                      </button>
                    </div>
                    <MuralFieldsEditor value={d} onChange={(change) => patch(d.key, change)} disabled={d.status === 'sending'} />
                    {d.error && <p className="text-sm text-red-300">{d.error}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void publishAll()}
                disabled={sending || !waiting}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-7 py-3.5 font-semibold text-ink disabled:opacity-60"
              >
                {sending ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbCloudUpload aria-hidden className="text-lg" />}
                {sending ? 'Publicando…' : waiting === 1 ? 'Publicar foto' : `Publicar ${waiting} fotos`}
              </button>
              <p className="text-sm text-faint">Título, look e data são opcionais e dá para mudar depois.</p>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="publicadas" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-8">
          <h2 id="publicadas" className="font-display text-3xl">
            No mural agora <span className="text-base font-normal text-muted">· {data.photos.length} {data.photos.length === 1 ? 'foto' : 'fotos'}</span>
          </h2>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
            Ver no site <TbExternalLink aria-hidden />
          </a>
        </div>
        {data.photos.length === 0 ? (
          <p className="text-muted">Nenhuma foto ainda. Enquanto o mural estiver vazio, o site convida as clientes a marcarem a loja no Instagram.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.photos.map((photo) => (
              <PublishedPhoto key={photo.id} photo={photo} password={password} update={update} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PublishedPhoto({ photo, password, update }: { photo: MuralPhoto; password: string; update: PanelProps['update'] }) {
  const [editing, setEditing] = useState<MuralFields | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!editing) return
    setBusy(true)
    setError('')
    try {
      const { photo: saved } = await adminMuralEdit(password, photo.id, editing)
      update((d) => ({ ...d, photos: d.photos.map((p) => (p.id === saved.id ? saved : p)).sort(newestFirst) }))
      setEditing(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Apagar esta foto do mural? Ela sai do site.')) return
    setBusy(true)
    setError('')
    try {
      await adminMuralDelete(password, photo.id)
      update((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== photo.id) }))
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const caption = [photo.look, eventDateLabel(photo.date)].filter(Boolean).join(' · ')

  return (
    <li className={`flex flex-col gap-3 rounded-[1.5rem] border border-line bg-ink-2 p-2.5 transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink-3">
        <img src={muralUrl(photo.id, 'thumb')} alt={photo.title || photo.look || 'Foto do mural'} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {!editing && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => setEditing({ title: photo.title, look: photo.look, date: photo.date })}
              disabled={busy}
              aria-label="Editar título, look e data"
              className="grid size-9 place-items-center rounded-full bg-ink/80 text-cream hover:bg-ink"
            >
              <TbPencil aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              aria-label="Apagar foto"
              className="grid size-9 place-items-center rounded-full bg-ink/80 text-red-300 hover:bg-ink"
            >
              <TbTrash aria-hidden />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="grid gap-2 px-1 pb-1">
          <MuralFieldsEditor value={editing} onChange={(change) => setEditing((e) => e && { ...e, ...change })} disabled={busy} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              <TbCheck aria-hidden /> Salvar
            </button>
            <button type="button" onClick={() => setEditing(null)} disabled={busy} className="rounded-full px-4 py-2 text-sm text-muted hover:text-cream">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="min-w-0 px-1 pb-1">
          <p className="truncate font-medium">{photo.title || <span className="text-faint">Sem título</span>}</p>
          {caption && <p className="truncate text-sm text-muted">{caption}</p>}
        </div>
      )}
      {error && <p className="px-1 pb-1 text-sm text-red-300">{error}</p>}
    </li>
  )
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Título, look (qual peça ela está usando) e mês/ano da foto
function MuralFieldsEditor({ value, onChange, disabled }: { value: MuralFields; onChange: (change: Partial<MuralFields>) => void; disabled: boolean }) {
  const [year = '', month = ''] = value.date.split('-')
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: thisYear - 2011 }, (_, i) => String(thisYear - i))
  if (year && !years.includes(year)) years.push(year)

  // escolher o mês sem o ano já assume o ano atual
  const setDate = (y: string, m: string) => onChange({ date: m ? `${y || thisYear}-${m}` : y })

  return (
    <div className="grid gap-2">
      <input
        className={field}
        value={value.title}
        maxLength={90}
        placeholder="Título (ex.: Juliana arrasando)"
        aria-label="Título"
        disabled={disabled}
        onChange={(e) => onChange({ title: e.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          className={field}
          value={value.look}
          maxLength={60}
          placeholder="Look (ex.: vestido longo canelado)"
          aria-label="Look"
          disabled={disabled}
          onChange={(e) => onChange({ look: e.target.value })}
        />
        <select className={field} value={month} aria-label="Mês da foto" disabled={disabled} onChange={(e) => setDate(year, e.target.value)}>
          <option value="">Mês</option>
          {MONTHS.map((label, i) => (
            <option key={label} value={String(i + 1).padStart(2, '0')}>
              {label}
            </option>
          ))}
        </select>
        <select className={field} value={year} aria-label="Ano da foto" disabled={disabled} onChange={(e) => setDate(e.target.value, e.target.value ? month : '')}>
          <option value="">Ano</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
