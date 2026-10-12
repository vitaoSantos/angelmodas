import { useEffect, useState } from 'react'
import { TbArrowBackUp, TbCheck, TbLoader2 } from 'react-icons/tb'
import { categories } from '../data/catalog'
import { adminSaveSettings } from '../lib/api'
import { emptySettings, type SiteSettings } from '../lib/siteTypes'
import { Notice, PanelHeader, Switch, useLeaveWarning, type PanelProps } from './ui'

// O que está ligado: o que foi marcado no painel ou, se nunca foi mexido, ligado
const categoryOn = (s: SiteSettings, id: string) => s.categories[id] ?? true

function sameChoices(a: SiteSettings, b: SiteSettings) {
  return categories.every((c) => categoryOn(a, c.id) === categoryOn(b, c.id)) && a.showPrices === b.showPrices
}

export function OptionsPanel({ password, data, update }: PanelProps) {
  const [draft, setDraft] = useState<SiteSettings>(data.settings)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const dirty = !sameChoices(draft, data.settings)
  useLeaveWarning(dirty)

  // ao entrar de novo (senha salva) o painel recarrega: começa do que está publicado
  useEffect(() => setDraft(data.settings), [data.settings])

  const on = categories.filter((c) => categoryOn(draft, c.id)).length
  const count = (id: string) => data.products.filter((p) => p.category === id).length

  async function save() {
    setSaving(true)
    setNotice(null)
    try {
      const { settings } = await adminSaveSettings(password, draft)
      update((d) => ({ ...d, settings }))
      setNotice({ tone: 'ok', text: 'Salvo! Em alguns segundos o site já mostra as mudanças.' })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Não foi possível salvar agora.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-12 pb-28">
      <PanelHeader title="Opções do site">
        Esconda uma categoria inteira (por exemplo, fora de estação) e escolha se os preços aparecem. Nada é apagado: é só ligar de novo
        quando quiser.
      </PanelHeader>

      <section aria-labelledby="categorias" className="grid gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-8">
          <h2 id="categorias" className="font-display text-3xl">
            Categorias <span className="text-base text-muted">· {on} de {categories.length} aparecendo</span>
          </h2>
          <p className="text-sm text-muted">Pelo menos uma precisa ficar ligada.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => {
            const active = categoryOn(draft, c.id)
            return (
              <li
                key={c.id}
                className={`flex items-center gap-4 rounded-[1.5rem] border p-4 transition-colors ${active ? 'border-gold/50 bg-gold/[0.06]' : 'border-line bg-ink-2'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.label}</span>
                  <span className={`block text-sm ${active ? 'text-mint' : 'text-faint'}`}>
                    {active ? 'Aparece no site' : 'Escondida'} · {count(c.id)} {count(c.id) === 1 ? 'peça' : 'peças'}
                  </span>
                </span>
                <Switch
                  on={active}
                  label={`Mostrar a categoria ${c.label}`}
                  disabled={active && on === 1}
                  onToggle={() => {
                    setNotice(null)
                    setDraft((s) => ({ ...s, categories: { ...s.categories, [c.id]: !active } }))
                  }}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="precos" className="grid gap-5">
        <div className="border-t border-line pt-8">
          <h2 id="precos" className="font-display text-3xl">
            Preços
          </h2>
        </div>
        <div className="flex max-w-xl items-center gap-4 rounded-[1.5rem] border border-line bg-ink-2 p-5">
          <Switch
            on={draft.showPrices}
            label="Mostrar os preços no site"
            onToggle={() => {
              setNotice(null)
              setDraft((s) => ({ ...s, showPrices: !s.showPrices }))
            }}
          />
          <p className="text-sm text-muted">
            <span className="block text-cream">Mostrar os preços no site</span>
            {draft.showPrices
              ? 'Ligado: as peças com preço cadastrado mostram o valor.'
              : 'Desligado: nenhuma peça mostra preço; a cliente pergunta no WhatsApp.'}
          </p>
        </div>
      </section>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink-2 transition-transform duration-300 ${
          dirty || saving ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        aria-hidden={!dirty && !saving}
      >
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted">Você mudou algumas opções. Salve para valer no site.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(data.settings)}
              disabled={saving}
              tabIndex={dirty ? 0 : -1}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-muted hover:text-cream"
            >
              <TbArrowBackUp aria-hidden /> Desfazer
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              tabIndex={dirty ? 0 : -1}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {saving ? <TbLoader2 aria-hidden className="animate-spin" /> : <TbCheck aria-hidden />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-faint">
        Quer voltar tudo ao padrão?{' '}
        <button type="button" onClick={() => setDraft(emptySettings())} className="text-gold hover:underline">
          Restaurar as opções originais
        </button>{' '}
        (depois é só salvar).
      </p>
    </div>
  )
}
