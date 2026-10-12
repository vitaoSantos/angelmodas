import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { TbArrowsShuffle, TbBrandWhatsapp, TbCamera, TbCheck, TbLoader2, TbX } from 'react-icons/tb'
import { useLook, type Row } from '../../context/LookContext'
import { brand, whatsappUrl } from '../../data/brand'
import { sizes as allSizes, sortSizes } from '../../data/catalog'
import { lookPhoto } from '../../lib/lookPhoto'
import { pieceSource, priceLabel } from '../../lib/products'
import { shareOrDownload } from '../../lib/share'
import { useScrollTo } from '../layout/Navbar'
import { LookBoard, rowSlot } from '../ui/LookBoard'
import { Magnetic } from '../ui/Magnetic'
import { FOCUS } from '../ui/PieceImage'
import { PieceThumb } from '../ui/PieceThumb'
import { Reveal } from '../ui/Reveal'
import { SectionLabel } from '../ui/SectionLabel'

const TABS: { id: Row; label: string }[] = [
  { id: 'top', label: 'Parte de cima' },
  { id: 'bottom', label: 'Parte de baixo' },
  { id: 'whole', label: 'Vestidos e conjuntos' },
]

// Provador ("Monte o seu look"): as fotos das peças de verdade, combinadas no papel.
// No celular nada fica grudado na tela: o quadro rola junto com a página.
export function Fitting() {
  const look = useLook()
  const { items, options, board, wear, isWorn, size, setSize, surprise, lines } = look
  const scrollTo = useScrollTo()
  const [tab, setTab] = useState<Row>('top')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const tabs = TABS.filter((t) => options[t.id].length)
  const currentTab = options[tab].length ? tab : (tabs[0]?.id ?? 'top')
  const both = options.whole.length > 0 && options.top.length + options.bottom.length > 0

  // tamanhos das peças vestidas (ou os mais comuns)
  const sizeOptions = useMemo(() => {
    const union = new Set(items.flatMap((i) => i.product.sizes))
    const list = sortSizes([...union])
    return list.length ? list : allSizes.slice(1, 5)
  }, [items])

  const message = [`Olá, ${brand.name}! Montei este look no provador do site:`, ...lines.map((l) => `• ${l}`), 'Vocês têm disponível?'].join('\n')

  async function takePhoto() {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const rows: Row[] = board.whole ? ['whole'] : ['top', 'bottom']
      const cells = rows.flatMap((row) => {
        const worn = board[row]
        if (!worn) return []
        return [{ source: pieceSource(worn.product, worn.color), focus: FOCUS[rowSlot[row]], hex: worn.product.colors[worn.color]?.hex }]
      })
      const blob = await lookPhoto(cells, lines.slice(0, -1), brand.name, brand.instagram ? `@${brand.instagram}` : brand.name)
      const result = await shareOrDownload(blob, 'meu-look-anghel.jpg', `Olha o look que eu montei na ${brand.name}!`)
      if (result === 'downloaded') setNotice('Foto salva! Ela está nos seus downloads.')
    } catch {
      setNotice('Não foi possível montar a foto agora.')
    } finally {
      setBusy(false)
    }
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:border-gold/60 disabled:opacity-50'

  return (
    <section id="provador" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionLabel>Provador</SectionLabel>
          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95] tracking-tight">
              Monte o seu <span className="text-gradient font-script text-[1.1em]">look.</span>
            </h2>
            <p className="max-w-sm text-muted">
              Combine a parte de cima com a de baixo, ou escolha um vestido. Arraste cada peça para o lado para trocar, salve a foto do look e
              peça pelo WhatsApp.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          {/* Quadro do look */}
          <div className="grid min-w-0 content-start gap-4 lg:sticky lg:top-24 lg:self-start">
            <LookBoard className="aspect-[4/5] w-full" />
            <div className="flex flex-wrap items-center gap-2">
              {both && (
                <div className="mr-auto flex rounded-full border border-line p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      const first = options.top[0] ?? options.bottom[0]
                      if (board.whole && first) wear(first)
                    }}
                    aria-pressed={!board.whole}
                    className={`rounded-full px-3.5 py-1.5 transition-colors ${!board.whole ? 'bg-cream text-ink' : 'text-muted hover:text-cream'}`}
                  >
                    Duas peças
                  </button>
                  <button
                    type="button"
                    onClick={() => !board.whole && wear(options.whole[0])}
                    aria-pressed={Boolean(board.whole)}
                    className={`rounded-full px-3.5 py-1.5 transition-colors ${board.whole ? 'bg-cream text-ink' : 'text-muted hover:text-cream'}`}
                  >
                    Peça inteira
                  </button>
                </div>
              )}
              <button type="button" onClick={surprise} className={btn}>
                <TbArrowsShuffle aria-hidden /> Surpreenda-me
              </button>
              <button type="button" onClick={() => void takePhoto()} disabled={busy || !items.length} className={btn}>
                {busy ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbCamera aria-hidden />} Foto do look
              </button>
            </div>
            <AnimatePresence>
              {notice && (
                <motion.p role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-mint">
                  {notice}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Escolhas */}
          <div className="grid min-w-0 grid-cols-1 content-start gap-8">
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
                    {t.label} <span className={currentTab === t.id ? 'text-ink/60' : 'text-faint'}>{options[t.id].length}</span>
                  </button>
                ))}
              </div>
              <ul role="tabpanel" className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {options[currentTab].map((p) => {
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

            <fieldset className="min-w-0 border-t border-line pt-6">
              <legend className="sr-only">Peças vestidas</legend>
              <p aria-hidden className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                Vestindo agora
              </p>
              {items.length ? (
                <ul className="grid grid-cols-1 gap-3">
                  {items.map((item) => (
                    <WornRow key={item.product.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Escolha uma peça acima para começar o look.</p>
              )}
            </fieldset>

            <fieldset className="min-w-0 border-t border-line pt-6">
              <legend className="sr-only">Seu tamanho</legend>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
              Disponibilidade, valores e entrega a gente confirma na conversa.
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
