// Etiqueta de papel das peças da arara 3D, desenhada em canvas: nome, preço e selos (novidade, esgotado)

export const TAG_SIZE = { width: 640, height: 360 }

let fonts: Promise<unknown> | null = null

export function tagFontsReady() {
  fonts ??= Promise.all([
    document.fonts.load('600 64px "Cormorant Garamond Variable"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond Variable"'),
    document.fonts.load('800 32px "Inter Variable"'),
    document.fonts.load('600 32px "Inter Variable"'),
    document.fonts.load('64px "Parisienne"'),
  ]).catch(() => undefined)
  return fonts
}

// Quebra o nome em até duas linhas que cabem na largura
function lines(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > max && line) {
      out.push(line)
      line = word
    } else line = next
  }
  if (line) out.push(line)
  if (out.length > 2) {
    out.length = 2
    out[1] = out[1].replace(/\s*\S*$/, '') + '…'
  }
  return out
}

export type TagInput = { name: string; price: string; isNew: boolean; soldOut: boolean; colors: string[] }

export function drawTag(canvas: HTMLCanvasElement, tag: TagInput) {
  const { width: w, height: h } = TAG_SIZE
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // papel cor de creme com borda dourada
  ctx.fillStyle = '#f7efe4'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#c9a46c'
  ctx.lineWidth = 5
  ctx.strokeRect(16, 16, w - 32, h - 32)
  // furinho do barbante
  ctx.fillStyle = '#d9c7ad'
  ctx.beginPath()
  ctx.arc(w / 2, 46, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#2a1d16'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 46px "Cormorant Garamond Variable", Georgia, serif'
  const name = lines(ctx, tag.name, w - 110)
  name.forEach((line, i) => ctx.fillText(line, w / 2, (name.length === 1 ? 118 : 104) + i * 42))

  // bolinhas das cores
  const dots = tag.colors.slice(0, 6)
  const gap = 34
  const dotsY = name.length === 1 ? 160 : 176
  dots.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(w / 2 - ((dots.length - 1) * gap) / 2 + i * gap, dotsY, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()
  })

  // preço em destaque (é o que a cliente procura antes de abrir a peça)
  if (tag.price) {
    ctx.fillStyle = '#6b4a2a'
    ctx.font = '800 96px "Inter Variable", system-ui, sans-serif'
    // preço comprido (ex.: R$ 1.299,90) diminui para caber
    const fit = Math.min(1, (w - 70) / ctx.measureText(tag.price).width)
    ctx.font = `800 ${Math.floor(96 * fit)}px "Inter Variable", system-ui, sans-serif`
    ctx.fillText(tag.price, w / 2, h - 44)
  } else {
    ctx.fillStyle = '#7a5a3a'
    ctx.font = 'italic 500 42px "Cormorant Garamond Variable", Georgia, serif'
    ctx.fillText('consulte o valor', w / 2, h - 58)
  }

  if (tag.isNew && !tag.soldOut) {
    ctx.save()
    ctx.translate(w - 84, 60)
    ctx.rotate(0.25)
    ctx.fillStyle = '#e3a69f'
    ctx.fillRect(-70, -24, 140, 48)
    ctx.fillStyle = '#2a1d16'
    ctx.font = '700 26px "Inter Variable", system-ui, sans-serif'
    ctx.fillText('NOVO', 0, 9)
    ctx.restore()
  }
  if (tag.soldOut) {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-0.18)
    ctx.strokeStyle = 'rgba(160, 40, 40, 0.85)'
    ctx.lineWidth = 7
    ctx.strokeRect(-180, -44, 360, 88)
    ctx.fillStyle = 'rgba(160, 40, 40, 0.9)'
    ctx.font = '800 54px "Inter Variable", system-ui, sans-serif'
    ctx.fillText('ESGOTADO', 0, 19)
    ctx.restore()
  }
}
