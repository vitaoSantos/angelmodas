// Tira o fundo da foto da peça sozinha (esticada na cama, no cabide contra a parede…), no próprio
// navegador e sem custo. Funciona quando o fundo é liso ou quase liso: a partir das bordas da foto,
// vai "pintando" o que tem a cor do fundo (aceitando a variação suave da luz) até bater na peça.
// Se o fundo for bagunçado ou parecido demais com a peça, avisa que não deu e o painel usa a foto inteira.

const MAX = 1000

type Lab = { l: Float32Array; a: Float32Array; b: Float32Array }

// sRGB → Lab (iluminante D65): distâncias em Lab acompanham o que o olho vê como "cor parecida"
function toLab(data: Uint8ClampedArray, count: number): Lab {
  const l = new Float32Array(count)
  const a = new Float32Array(count)
  const b = new Float32Array(count)
  const lin = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const c = i / 255
    lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  for (let i = 0; i < count; i++) {
    const r = lin[data[i * 4]]
    const g = lin[data[i * 4 + 1]]
    const bl = lin[data[i * 4 + 2]]
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047)
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * bl)
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883)
    l[i] = 116 * y - 16
    a[i] = 500 * (x - y)
    b[i] = 200 * (y - z)
  }
  return { l, a, b }
}

const dist = (lab: Lab, i: number, l: number, a: number, b: number) => Math.hypot(lab.l[i] - l, lab.a[i] - a, lab.b[i] - b)

// Cores do fundo: agrupa os pixels da borda da foto (até 3 grupos, como lençol + sombra + parede)
function backgroundColors(lab: Lab, w: number, h: number) {
  const margin = Math.max(2, Math.round(Math.min(w, h) * 0.02))
  const samples: number[] = []
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x < margin || y < margin || x >= w - margin || y >= h - margin) samples.push(y * w + x)
    }
  }
  let centers = [0, Math.floor(samples.length / 3), Math.floor((2 * samples.length) / 3)].map((k) => {
    const i = samples[k]
    return [lab.l[i], lab.a[i], lab.b[i]]
  })
  let counts = [0, 0, 0]
  for (let round = 0; round < 8; round++) {
    const sums = centers.map(() => [0, 0, 0])
    counts = [0, 0, 0]
    for (const i of samples) {
      let best = 0
      let bestD = Infinity
      centers.forEach((c, k) => {
        const d = dist(lab, i, c[0], c[1], c[2])
        if (d < bestD) {
          bestD = d
          best = k
        }
      })
      sums[best][0] += lab.l[i]
      sums[best][1] += lab.a[i]
      sums[best][2] += lab.b[i]
      counts[best]++
    }
    centers = centers.map((c, k) => (counts[k] ? sums[k].map((v) => v / counts[k]) : c))
  }
  // só vale como fundo o grupo que ocupa um bom pedaço da borda (a peça pode encostar na borda)
  return centers.filter((_, k) => counts[k] >= samples.length * 0.12)
}

export type Cutout = { blob: Blob; width: number; height: number; coverage: number }

export class CutoutError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

// Imagem com transparência: WebP onde o navegador gera, PNG nos outros (Safari)
async function encodeAlpha(canvas: HTMLCanvasElement) {
  const webp = await toBlob(canvas, 'image/webp', 0.9)
  if (webp && webp.type === 'image/webp') return webp
  const png = await toBlob(canvas, 'image/png')
  if (!png) throw new CutoutError('Não foi possível gerar a imagem.')
  return png
}

