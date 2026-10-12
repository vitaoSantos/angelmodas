import { motion, useInView } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { TbArrowUpRight, TbBrandInstagram, TbCheck, TbPencil, TbSend, TbStar, TbStarFilled } from 'react-icons/tb'
import { useSiteData } from '../../context/SiteDataContext'
import { brand, instagramUrl } from '../../data/brand'
import { useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery'
import { postComment } from '../../lib/api'
import { toColumns } from '../../lib/masonry'
import { averageRating, type CommunityComment } from '../../lib/siteTypes'
import { easeOut } from '../ui/motion'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

// quantos bilhetes aparecem de cada vez (no celular, menos: o formulário não fica tão longe)
const PAGE = { phone: 4, wide: 6 }
// papel de cada bilhete e a inclinação dele (repetem em sequência)
const PAPERS = ['#f7efe4', '#f6dcd7', '#efe4cf', '#e9e0ef', '#f3e7d9']
const TILTS = [-1.6, 1.3, -0.9, 1.8, -1.3, 0.8]

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

// 1.234 · 12.345 · 123,4 mil
function formatCount(n: number) {
  return n < 100_000 ? n.toLocaleString('pt-BR') : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// "hoje", "ontem", "há 3 dias", "há 2 semanas" ou "março de 2026"
function whenLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${Math.round(days / 7)} ${Math.round(days / 7) === 1 ? 'semana' : 'semanas'}`
  return `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`
}

// Número que conta de 0 até o valor quando aparece na tela (o leitor de tela recebe o valor final)
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const shown = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = formatCount(value)
      shown.current = value
      return
    }
    if (!inView) return
    const from = shown.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400)
      const current = Math.round(from + (value - from) * (1 - (1 - t) ** 3))
      el.textContent = formatCount(current)
      shown.current = current
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, inView, reduced])

  return (
    <>
      <span ref={ref} aria-hidden>
        0
      </span>
      <span className="sr-only">{formatCount(value)}</span>
    </>
  )
}

function Stars({ rating, className = '' }: { rating: number; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} role="img" aria-label={`Nota ${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (n <= rating ? <TbStarFilled key={n} aria-hidden /> : <TbStar key={n} aria-hidden className="opacity-40" />))}
    </span>
  )
}

