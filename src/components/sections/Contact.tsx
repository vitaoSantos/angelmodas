import { useState, type FormEvent } from 'react'
import { TbBrandInstagram, TbBrandWhatsapp, TbCheck, TbMail, TbMapPin, TbSend, TbX } from 'react-icons/tb'
import { useLook } from '../../context/LookContext'
import { brand, formatPhone, instagramUrl, whatsappUrl } from '../../data/brand'
import { Magnetic } from '../ui/Magnetic'
import { PieceThumb } from '../ui/PieceThumb'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

type Status = 'idle' | 'sending' | 'sent' | 'error'
type Fields = { nome: string; whatsapp: string; email: string; tamanho: string; mensagem: string }
type Errors = Partial<Record<keyof Fields, string>>

const empty: Fields = { nome: '', whatsapp: '', email: '', tamanho: '', mensagem: '' }

function validate(values: Fields): Errors {
  const errors: Errors = {}
  if (!values.nome.trim()) errors.nome = 'Digite seu nome.'
  if (values.whatsapp.replace(/\D/g, '').length < 10) errors.whatsapp = 'Digite um WhatsApp com DDD.'
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Esse e-mail parece incompleto.'
  if (!values.mensagem.trim()) errors.mensagem = 'Conte um pouquinho do que você procura.'
  return errors
}