export async function removeBackground(source: ImageBitmap): Promise<Cutout> {
  const scale = Math.min(1, MAX / Math.max(source.width, source.height))
  const w = Math.round(source.width * scale)
  const h = Math.round(source.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new CutoutError('Não foi possível processar a imagem.')
  ctx.drawImage(source, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  const count = w * h
  const lab = toLab(data, count)
  const refs = backgroundColors(lab, w, h)
  if (!refs.length) throw new CutoutError('O fundo desta foto é muito variado. Fotografe a peça sobre um fundo liso (lençol, parede ou papel).')

  const nearRef = (i: number) => {
    let best = Infinity
    for (const r of refs) best = Math.min(best, dist(lab, i, r[0], r[1], r[2]))
    return best
  }
  const refD = new Float32Array(count)
  for (let i = 0; i < count; i++) refD[i] = nearRef(i)

  // Pinta o fundo a partir das bordas: o vizinho entra se é parecido com o pixel de onde veio
  // (a luz muda devagar no fundo) e não se afasta demais da cor do fundo
  const bg = new Uint8Array(count)
  const queue = new Int32Array(count)
  let head = 0
  let tail = 0
  const seed = (i: number, limit: number) => {
    if (!bg[i] && refD[i] < limit) {
      bg[i] = 1
      queue[tail++] = i
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x, 14)
    seed((h - 1) * w + x, 14)
  }
  for (let y = 0; y < h; y++) {
    seed(y * w, 14)
    seed(y * w + w - 1, 14)
  }
  // vizinhos (esquerda, direita, cima, baixo) de p; -1 quando sai da foto
  const neighbor = (p: number, k: number) => {
    const x = p % w
    if (k === 0) return x > 0 ? p - 1 : -1
    if (k === 1) return x < w - 1 ? p + 1 : -1
    if (k === 2) return p >= w ? p - w : -1
    return p + w < count ? p + w : -1
  }
  const joins = (p: number, q: number) => (dist(lab, q, lab.l[p], lab.a[p], lab.b[p]) < 5.5 && refD[q] < 26) || refD[q] < 9
  const grow = (mark: Uint8Array, visit?: number[]) => {
    while (head < tail) {
      const p = queue[head++]
      for (let k = 0; k < 4; k++) {
        const q = neighbor(p, k)
        if (q < 0 || mark[q] || bg[q] || !joins(p, q)) continue
        mark[q] = 1
        queue[tail++] = q
        visit?.push(q)
      }
    }
  }
  grow(bg)
  // Buracos de fundo cercados pela peça (entre as alças, dentro da cava): só valem se forem bem
  // parecidos com o fundo e não forem pequenos (detalhes claros de uma estampa ficam na peça)
  const hole = new Uint8Array(count)
  for (let i = 0; i < count; i += 2) {
    if (bg[i] || hole[i] || refD[i] >= 5) continue
    const region = [i]
    hole[i] = 1
    head = 0
    tail = 0
    queue[tail++] = i
    grow(hole, region)
    const mean = region.reduce((sum, q) => sum + refD[q], 0) / region.length
    if (region.length >= count * 0.002 && mean < 7) for (const q of region) bg[q] = 1
  }

  // Fica só com a peça (as maiores partes); manchinhas soltas viram fundo
  const label = new Int32Array(count).fill(-1)
  const sizes: number[] = []
  const touches: boolean[] = []
  for (let i = 0; i < count; i++) {
    if (bg[i] || label[i] >= 0) continue
    const id = sizes.length
    let n = 0
    let border = false
    head = 0
    tail = 0
    label[i] = id
    queue[tail++] = i
    while (head < tail) {
      const p = queue[head++]
      n++
      for (let k = 0; k < 4; k++) {
        const q = neighbor(p, k)
        if (q < 0) border = true
        else if (!bg[q] && label[q] < 0) {
          label[q] = id
          queue[tail++] = q
        }
      }
    }
    sizes.push(n)
    touches.push(border)
  }
  // a maior parte é a peça; outras partes grandes só ficam se não encostam na borda da foto
  // (uma faixa, um cinto). As que encostam na borda costumam ser fundo que sobrou (piso, móvel).
  const main = sizes.reduce((best, n, id) => (n > sizes[best] ? id : best), 0)
  const largest = sizes[main] ?? 0
  const keep = sizes.map((n, id) => id === main || (n >= largest * 0.15 && !touches[id]))
  const mask = new Float32Array(count)
  let kept = 0
  for (let i = 0; i < count; i++) {
    if (!bg[i] && keep[label[i]]) {
      mask[i] = 1
      kept++
    }
  }
  const coverage = kept / count
  // pedaços de "peça" encostados em muita borda da foto quase sempre são fundo que não saiu (piso, móveis)
  let edge = 0
  for (let x = 0; x < w; x++) edge += mask[x] + mask[(h - 1) * w + x]
  for (let y = 0; y < h; y++) edge += mask[y * w] + mask[y * w + w - 1]
  if (edge / (2 * (w + h)) > 0.12) {
    throw new CutoutError('O fundo desta foto é muito variado. Fotografe a peça sobre um fundo liso (lençol, parede ou papel).')
  }
  if (coverage < 0.06 || coverage > 0.93) {
    throw new CutoutError('Não deu para separar a peça do fundo. Tente uma foto com a peça inteira e um fundo liso de outra cor.')
  }

  // Borda macia: desfoca a máscara e aperta um pouco (tira o contorno da cor do fundo)
  const blur = (src: Float32Array, r: number) => {
    const tmp = new Float32Array(count)
    const out = new Float32Array(count)
    for (let y = 0; y < h; y++) {
      let acc = 0
      for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1)
        acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * r + 1)
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
      }
    }
    return out
  }
  const soft = blur(blur(mask, 1), 1)
  const bgRgb = refs.map((r) => labToRgb(r[0], r[1], r[2]))
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < count; i++) {
    const t = Math.min(1, Math.max(0, (soft[i] - 0.3) / 0.55))
    const alpha = t * t * (3 - 2 * t)
    data[i * 4 + 3] = Math.round(alpha * 255)
    if (alpha > 0.04) {
      const x = i % w
      const y = (i - x) / w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      // na borda, tira a mistura com a cor do fundo
      if (alpha < 0.98) {
        const ref = bgRgb[0]
        for (let c = 0; c < 3; c++) {
          data[i * 4 + c] = Math.min(255, Math.max(0, (data[i * 4 + c] - (1 - alpha) * ref[c]) / Math.max(alpha, 0.25)))
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)

  // Recorta em volta da peça, com uma folguinha
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03)
  const cx = Math.max(0, minX - pad)
  const cy = Math.max(0, minY - pad)
  const cw = Math.min(w, maxX + pad + 1) - cx
  const ch = Math.min(h, maxY + pad + 1) - cy
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')?.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return { blob: await encodeAlpha(out), width: cw, height: ch, coverage }
}

function labToRgb(l: number, a: number, b: number): [number, number, number] {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const x = inv(fx) * 0.95047
  const y = inv(fy)
  const z = inv(fz) * 1.08883
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z
  const bl = 0.0557 * x - 0.204 * y + 1.057 * z
  const gamma = (c: number) => 255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
  return [gamma(r), gamma(g), gamma(bl)]
}
