// Leitura e redução de imagens no navegador (fotos do catálogo e do mural no painel).
// Fotos de celular chegam com 3 a 12 MB; aqui viram arquivos leves antes de ir para qualquer lugar.

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    // respeita a rotação gravada pela câmera (EXIF)
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } catch {
      throw new Error('Não deu para abrir essa imagem. Envie em JPG, PNG ou WebP.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function drawScaled(source: ImageBitmap, max: number) {
  const scale = Math.min(1, max / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number) {
  let blob = await toBlob(canvas, 'image/webp', quality)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', Math.min(quality + 0.04, 0.9))
  if (!blob) throw new Error('Não foi possível processar a imagem.')
  return blob
}

// Reduz para no máximo `max` px no lado maior e salva em WebP (ou JPEG, se o navegador não gerar WebP)
export async function encodeImage(source: ImageBitmap, max: number, quality = 0.82) {
  const canvas = drawScaled(source, max)
  return { blob: await encodeCanvas(canvas, quality), width: canvas.width, height: canvas.height }
}

// Conteúdo do arquivo em base64 (sem o prefixo "data:...;base64,")
export function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(blob)
  })
}

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

// Pixels de um pedaço quadrado da foto (centro em x, y de 0 a 1; lado = `side` da menor dimensão)
function readSquare(source: ImageBitmap, x: number, y: number, side: number, out: number) {
  const px = Math.max(8, Math.round(Math.min(source.width, source.height) * side))
  const sx = Math.min(Math.max(0, Math.round(x * source.width - px / 2)), source.width - px)
  const sy = Math.min(Math.max(0, Math.round(y * source.height - px / 2)), source.height - px)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, px, px, 0, 0, out, out)
  return { canvas, data: ctx.getImageData(0, 0, out, out).data }
}

// Cor do tecido no ponto tocado: média dos pixels do meio da faixa de brilho
// (ignora brilhos e sombras fortes, que mudam muito a cor)
export function pickColor(source: ImageBitmap, x: number, y: number) {
  const { data } = readSquare(source, x, y, 0.04, 24)
  const pixels: [number, number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2], 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]])
  pixels.sort((a, b) => a[3] - b[3])
  const middle = pixels.slice(Math.floor(pixels.length * 0.2), Math.ceil(pixels.length * 0.8))
  const sum = middle.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
  return toHex(sum[0] / middle.length, sum[1] / middle.length, sum[2] / middle.length)
}

// Recorte quadrado do tecido no ponto tocado, para virar textura da peça no manequim 3D
export async function cropSwatch(source: ImageBitmap, x: number, y: number) {
  const { canvas } = readSquare(source, x, y, 0.16, 128)
  return encodeCanvas(canvas, 0.85)
}

// Sugestão de cor: o tom mais frequente no meio da foto, onde normalmente está a roupa
export function suggestColor(source: ImageBitmap) {
  const { data } = readSquare(source, 0.5, 0.45, 0.3, 48)
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n++
    bin.r += data[i]
    bin.g += data[i + 1]
    bin.b += data[i + 2]
    bins.set(key, bin)
  }
  let best = { n: 0, r: 0, g: 0, b: 0 }
  for (const bin of bins.values()) if (bin.n > best.n) best = bin
  return best.n ? toHex(best.r / best.n, best.g / best.n, best.b / best.n) : '#888888'
}