// Envia para o Netlify Forms (o formulário estático "pedido" está no index.html)
function OrderForm() {
  const { items, touched, summary, size } = useLook()
  const [values, setValues] = useState<Fields>(empty)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [attach, setAttach] = useState(true)
  const withLook = touched && attach && items.length > 0

  function update(field: keyof Fields, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return

    const honeypot = new FormData(e.currentTarget).get('bot-field')
    setStatus('sending')
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'pedido',
          'bot-field': String(honeypot ?? ''),
          ...values,
          tamanho: values.tamanho || (withLook ? size : ''),
          look: withLook ? summary : '',
        }).toString(),
      })
      if (!res.ok) throw new Error(String(res.status))
      setStatus('sent')
      setValues(empty)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-mint/30 bg-mint/5 p-10 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-mint/15 text-3xl text-mint">
          <TbCheck aria-hidden />
        </span>
        <p className="mt-6 font-display text-4xl">Recebemos!</p>
        <p className="mt-2 max-w-sm text-muted">Obrigada pelo carinho. A gente responde pelo WhatsApp o mais rápido possível.</p>
        <button type="button" onClick={() => setStatus('idle')} className="mt-8 text-sm text-gold hover:underline">
          Enviar outra mensagem
        </button>
      </div>
    )
  }

  const field =
    'w-full rounded-2xl border bg-cream/[0.04] px-5 py-4 text-cream placeholder:text-faint outline-none transition-colors focus:border-gold/70 focus:bg-gold/[0.06]'

  const input = (name: keyof Fields, label: string, props: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`f-${name}`} className="mb-2 block text-sm text-muted">
        {label}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        value={values[name]}
        onChange={(e) => update(name, e.target.value)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `f-${name}-erro` : undefined}
        className={`${field} ${errors[name] ? 'border-red-400/70' : 'border-line'}`}
        {...props}
      />
      {errors[name] && (
        <p id={`f-${name}-erro`} className="mt-2 text-sm text-red-300">
          {errors[name]}
        </p>
      )}
    </div>
  )

  return (
    <form name="pedido" method="POST" onSubmit={onSubmit} noValidate className="border-gradient grid grid-cols-1 gap-5 rounded-[2rem] bg-ink-2/80 p-6 sm:p-8">
      <p hidden>
        <label>
          Não preencha: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      {withLook && (
        <div className="flex items-center gap-4 rounded-2xl border border-gold/30 bg-gold/[0.07] p-3 pr-4">
          <div className="flex shrink-0 -space-x-3">
            {items.slice(0, 2).map((i) => (
              <span key={i.product.id} className="block aspect-[4/5] w-11 overflow-hidden rounded-lg ring-2 ring-ink-2">
                <PieceThumb product={i.product} color={i.color} />
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Seu look montado vai junto</p>
            <p className="mt-1 truncate text-sm text-cream/90">{summary}</p>
          </div>
          <button type="button" onClick={() => setAttach(false)} aria-label="Não enviar o look montado" className="text-muted hover:text-cream">
            <TbX aria-hidden />
          </button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {input('nome', 'Seu nome', { autoComplete: 'name', placeholder: 'Como podemos te chamar?' })}
        {input('whatsapp', 'WhatsApp', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '(00) 00000-0000' })}
      </div>
      <div className="grid gap-5 sm:grid-cols-[1.6fr_1fr]">
        {input('email', 'E-mail (opcional)', { type: 'email', autoComplete: 'email', placeholder: 'voce@email.com' })}
        {input('tamanho', 'Tamanho que você usa', { placeholder: withLook ? size : 'Ex.: M ou 40' })}
      </div>
      <div>
        <label htmlFor="f-mensagem" className="mb-2 block text-sm text-muted">
          Mensagem
        </label>
        <textarea
          id="f-mensagem"
          name="mensagem"
          rows={5}
          placeholder="Peça que você viu, ocasião, dúvidas de tamanho, cores…"
          value={values.mensagem}
          onChange={(e) => update('mensagem', e.target.value)}
          aria-invalid={!!errors.mensagem}
          aria-describedby={errors.mensagem ? 'f-mensagem-erro' : undefined}
          className={`${field} resize-none ${errors.mensagem ? 'border-red-400/70' : 'border-line'}`}
        />
        {errors.mensagem && (
          <p id="f-mensagem-erro" className="mt-2 text-sm text-red-300">
            {errors.mensagem}
          </p>
        )}
      </div>

      {status === 'error' && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/5 px-5 py-4 text-sm text-red-200">
          Não foi possível enviar agora.{' '}
          <a href={whatsappUrl(`Olá, ${brand.name}!`)} target="_blank" rel="noreferrer" className="underline">
            Chame a gente no WhatsApp
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-7 py-4 font-semibold text-ink transition-[filter,opacity] hover:brightness-110 disabled:opacity-70"
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar mensagem'}
        <TbSend aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
    </form>
  )
}

export function Contact() {
  const channels = [
    brand.whatsapp && { icon: TbBrandWhatsapp, label: 'WhatsApp', value: formatPhone(brand.whatsapp), href: whatsappUrl(`Olá, ${brand.name}!`) },
    instagramUrl && { icon: TbBrandInstagram, label: 'Instagram', value: `@${brand.instagram}`, href: instagramUrl },
    brand.email && { icon: TbMail, label: 'E-mail', value: brand.email, href: `mailto:${brand.email}` },
    brand.city && { icon: TbMapPin, label: 'Onde estamos', value: brand.city, href: '' },
  ].filter(Boolean) as { icon: typeof TbMail; label: string; value: string; href: string }[]

  return (
    <section id="contato" className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(227_166_159/0.11),transparent_68%)]"
      />
      <div className="container-x relative grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal>
          <SectionLabel>Contato</SectionLabel>
          <h2 className="mt-6 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.92] tracking-tight">
            Vamos escolher o seu <span className="text-gradient font-script text-[1.08em]">look?</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Mande uma mensagem pelo formulário ou chame direto no WhatsApp. A gente ajuda com tamanho, cores e combinações.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic>
              <a
                href={whatsappUrl(`Olá, ${brand.name}! Vi o site e quero ajuda para escolher um look.`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-cream px-7 py-4 font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                <TbBrandWhatsapp aria-hidden className="text-xl text-[#1f9d55]" />
                Chamar no WhatsApp
              </a>
            </Magnetic>
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-7 py-4 font-semibold text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
              >
                <TbBrandInstagram aria-hidden className="text-xl" />
                Seguir no Instagram
              </a>
            )}
          </div>

          {channels.length > 0 && (
            <ul className="mt-10 grid gap-3">
              {channels.map((c) => {
                const content = (
                  <>
                    <span className="grid size-11 place-items-center rounded-full border border-line text-lg text-gold">
                      <c.icon aria-hidden />
                    </span>
                    <span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-faint">{c.label}</span>
                      <span className="block text-cream">{c.value}</span>
                    </span>
                  </>
                )
                return (
                  <li key={c.label}>
                    {c.href ? (
                      <a href={c.href} target="_blank" rel="noreferrer" className="flex items-center gap-4 transition-opacity hover:opacity-80">
                        {content}
                      </a>
                    ) : (
                      <span className="flex items-center gap-4">{content}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Reveal>

        {/* min-w-0: o resumo do look (uma linha só, cortada com "…") não pode alargar a coluna */}
        <Reveal delay={0.1} className="min-w-0">
          <OrderForm />
        </Reveal>
      </div>
    </section>
  )
}
