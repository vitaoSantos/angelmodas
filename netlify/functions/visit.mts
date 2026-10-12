import type { Context } from '@netlify/functions'
import { EMPTY_VISITS, ipKey, isBot, json, KEYS, readVisits, today, updateJSON, type StoredVisits } from '../lib/store'

// Público: conta uma visita. O site chama no máximo uma vez por dia em cada navegador;
// aqui ainda há um teto por endereço de internet por dia, para ninguém inflar o número.
const PER_IP_PER_DAY = 25
const KEEP_DAYS = 90

// Guarda só os últimos dias (o total continua somando tudo)
function recent(days: Record<string, number>) {
  return Object.fromEntries(Object.entries(days).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, KEEP_DAYS))
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (isBot(req.headers.get('user-agent'))) return json({ total: (await readVisits()).total, counted: false })

  const day = today()
  const who = await ipKey(context.ip, day)
  const result = { counted: false }
  const after = await updateJSON<StoredVisits>(KEYS.visits, EMPTY_VISITS, (v) => {
    const caps = v.caps?.day === day ? v.caps : { day, ips: {} }
    const seen = caps.ips[who] ?? 0
    result.counted = seen < PER_IP_PER_DAY
    if (!result.counted) return v // passou do teto: não grava nada
    return {
      total: (v.total ?? 0) + 1,
      days: recent({ ...v.days, [day]: (v.days?.[day] ?? 0) + 1 }),
      caps: { day, ips: { ...caps.ips, [who]: seen + 1 } },
    }
  })
  return json({ total: after.total ?? 0, counted: result.counted })
}
