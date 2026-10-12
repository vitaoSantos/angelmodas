// Etiqueta de papel das peças da arara 3D, desenhada em canvas: nome, preço e selos (novidade, esgotado)

export const TAG_SIZE = { width: 512, height: 288 }

let fonts: Promise<unknown> | null = null

export function tagFontsReady() {
  fonts ??= Promise.all([
    document.fonts.load('600 64px "Cormorant Garamond Variable"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond Variable"'),
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
  ctx.lineWidth = 4
  ctx.strokeRect(14, 14, w - 28, h - 28)
  // furinho do barbante
  ctx.fillStyle = '#d9c7ad'
  ctx.beginPath()
  ctx.arc(w / 2, 40, 11, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#2a1d16'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 46px "Cormorant Garamond Variable", Georgia, serif'
  const name = lines(ctx, tag.name, w - 90)
  name.forEach((line, i) => ctx.fillText(line, w / 2, (name.length === 1 ? 120 : 102) + i * 46))

  // bolinhas das cores
  const dots = tag.colors.slice(0, 6)
  const gap = 30
  dots.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(w / 2 - ((dots.length - 1) * gap) / 2 + i * gap, 196, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()
  })

  ctx.fillStyle = '#7a5a3a'
  ctx.font = tag.price ? '600 34px "Inter Variable", system-ui, sans-serif' : 'italic 500 34px "Cormorant Garamond Variable", Georgia, serif'
  ctx.fillText(tag.price || 'consulte o valor', w / 2, 250)

  if (tag.isNew && !tag.soldOut) {
    ctx.save()
    ctx.translate(w - 70, 52)
    ctx.rotate(0.25)
    ctx.fillStyle = '#e3a69f'
    ctx.fillRect(-58, -20, 116, 40)
    ctx.fillStyle = '#2a1d16'
    ctx.font = '700 22px "Inter Variable", system-ui, sans-serif'
    ctx.fillText('NOVO', 0, 8)
    ctx.restore()
  }
  if (tag.soldOut) {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-0.18)
    ctx.strokeStyle = 'rgba(160, 40, 40, 0.85)'
    ctx.lineWidth = 6
    ctx.strokeRect(-150, -36, 300, 72)
    ctx.fillStyle = 'rgba(160, 40, 40, 0.9)'
    ctx.font = '800 44px "Inter Variable", system-ui, sans-serif'
    ctx.fillText('ESGOTADO', 0, 16)
    ctx.restore()
  }
}