// Números da comunidade: visitas, recados e nota média (cada um só aparece quando tem o que mostrar)
function Stats() {
  const { visits, comments } = useSiteData()
  const rating = averageRating(comments)
  const tiles = [
    visits > 0 && { label: 'Visitas ao site', value: <CountUp value={visits} /> },
    comments.length > 0 && { label: comments.length === 1 ? 'Recado no mural' : 'Recados no mural', value: comments.length.toLocaleString('pt-BR') },
    rating.count >= 3 && {
      label: `Nota média (${plural(rating.count, 'avaliação', 'avaliações')})`,
      value: (
        <span className="inline-flex items-center gap-2">
          {rating.average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <TbStarFilled aria-hidden className="text-[0.6em] text-gold" />
        </span>
      ),
    },
  ].filter(Boolean) as { label: string; value: ReactNode }[]

  if (!tiles.length) return null
  return (
    <dl className="mt-12 grid gap-3 sm:gap-5" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col-reverse justify-end gap-1.5 rounded-[1.5rem] border border-line bg-ink-2/60 p-4 sm:p-6">
          <dt className="text-xs leading-snug text-muted sm:text-sm">{t.label}</dt>
          <dd className="font-sans text-2xl font-semibold tracking-tight text-cream sm:text-4xl">{t.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Note({ comment, index }: { comment: CommunityComment; index: number }) {
  const meta = [comment.city, whenLabel(comment.createdAt)].filter(Boolean).join(' · ')
  return (
    <motion.li
      initial={{ opacity: 0, transform: 'translateY(30px)' }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)', transitionEnd: { transform: 'none' } }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: easeOut, delay: (index % 2) * 0.08 }}
    >
      <figure
        style={{ '--tilt': `${TILTS[index % TILTS.length]}deg`, background: PAPERS[index % PAPERS.length] } as CSSProperties}
        className="relative rotate-(--tilt) rounded-md px-5 pb-5 pt-7 text-[#2a1d16] shadow-[0_22px_36px_-20px_rgb(0_0_0/0.85),0_2px_6px_rgb(0_0_0/0.3)] sm:px-6"
      >
        {/* alfinete */}
        <span
          aria-hidden
          className="absolute left-1/2 top-2.5 size-3.5 -translate-x-1/2 rounded-full bg-gold shadow-[inset_-2px_-2px_3px_rgb(0_0_0/0.3),0_2px_3px_rgb(0_0_0/0.35)]"
        />
        {comment.rating > 0 && <Stars rating={comment.rating} className="mb-2.5 text-sm text-[#a57a3f]" />}
        <blockquote className="whitespace-pre-line break-words text-[15px] leading-relaxed">{comment.message}</blockquote>
        <figcaption className="mt-4">
          <span className="block font-script text-3xl leading-none">{comment.name}</span>
          {meta && <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a6a48]">{meta}</span>}
        </figcaption>
      </figure>
    </motion.li>
  )
}

function NotesWall() {
  const { comments } = useSiteData()
  const [pages, setPages] = useState(1)
  const sm = useMediaQuery('(min-width: 640px)')
  const visible = useMemo(() => comments.slice(0, pages * (sm ? PAGE.wide : PAGE.phone)), [comments, pages, sm])
  // altura aproximada de cada bilhete (texto + nome), para equilibrar as colunas
  const columns = useMemo(
    () => toColumns(visible, sm ? 2 : 1, (c) => 5 + Math.ceil(c.message.length / 42) + c.message.split('\n').length + (c.rating ? 1 : 0)),
    [visible, sm],
  )
  const rest = comments.length - visible.length

  if (!comments.length) {
    return (
      <div className="grid min-h-60 place-items-center rounded-[2rem] border-2 border-dashed border-line-strong p-8 text-center">
        <div>
          <p className="font-script text-4xl text-gold-soft">o mural de recados está esperando o primeiro!</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">Já comprou na {brand.name}? Conte como foi a sua experiência e inaugure o mural.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="grid items-start gap-x-6" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column, c) => (
          <ul key={c} className="grid gap-7">
            {column.items.map(({ item, index }) => (
              <Note key={item.id} comment={item} index={index} />
            ))}
          </ul>
        ))}
      </div>
      {rest > 0 && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setPages((n) => n + 1)}
            className="rounded-full border border-line-strong px-7 py-3.5 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
          >
            Ver mais recados <span className="text-muted">({rest})</span>
          </button>
        </div>
      )}
    </div>
  )
}

type Fields = { name: string; city: string; message: string; rating: number; website: string }
const EMPTY: Fields = { name: '', city: '', message: '', rating: 0, website: '' }

