import { useMemo, useState } from 'react'
import { TbCheck, TbEyeOff, TbStar, TbStarFilled, TbTrash } from 'react-icons/tb'
import { adminCommentDelete, adminCommentStatus, adminCommunity } from '../lib/api'
import type { StoredComment, VisitStats } from '../lib/siteTypes'
import { Notice, PanelHeader, Switch, type PanelProps } from './ui'

// Barras do gráfico: dourado num tom que passa no teste de contraste e de luminosidade sobre o fundo escuro
const BAR = '#c9a46c'
const CHART_DAYS = 14

const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
const dayLabel = (key: string) => {
  const [, m, d] = key.split('-')
  return `${Number(d)}/${Number(m)}`
}
const longDay = (key: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))
const count = (n: number) => n.toLocaleString('pt-BR')

// Últimos N dias (do mais antigo para hoje), no horário de Brasília, como o servidor conta
function lastDays(n: number) {
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now - (n - 1 - i) * 86_400_000)))
}

function VisitTiles({ visits }: { visits: VisitStats }) {
  const days = lastDays(30)
  const sum = (keys: string[]) => keys.reduce((total, k) => total + (visits.days[k] ?? 0), 0)
  const tiles = [
    { label: 'Visitas no total', value: visits.total },
    { label: 'Hoje', value: visits.days[days[days.length - 1]] ?? 0 },
    { label: 'Últimos 7 dias', value: sum(days.slice(-7)) },
    { label: 'Últimos 30 dias', value: sum(days) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col-reverse justify-end gap-1 rounded-[1.25rem] border border-line bg-ink-2 p-4">
          <dt className="text-sm text-muted">{t.label}</dt>
          <dd className="font-sans text-3xl font-semibold tracking-tight text-cream">{count(t.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

// Colunas por dia. Uma série só (sem legenda: o título diz o que é), valor no topo só de hoje e do maior dia,
// o resto aparece ao passar o mouse ou focar a coluna, e também na tabela logo abaixo.
function VisitsChart({ visits }: { visits: VisitStats }) {
  const days = useMemo(() => lastDays(CHART_DAYS), [])
  const values = days.map((d) => visits.days[d] ?? 0)
  const max = Math.max(...values)
  // topo do eixo arredondado para um número "redondo"
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 50 ? 10 : max <= 100 ? 20 : 10 ** Math.floor(Math.log10(max))
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks = [top, top / 2, 0].filter((t) => Number.isInteger(t))
  const maxIndex = values.indexOf(max)
  const [active, setActive] = useState<number | null>(null)
  const today = days.length - 1

  return (
    <figure className="rounded-[1.5rem] border border-line bg-ink-2 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-cream">Visitas por dia</span>
        <span className="text-sm text-muted">últimos {CHART_DAYS} dias</span>
      </figcaption>

      <div className="relative mt-6 flex h-48 gap-3 pl-8">
        {/* eixo: linhas finas e discretas, com o valor ao lado (a linha do zero um pouco mais forte) */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute left-0 top-0 -translate-y-1/2 text-[11px] tabular-nums leading-none text-faint">{count(t)}</span>
            <span className={`absolute left-8 right-0 top-0 border-t ${t ? 'border-line' : 'border-line-strong'}`} />
          </div>
        ))}

        <div className="relative flex flex-1 items-end justify-between gap-0.5" onMouseLeave={() => setActive(null)}>
          {values.map((v, i) => {
            const labeled = i === today || (i === maxIndex && max > 0)
            const showTip = active === i
            return (
              <div
                key={days[i]}
                tabIndex={0}
                role="img"
                aria-label={`${longDay(days[i])}: ${v === 1 ? '1 visita' : `${count(v)} visitas`}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
              >
                {/* a coluna inteira é a área de toque; a barra é fina (no máximo 24 px) */}
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] transition-[filter] ${showTip ? 'brightness-125' : ''} group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-gold`}
                  style={{ height: v ? `${(v / top) * 100}%` : '0%', minHeight: v ? 3 : 0, background: BAR }}
                />
                {labeled && !showTip && (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs font-semibold tabular-nums text-cream"
                    style={{ bottom: `calc(${(v / top) * 100}% + 6px)` }}
                  >
                    {count(v)}
                  </span>
                )}
                {showTip && (
                  <span
                    // nas pontas, o balão encosta na borda para não sair do quadro
                    className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-line-strong bg-ink px-3 py-2 text-left shadow-xl ${
                      i < 2 ? 'left-0' : i > days.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                    style={{ bottom: `calc(${(v / top) * 100}% + 10px)` }}
                  >
                    <span className="block text-base font-semibold text-cream">{v === 1 ? '1 visita' : `${count(v)} visitas`}</span>
                    <span className="block text-xs text-muted">{i === today ? `hoje, ${longDay(days[i])}` : longDay(days[i])}</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-0.5 pl-8 text-[11px] text-faint">
        {days.map((d, i) => (
          // min-w-0: os 14 rótulos não podem alargar o quadro. No celular aparece um sim, um não, contando de hoje para trás
          <span key={d} className={`min-w-0 flex-1 whitespace-nowrap text-center tabular-nums ${(today - i) % 2 ? 'max-sm:invisible' : ''}`}>
            {i === today ? 'hoje' : dayLabel(d)}
          </span>
        ))}
      </div>

      <details className="mt-5 text-sm text-muted">
        <summary className="cursor-pointer select-none hover:text-cream">Ver em tabela</summary>
        <table className="mt-3 w-full max-w-sm text-left">
          <thead>
            <tr className="text-faint">
              <th className="py-1 font-normal">Dia</th>
              <th className="py-1 text-right font-normal">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d} className="border-t border-line">
                <td className="py-1.5">{longDay(d)}</td>
                <td className="py-1.5 text-right tabular-nums text-cream">{count(visits.days[d] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function CommentCard({ comment, password, update }: { comment: StoredComment; password: string; update: PanelProps['update'] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = comment.status === 'pending'
  const date = new Date(comment.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agora.')
      setBusy(false)
    }
  }

  const setStatus = (status: StoredComment['status']) =>
    run(async () => {
      const { comment: saved } = await adminCommentStatus(password, comment.id, status)
      update((d) => ({ ...d, comments: d.comments.map((c) => (c.id === saved.id ? saved : c)) }))
      setBusy(false)
    })

  const remove = () => {
    if (!window.confirm(`Apagar o recado de ${comment.name}? Não dá para desfazer.`)) return
    void run(async () => {
      await adminCommentDelete(password, comment.id)
      update((d) => ({ ...d, comments: d.comments.filter((c) => c.id !== comment.id) }))
    })
  }

  return (
    <li className={`rounded-[1.5rem] border p-5 transition-opacity ${pending ? 'border-gold/40 bg-gold/[0.05]' : 'border-line bg-ink-2'} ${busy ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold text-cream">
          {comment.name}
          {comment.city && <span className="font-normal text-muted"> · {comment.city}</span>}
        </p>
        <p className="text-xs text-faint">{date}</p>
      </div>
      {comment.rating > 0 && (
        <p className="mt-1.5 flex gap-0.5 text-sm text-gold" aria-label={`Nota ${comment.rating} de 5`}>
          {[1, 2, 3, 4, 5].map((n) => (n <= comment.rating ? <TbStarFilled key={n} aria-hidden /> : <TbStar key={n} aria-hidden className="opacity-40" />))}
        </p>
      )}
      <p className="mt-3 whitespace-pre-line break-words leading-relaxed text-cream/90">{comment.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pending ? (
          <button
            type="button"
            onClick={() => void setStatus('approved')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            <TbCheck aria-hidden /> Aprovar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void setStatus('pending')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm text-cream hover:border-gold/60 disabled:opacity-60"
          >
            <TbEyeOff aria-hidden /> Tirar do site
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-60"
        >
          <TbTrash aria-hidden /> Apagar
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </li>
  )
}

export function CommunityPanel({ password, data, update }: PanelProps) {
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const pending = data.comments.filter((c) => c.status === 'pending')
  const approved = data.comments.filter((c) => c.status === 'approved')

  async function toggleAutoPublish() {
    const autoPublish = !data.community.autoPublish
    setSaving(true)
    setNotice(null)
    try {
      const { community } = await adminCommunity(password, { autoPublish })
      update((d) => ({ ...d, community }))
      setNotice({
        tone: 'ok',
        text: community.autoPublish
          ? 'Pronto: os próximos recados entram no mural direto. Os que já estavam esperando continuam aqui para aprovar.'
          : 'Pronto: os próximos recados esperam a sua aprovação antes de aparecer.',
      })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Não foi possível salvar agora.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-12">
      <PanelHeader title="Comunidade">Quantas pessoas visitaram o site e os recados deixados na seção Comunidade.</PanelHeader>

      <section aria-labelledby="visitas" className="grid grid-cols-1 gap-4">
        <h2 id="visitas" className="font-display text-3xl">
          Visitas
        </h2>
        <VisitTiles visits={data.visits} />
        <VisitsChart visits={data.visits} />
        <p className="text-sm text-faint">
          Cada navegador conta uma vez por dia. Robôs de busca e prévias de link (como a do WhatsApp) não contam.
        </p>
      </section>

      <section aria-labelledby="recados" className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-8">
          <h2 id="recados" className="font-display text-3xl">
            Recados
          </h2>
          <div className="flex max-w-md items-center gap-3">
            <Switch on={data.community.autoPublish} onToggle={() => void toggleAutoPublish()} label="Publicar recados sem aprovação" disabled={saving} />
            <p className="text-sm text-muted">
              <span className="block text-cream">Publicar direto, sem aprovação</span>
              {data.community.autoPublish ? 'Ligado: os recados novos já aparecem no site.' : 'Desligado: você aprova cada recado antes.'}
            </p>
          </div>
        </div>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

        <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-gold">Aguardando aprovação · {pending.length}</h3>
        {pending.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {pending.map((c) => (
              <CommentCard key={c.id} comment={c} password={password} update={update} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nenhum recado esperando. 🎉</p>
        )}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-gold">No mural · {approved.length}</h3>
        {approved.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {approved.map((c) => (
              <CommentCard key={c.id} comment={c} password={password} update={update} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nenhum recado no mural ainda.</p>
        )}
      </section>
    </div>
  )
}
