import { ITEM_ID, KEYS, store } from '../lib/store'

const TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])

// Público: entrega as imagens guardadas pelo painel. Cada imagem tem id único,
// então pode ficar em cache "para sempre" no navegador e na CDN.
//   ?tipo=mural&id=…&tamanho=thumb|full          foto do mural de clientes
//   ?tipo=peca&id=…&foto=…&tamanho=thumb|full    foto de uma peça do catálogo
//   ?tipo=tecido&id=…&foto=…                      recorte do tecido (manequim 3D)
export default async (req: Request) => {
  const url = new URL(req.url)
  const kind = url.searchParams.get('tipo')
  const id = url.searchParams.get('id') ?? ''
  const key = url.searchParams.get('foto') ?? ''
  const size = url.searchParams.get('tamanho') === 'full' ? 'full' : 'thumb'
  if (!ITEM_ID.test(id)) return new Response('Imagem inválida', { status: 400 })

  let blobKey = ''
  if (kind === 'mural') blobKey = KEYS.photo(id, size)
  else if ((kind === 'peca' || kind === 'tecido') && ITEM_ID.test(key)) {
    blobKey = kind === 'peca' ? KEYS.productPhoto(id, key, size) : KEYS.swatch(id, key)
  } else return new Response('Imagem inválida', { status: 400 })

  // as imagens são pequenas (até ~3 MB): lê inteira, sem stream (mais estável no emulador local)
  const entry = await store().getWithMetadata(blobKey, { type: 'arrayBuffer' })
  if (!entry) return new Response('Imagem não encontrada', { status: 404, headers: { 'cache-control': 'no-store' } })

  const type = typeof entry.metadata.type === 'string' && TYPES.has(entry.metadata.type) ? entry.metadata.type : 'image/jpeg'
  return new Response(entry.data, {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=31536000, immutable',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=31536000, immutable',
      'netlify-cache-tag': `img-${id}`,
      'x-content-type-options': 'nosniff',
      // o manequim 3D usa o recorte do tecido como textura
      'access-control-allow-origin': '*',
    },
  })
}