function CommentForm() {
  const { moderated, addComment } = useSiteData()
  const [values, setValues] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'message', string>>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ name: string; published: boolean } | null>(null)
  const [hover, setHover] = useState(0)
  // quando a pessoa começou a escrever (robôs enviam na hora)
  const started = useRef(0)

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    if (!started.current) started.current = Date.now()
    setValues((v) => ({ ...v, [key]: value }))
    if (key === 'name' || key === 'message') setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: typeof errors = {}
    if (values.name.trim().length < 2) found.name = 'Escreva seu nome.'
    if (values.message.trim().length < 5) found.message = 'Escreva um recado um pouquinho maior.'
    setErrors(found)
    if (Object.keys(found).length) return

    setStatus('sending')
    setError('')
    try {
      const result = await postComment({ ...values, elapsed: started.current ? Date.now() - started.current : 0 })
      if (result.comment) addComment(result.comment)
      setSent({ name: values.name.trim().split(' ')[0], published: result.status === 'approved' })
      setValues(EMPTY)
      started.current = 0
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar agora.')
      setStatus('error')
    }
  }

  const field =
    'w-full rounded-2xl border bg-cream/[0.04] px-5 py-3.5 text-cream placeholder:text-faint outline-none transition-colors focus:border-gold/70 focus:bg-gold/[0.06]'

  if (sent) {
    return (
      <div className="border-gradient grid gap-4 rounded-[2rem] bg-ink-2/80 p-6 text-center sm:p-8" role="status">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-mint/15 text-2xl text-mint">
          <TbCheck aria-hidden />
        </span>
        <p className="font-display text-3xl">Obrigada, {sent.name}!</p>
        <p className="text-muted">
          {sent.published ? 'Seu recado já está no mural.' : 'Seu recado chegou e aparece no mural assim que a gente der uma olhadinha.'}
        </p>
        <button type="button" onClick={() => setSent(null)} className="mx-auto inline-flex items-center gap-2 text-sm text-gold hover:underline">
          <TbPencil aria-hidden /> Escrever outro recado
        </button>
      </div>
    )
  }

  const shownRating = hover || values.rating
  return (
    <form onSubmit={onSubmit} noValidate className="border-gradient grid grid-cols-1 gap-5 rounded-[2rem] bg-ink-2/80 p-6 sm:p-8">
      <div>
        <h3 className="font-display text-3xl tracking-tight">Deixe seu recado</h3>
        <p className="mt-1 text-sm text-muted">Conta pra gente o que achou das peças, do atendimento, do caimento… a gente adora ler!</p>
      </div>

      {/* armadilha para robôs: invisível para pessoas */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Não preencha
          <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => update('website', e.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="grid gap-2 text-sm text-muted">
          Seu nome
          <input
            className={`${field} ${errors.name ? 'border-red-400/70' : 'border-line'}`}
            value={values.name}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Ex.: Mariana"
            aria-invalid={!!errors.name}
            onChange={(e) => update('name', e.target.value)}
          />
          {errors.name && <span className="text-red-300">{errors.name}</span>}
        </label>
        <label className="grid gap-2 text-sm text-muted">
          Cidade (opcional)
          <input
            className={`${field} border-line`}
            value={values.city}
            maxLength={40}
            autoComplete="address-level2"
            placeholder="Ex.: Poços de Caldas"
            onChange={(e) => update('city', e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-2 text-sm text-muted">
        <span id="nota-label">Sua nota (opcional)</span>
        <div role="radiogroup" aria-labelledby="nota-label" className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={values.rating === n}
              aria-label={n === 1 ? '1 estrela' : `${n} estrelas`}
              onClick={() => update('rating', values.rating === n ? 0 : n)}
              onMouseEnter={() => setHover(n)}
              className="grid size-10 place-items-center rounded-full text-2xl transition-transform hover:scale-110"
            >
              {n <= shownRating ? <TbStarFilled aria-hidden className="text-gold" /> : <TbStar aria-hidden className="text-faint" />}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-2 text-sm text-muted">
        <span className="flex justify-between">
          Recado <span className="tabular-nums text-faint">{values.message.length}/600</span>
        </span>
        <textarea
          rows={4}
          maxLength={600}
          className={`${field} resize-none ${errors.message ? 'border-red-400/70' : 'border-line'}`}
          value={values.message}
          placeholder="Amei o vestido! Caimento perfeito e chegou rapidinho."
          aria-invalid={!!errors.message}
          onChange={(e) => update('message', e.target.value)}
        />
        {errors.message && <span className="text-red-300">{errors.message}</span>}
      </label>

      {status === 'error' && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/5 px-5 py-4 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-7 py-4 font-semibold text-ink transition-[filter,opacity] hover:brightness-110 disabled:opacity-70"
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar recado'}
        <TbSend aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
      <p className="-mt-1 text-xs leading-relaxed text-faint">
        {moderated ? 'Os recados aparecem no mural depois de uma olhadinha da equipe. ' : ''}
        Não coloque telefone nem endereço.
      </p>
    </form>
  )
}

function InstagramCard() {
  if (!instagramUrl) return null
  return (
    <a
      href={instagramUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-4 rounded-[1.5rem] border border-line bg-ink-2/60 p-4 transition-colors hover:border-line-strong"
    >
      <span
        className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
        style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 62%, #285aeb 92%)' }}
      >
        <TbBrandInstagram aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">Novidades e looks do dia no Instagram</span>
        <span className="block font-semibold text-cream">@{brand.instagram}</span>
      </span>
      <TbArrowUpRight aria-hidden className="text-xl text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  )
}

export function Community() {
  return (
    <section id="comunidade" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionLabel>Comunidade</SectionLabel>
          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              Quem vestiu, <span className="text-gradient font-script text-[1.1em]">contou.</span>
            </h2>
            <p className="max-w-sm text-muted">
              O mural de recados de quem já se vestiu com a {brand.name}. Deixe o seu também: cada mensagem deixa o nosso dia mais bonito.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <Stats />
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
          <NotesWall />
          <div className="grid content-start gap-5 lg:sticky lg:top-24 lg:self-start">
            <CommentForm />
            <InstagramCard />
          </div>
        </div>
      </div>
    </section>
  )
}
