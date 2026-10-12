import type { Context } from '@netlify/functions'
import type { StoredComment } from '../../src/lib/siteTypes'
import { EMPTY_COMMENTS, ipKey, isBot, json, KEYS, newId, purgeSite, readCommunity, store, updateJSON, type CommentIndex } from '../lib/store'
import { clean, cleanMultiline } from '../lib/text'

// Público: recebe um recado da seção Comunidade. Por padrão ele espera aprovação no painel;
// se o painel estiver em "publicar direto", já entra no site.
const LIMITS = { name: 40, city: 40, message: 600, perHour: 3, stored: 500, pending: 100 }
const HOUR = 60 * 60 * 1000

// Links são a porta de entrada do spam: recado com link não entra
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|xyz|ru|info|biz|online|site|top|shop|app|link|me|ly)\b)/i

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (isBot(req.headers.get('user-agent'))) return json({ error: 'Não foi possível enviar.' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Envio inválido.' }, 400)
  }

  // Armadilha para robôs: campo escondido preenchido ou formulário enviado rápido demais.
  // Responde como se tivesse dado certo, para o robô não tentar de outro jeito.
  if (body.website || !(Number(body.elapsed) >= 2500)) return json({ status: 'pending' }, 201)

  const name = clean(body.name, LIMITS.name)
  const city = clean(body.city, LIMITS.city)
  const message = cleanMultiline(body.message, LIMITS.message)
  const rating = typeof body.rating === 'number' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : 0
  if (name.length < 2) return json({ error: 'Escreva seu nome.' }, 400)
  if (message.length < 5) return json({ error: 'Escreva um recado um pouquinho maior.' }, 400)
  if (LINK.test(`${name} ${city} ${message}`)) return json({ error: 'Os recados não podem ter links.' }, 400)

  // No máximo alguns recados por hora do mesmo endereço de internet
  const s = store()
  const who = await ipKey(context.ip, 'recados')
  const now = Date.now()
  const rate = (await s.get(KEYS.commentRate(who), { type: 'json' })) as { times?: number[] } | null
  const recent = (rate?.times ?? []).filter((t) => now - t < HOUR)
  if (recent.length >= LIMITS.perHour) return json({ error: 'Você já mandou alguns recados agora há pouco. Tente de novo mais tarde.' }, 429)
  await s.setJSON(KEYS.commentRate(who), { times: [...recent, now] })

  const { autoPublish } = await readCommunity()
  const comment: StoredComment = {
    id: newId(),
    name,
    city,
    message,
    rating,
    createdAt: new Date(now).toISOString(),
    status: autoPublish ? 'approved' : 'pending',
  }
  const result = { full: false }
  await updateJSON<CommentIndex>(KEYS.comments, EMPTY_COMMENTS, (current) => {
    const pending = current.comments.filter((c) => c.status === 'pending').length
    result.full = current.comments.length >= LIMITS.stored || (!autoPublish && pending >= LIMITS.pending)
    return result.full ? current : { comments: [comment, ...current.comments] }
  })
  if (result.full) return json({ error: 'Os recados estão fechados por enquanto. Tente de novo em alguns dias.' }, 503)

  if (!autoPublish) return json({ status: comment.status }, 201)
  await purgeSite()
  const { status, ...published } = comment
  return json({ status, comment: published }, 201)
}
