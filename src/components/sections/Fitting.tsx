import { AnimatePresence, motion, useInView } from 'motion/react'
import { Component, lazy, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { TbArrowsShuffle, TbBrandWhatsapp, TbCamera, TbCheck, TbHandFinger, TbLoader2, TbVideo, TbX } from 'react-icons/tb'
import { useIntro } from '../../context/IntroContext'
import { useLook } from '../../context/LookContext'
import { brand, whatsappUrl } from '../../data/brand'
import { sizes as allSizes, sortSizes } from '../../data/catalog'
import { useIsDesktop, useReducedMotion } from '../../hooks/useMediaQuery'
import { useSpinDrag } from '../../hooks/useSpinDrag'
import { priceLabel, productSlots } from '../../lib/products'
import { canRecordVideo, shareOrDownload } from '../../lib/share'
import type { Product } from '../../lib/siteTypes'
import type { Capture } from '../three/FittingStage'
import { newSpin, type Spin } from '../three/shared'
import { useScrollTo } from '../layout/Navbar'
import { LogoMark } from '../ui/Logo'
import { Magnetic } from '../ui/Magnetic'
import { PieceThumb } from '../ui/PieceThumb'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

const FittingStage = lazy(() => import('../three/FittingStage'))

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type Tab = 'top' | 'bottom' | 'full'

const TABS: { id: Tab; label: string }[] = [
  { id: 'top', label: 'Parte de cima' },
  { id: 'bottom', label: 'Parte de baixo' },
  { id: 'full', label: 'Vestidos e conjuntos' },
]

// Em qual aba a peça aparece (conjuntos ficam junto com os vestidos)
const tabOf = (p: Product): Tab => {
  const slots = productSlots(p)
  return slots.length === 2 || slots[0] === 'full' ? 'full' : (slots[0] as Tab)
}

export function Fitting() {
  const look = useLook()
  const { items, pieces, wearable, wear, isWorn, size, setSize, surprise, lines } = look
  const desktop = useIsDesktop()
  const reduced = useReducedMotion()
  const scrollTo = useScrollTo()
  const stage = useRef<HTMLDivElement>(null)
  const spin = useRef<Spin>(newSpin())
  const capture = useRef<Capture | null>(null)
  const onDrag = useSpinDrag(spin)
  const { heroReady, markReady } = useIntro()
  // O 3D daqui é preparado ainda durante a tela de abertura, e não no meio do scroll
  const near = useInView(stage, { margin: '600px 0px', once: true })
  const visible = useInView(stage)
  const [stageReady, setStageReady] = useState(false)
  const onStageReady = useCallback(() => {
    setStageReady(true)
    markReady('fitting')
  }, [markReady])
  const [tab, setTab] = useState<Tab>('top')
  const [busy, setBusy] = useState<'photo' | 'video' | null>(null)
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState('')

  const byTab = useMemo(() => {
    const out: Record<Tab, Product[]> = { top: [], bottom: [], full: [] }
    for (const p of wearable) out[tabOf(p)].push(p)
    return out
  }, [wearable])
  const tabs = TABS.filter((t) => byTab[t.id].length)
  const currentTab = byTab[tab].length ? tab : (tabs[0]?.id ?? 'top')

  // tamanhos das peças vestidas (ou os mais comuns)
  const sizeOptions = useMemo(() => {
    const union = new Set(items.flatMap((i) => i.product.sizes))
    const list = sortSizes([...union])
    return list.length ? list : allSizes.slice(1, 5)
  }, [items])

  const message = [`Olá, ${brand.name}! Montei este look no provador do site:`, ...lines.map((l) => `• ${l}`), 'Vocês têm disponível?'].join('\n')
  const overlay = { title: brand.name, lines: items.map((i) => i.product.name), footer: brand.instagram ? `@${brand.instagram}` : brand.name }

  async function takePhoto() {
    if (!capture.current || busy) return
    setBusy('photo')
    setNotice('')
    try {
      const blob = await capture.current.photo(overlay)
      const result = await shareOrDownload(blob, 'meu-look-anghel.jpg', `Olha o look que eu montei na ${brand.name}!`)
      if (result === 'downloaded') setNotice('Foto salva! Ela está nos seus downloads.')
    } catch {
      setNotice('Não foi possível tirar a foto agora.')
    } finally {
      setBusy(null)
    }
  }

  async function recordVideo() {
    if (!capture.current || busy) return
    setBusy('video')
    setProgress(0)
    setNotice('')
    try {
      const { blob, ext } = await capture.current.video(overlay, 6, setProgress)
      const result = await shareOrDownload(blob, `meu-look-anghel.${ext}`, `Olha o look que eu montei na ${brand.name}!`)
      if (result === 'downloaded') setNotice('Vídeo salvo! Ele está nos seus downloads.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Não foi possível gravar o vídeo agora.')
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-ink/70 px-3.5 py-2 text-xs font-medium text-cream transition-colors hover:border-gold/60 disabled:opacity-50 sm:text-sm'

  return (
    <section id="provador" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionLabel>Provador 3D</SectionLabel>
          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              Monte o seu <span className="text-gradient font-script text-[1.1em]">look.</span>
            </h2>
            <p className="max-w-sm text-muted">
              Escolha a parte de cima, a de baixo ou um vestido: o manequim veste na hora. Gire, troque as cores, grave um vídeo e peça pelo
              WhatsApp.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          {/* Palco 3D: no celular fica grudado no topo enquanto a pessoa escolhe as peças */}
          <div className="sticky top-0 z-20 -mx-5 min-w-0 bg-ink px-5 pb-3 pt-2 shadow-[0_18px_24px_-12px_rgb(14_12_11)] sm:-mx-8 sm:px-8 lg:top-24 lg:z-auto lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:shadow-none">
            <div
              ref={stage}
              data-cursor="drag"
              onPointerDown={onDrag}
              className="border-gradient relative h-[46svh] touch-pan-y overflow-hidden rounded-[2rem] bg-ink-2 select-none lg:h-auto lg:aspect-[4/5]"
            >
              {(heroReady || near) && (
                <StageBoundary fallback={<StageFallback />}>
                  <Suspense fallback={null}>
                    <FittingStage
                      pieces={pieces}
                      spin={spin}
                      capture={capture}
                      active={visible || busy === 'video'}
                      mobile={!desktop}
                      reduced={reduced}
                      onReady={onStageReady}
                    />
                  </Suspense>
                </StageBoundary>
              )}
              {!stageReady && (
                <div className="absolute inset-0 bg-ink-2">
                  <StageFallback />
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4 sm:p-5">
                <button type="button" onClick={surprise} onPointerDown={(e) => e.stopPropagation()} className={btn}>
                  <TbArrowsShuffle aria-hidden /> Surpreenda-me
                </button>
                <span className="hidden items-center gap-1.5 rounded-full border border-line bg-ink/60 px-3 py-1.5 text-xs text-muted sm:flex">
                  <TbHandFinger aria-hidden /> arraste para girar
                </span>
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-ink-2/90 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4 sm:p-5">
                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={items.map((i) => i.product.id).join()}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="hidden max-w-[48%] font-script text-xl leading-tight text-cream/90 lg:block"
                  >
                    {items.length ? items.map((i) => i.product.name).join(' + ') : 'o seu look'}
                  </motion.p>
                </AnimatePresence>
                <div className="ml-auto flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => void takePhoto()} disabled={!stageReady || !!busy} className={btn}>
                    {busy === 'photo' ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbCamera aria-hidden />} Foto
                  </button>
                  {canRecordVideo() && (
                    <button type="button" onClick={() => void recordVideo()} disabled={!stageReady || !!busy} className={btn}>
                      {busy === 'video' ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbVideo aria-hidden />}
                      {busy === 'video' ? `Gravando ${Math.round(progress * 100)}%` : 'Vídeo 360°'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {notice && (
              <p role="status" className="mt-3 text-center text-sm text-mint">
                {notice}
              </p>
            )}
          </div>

          {/* Escolhas */}
          <div className="grid min-w-0 content-start gap-8">
            <div>
              <div role="tablist" aria-label="Peças" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={currentTab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${
                      currentTab === t.id ? 'bg-cream text-ink' : 'border border-line text-muted hover:text-cream'
                    }`}
                  >
                    {t.label} <span className={currentTab === t.id ? 'text-ink/60' : 'text-faint'}>{byTab[t.id].length}</span>
                  </button>
                ))}
              </div>
              <ul role="tabpanel" className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {byTab[currentTab].map((p) => {
                  const worn = isWorn(p.id)
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => wear(p)} aria-pressed={worn} className="group flex w-full flex-col gap-2 text-left">
                        <span
                          className={`relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-ink-3 transition-[box-shadow,transform] duration-300 ${
                            worn ? 'shadow-[0_0_0_2px_var(--color-gold),0_0_24px_-4px_rgb(216_185_138/0.7)]' : 'group-hover:-translate-y-0.5'
                          }`}
                        >
                          <PieceThumb product={p} />
                          {worn && (
                            <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-gold text-ink">
                              <TbCheck aria-hidden className="text-sm" />
                            </span>
                          )}
                          {p.soldOut && (
                            <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-rose-soft">
                              Esgotado
                            </span>
                          )}
                        </span>
                        <span className={`line-clamp-2 text-xs leading-snug ${worn ? 'text-cream' : 'text-muted'}`}>{p.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <fieldset className="border-t border-line pt-6">
              <legend className="sr-only">Peças vestidas</legend>
              <p aria-hidden className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                Vestindo agora
              </p>
              {items.length ? (
                <ul className="grid gap-3">
                  {items.map((item) => (
                    <WornRow key={item.product.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Escolha uma peça acima para vestir o manequim.</p>
              )}
            </fieldset>

            <fieldset className="border-t border-line pt-6">
              <legend className="sr-only">Seu tamanho</legend>
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <p aria-hidden className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                  Seu tamanho
                </p>
                <p className="text-sm text-faint">dúvida? a gente ajuda no WhatsApp</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={`min-w-12 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                      size === s ? 'border-gold bg-gold/15 text-cream' : 'border-line text-muted hover:border-line-strong hover:text-cream'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
              <Magnetic>
                <a
                  href={whatsappUrl(message)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-7 py-4 font-semibold text-ink shadow-[0_0_44px_-10px_rgb(216_185_138/0.8)] transition-[filter] hover:brightness-110"
                >
                  <TbBrandWhatsapp aria-hidden className="text-lg" />
                  Pedir este look
                </a>
              </Magnetic>
              <button
                type="button"
                onClick={() => scrollTo('contato')}
                className="rounded-full border border-line-strong px-7 py-4 font-medium text-cream transition-colors hover:border-gold/60 hover:bg-gold/10"
              >
                Prefiro o formulário
              </button>
            </div>
            <p className="-mt-4 text-sm text-faint">
              O manequim mostra o molde e a cor de cada peça. Disponibilidade, valores e entrega a gente confirma na conversa.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// Linha de uma peça vestida: cores para trocar e botão para tirar
function WornRow({ item }: { item: ReturnType<typeof useLook>['items'][number] }) {
  const { setColor, takeOff } = useLook()
  const { product, color } = item
  const price = priceLabel(product)
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-ink-2/70 p-3">
      <span className="block aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-xl bg-ink-3">
        <PieceThumb product={product} color={color} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">{item.label}</p>
        <p className="truncate font-medium text-cream">{product.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {product.colors.map((c, i) => (
            <button
              key={c.hex + i}
              type="button"
              onClick={() => setColor(product.id, i)}
              aria-pressed={i === color}
              aria-label={`Cor ${c.name}`}
              title={c.name}
              className={`size-7 rounded-full border-2 transition-transform ${i === color ? 'scale-110 border-cream' : 'border-transparent hover:scale-105'}`}
              style={{ background: `radial-gradient(circle at 35% 30%, #ffffff66, ${c.hex} 58%)` }}
            />
          ))}
          <span className="ml-1 text-xs text-muted">{product.colors[color]?.name}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {price && <span className="text-sm font-semibold text-gold-soft">{price}</span>}
        <button
          type="button"
          onClick={() => takeOff(product.id)}
          aria-label={`Tirar ${product.name}`}
          className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <TbX aria-hidden />
        </button>
      </div>
    </li>
  )
}

function StageFallback() {
  return (
    <div className="grid h-full place-items-center">
      <LogoMark className="h-1/2 w-auto opacity-50" />
    </div>
  )
}
