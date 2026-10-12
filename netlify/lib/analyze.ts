import Anthropic from '@anthropic-ai/sdk'
import { categories, fabrics, palette } from '../../src/data/catalog'
import { validFits } from '../../src/data/fits'
import type { ProductColor } from '../../src/lib/siteTypes'
import { PRODUCT_LIMITS } from './products'
import { env } from './store'
import { clean, cleanMultiline } from './text'

// Análise da foto da peça com o Claude (visão): sugere nome, categoria, onde veste no provador, tecido,
// cores e o ponto da foto onde o tecido aparece bem (o painel tira dali a cor exata e o recorte do tecido).
// Precisa da variável ANTHROPIC_API_KEY no Netlify. Nada é salvo: o painel só preenche o formulário.

export type PhotoAnalysis = {
  name: string
  category: string
  fits: string[]
  fabric: string
  colors: ProductColor[]
  description: string
  point: { x: number; y: number }
}

const MODEL = 'claude-opus-5-5'

const SCHEMA = {
  type: 'object',
  properties: {
    isClothing: { type: 'boolean', description: 'false se a foto não mostra uma peça de roupa ou acessório de moda' },
    name: { type: 'string', description: 'Nome curto para a vitrine, ex.: "Vestido midi canelado" (até 6 palavras)' },
    category: { type: 'string', enum: categories.map((c) => c.id) },
    fits: {
      type: 'array',
      items: { type: 'string', enum: ['cima', 'baixo', 'inteira'] },
      description: 'Onde a peça veste: ["cima"], ["baixo"], ["inteira"], ["cima", "baixo"] para conjunto, ou [] para acessório',
    },
    fabric: { type: 'string', enum: fabrics.map((f) => f.id) },
    colors: {
      type: 'array',
      description: 'Cores da peça, da principal para as outras (até 4)',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome da cor em português' },
          hex: { type: 'string', description: 'Cor em hexadecimal, ex.: #c48a84' },
        },
        required: ['name', 'hex'],
        additionalProperties: false,
      },
    },
    description: { type: 'string', description: 'Uma ou duas frases para a ficha da peça' },
    fabricPoint: {
      type: 'object',
      description: 'Ponto da foto (x e y de 0 a 1, a partir do canto de cima à esquerda) no meio de uma área lisa do tecido da peça principal',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
      additionalProperties: false,
    },
  },
  required: ['isClothing', 'name', 'category', 'fits', 'fabric', 'colors', 'description', 'fabricPoint'],
  additionalProperties: false,
}

const SYSTEM = [
  'Você ajuda a Anghel Modas, uma loja de moda feminina, a cadastrar peças no catálogo do site a partir da foto.',
  'No provador do site a cliente monta o look combinando parte de cima, parte de baixo ou uma peça inteira (vestido, macacão).',
  'Se a foto mostra um look com várias peças, cadastre a peça em destaque;',
  'se for um conjunto (duas peças do mesmo tecido), use a categoria "conjuntos" e onde veste ["cima", "baixo"].',
  'Escreva em português do Brasil, num tom simpático e direto, sem inventar detalhes que não aparecem na foto (nada de composição, preço ou tamanho).',
  '',
  'Categorias: ' + categories.map((c) => `${c.id} (${c.label})`).join(', ') + '.',
  '',
  'Tecidos: ' + fabrics.map((f) => `${f.id} (${f.label}, ${f.hint})`).join(', ') + '.',
  'Use "estampado" só quando a peça tem estampa (floral, animal print, listras).',
  '',
  'Nomes de cor preferidos: ' + palette.map((p) => `${p.label} ${p.color}`).join(', ') + '.',
].join('\n')

export class AnalysisError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const HEX = /^#[0-9a-f]{6}$/
const unit = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(0.95, Math.max(0.05, n)) : 0.5
}

// Confere a resposta: só passa o que existe nas listas do site
function cleanAnalysis(raw: Record<string, unknown>): PhotoAnalysis {
  const category = categories.some((c) => c.id === raw.category) ? String(raw.category) : categories[0].id
  const fabric = fabrics.some((f) => f.id === raw.fabric) ? String(raw.fabric) : fabrics[0].id
  const colors: ProductColor[] = []
  for (const item of Array.isArray(raw.colors) ? raw.colors.slice(0, 4) : []) {
    const hex = String((item as Record<string, unknown>)?.hex ?? '').toLowerCase()
    const name = clean((item as Record<string, unknown>)?.name, PRODUCT_LIMITS.colorName)
    if (HEX.test(hex) && name) colors.push({ name, hex })
  }
  const point = (raw.fabricPoint ?? {}) as Record<string, unknown>
  return {
    name: clean(raw.name, PRODUCT_LIMITS.name),
    category,
    fits: validFits(Array.isArray(raw.fits) ? raw.fits.filter((f): f is string => typeof f === 'string') : []),
    fabric,
    colors,
    description: cleanMultiline(raw.description, PRODUCT_LIMITS.description),
    point: { x: unit(point.x), y: unit(point.y) },
  }
}

export async function analyzePhoto(image: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<PhotoAnalysis> {
  const apiKey = env('ANTHROPIC_API_KEY')
  if (!apiKey) throw new AnalysisError('Para usar a análise com IA, crie a variável ANTHROPIC_API_KEY no Netlify (veja o README).', 503)

  // a função do Netlify tem pouco tempo para responder: uma tentativa extra no máximo
  const client = new Anthropic({ apiKey, timeout: 24_000, maxRetries: 1 })
  let response: Anthropic.Beta.Messages.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // se o modelo recusar a foto, a API tenta de novo com o modelo indicado para o caso
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Analise a peça desta foto para o cadastro.' },
          ],
        },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new AnalysisError('A chave ANTHROPIC_API_KEY não foi aceita. Confira a variável no Netlify.', 503)
    }
    if (err instanceof Anthropic.RateLimitError) throw new AnalysisError('Muitas análises seguidas. Tente de novo em um minuto.', 429)
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AnalysisError('A análise demorou demais. Tente de novo.', 504)
    if (err instanceof Anthropic.BadRequestError) throw new AnalysisError('A IA não aceitou esta foto. Tente outra foto.', 422)
    console.error('analyze', err)
    throw new AnalysisError('A análise não está disponível agora. Tente de novo em instantes.', 502)
  }

  if (response.stop_reason === 'refusal') throw new AnalysisError('A IA não conseguiu analisar esta foto. Tente outra foto.', 422)
  const text = response.content.find((block) => block.type === 'text')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text?.type === 'text' ? text.text : '')
  } catch {
    throw new AnalysisError('A análise voltou incompleta. Tente de novo.', 502)
  }
  if (raw.isClothing === false) throw new AnalysisError('Não encontrei uma peça de roupa nesta foto.', 422)
  return cleanAnalysis(raw)
}
