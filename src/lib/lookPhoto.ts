import type { PieceSource } from './products'
import { tagFontsReady } from './tagArt'

// Foto do look para compartilhar (formato do feed, 1080 x 1350): o papel do provador com as peças,
// a lista do que está no look e o @ da loja
export type LookPhotoCell = { source: PieceSource; focus: string; hex?: string }

const W = 1080
const H = 1350

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a foto da peça.'))
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function drawCell(ctx: CanvasRenderingContext2D, cell: LookPhotoCell, x: number, y: number, w: number, h: number) {
  if (cell.source.kind === 'none') {
    roundRect(ctx, x + 30, y + 20, w - 60, h - 40, 28)
    ctx.fillStyle = cell.hex ?? '#d6bf9f'
    ctx.fill()
    return
  }
  const img = await load(cell.source.url)
  ctx.save()
  if (cell.source.cutout) {
    // sem fundo: cabe inteira, com a sombra do próprio contorno
    const s = Math.min((w - 60) / img.width, (h - 40) / img.height)
    const dw = img.width * s
    const dh = img.height * s
    ctx.shadowColor = 'rgba(60, 40, 20, 0.32)'
    ctx.shadowBlur = 36
    ctx.shadowOffsetY = 22
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  } else {
    // com fundo: preenche o espaço, como uma foto pousada no papel
    const bx = x + 40
    const by = y + 24
    const bw = w - 80
    const bh = h - 48
    ctx.shadowColor = 'rgba(60, 40, 20, 0.4)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 20
    roundRect(ctx, bx, by, bw, bh, 26)
    ctx.fillStyle = '#e4d8c8'
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.clip()
    const s = Math.max(bw / img.width, bh / img.height)
    const [fx, fy] = cell.focus.split(' ').map((v) => parseFloat(v) / 100)
    const dw = img.width * s
    const dh = img.height * s
    ctx.drawImage(img, bx - (dw - bw) * fx, by - (dh - bh) * fy, dw, dh)
  }
  ctx.restore()
}

export async function lookPhoto(cells: LookPhotoCell[], lines: string[], brandName: string, footer: string) {
  await tagFontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível montar a foto.')

  const paper = ctx.createLinearGradient(0, 0, 0, H)
  paper.addColorStop(0, '#f3ebe0')
  paper.addColorStop(1, '#e6dacb')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#2a1d16'
  ctx.font = '600 58px "Cormorant Garamond Variable", Georgia, serif'
  ctx.fillText(brandName, W / 2, 96)
  ctx.fillStyle = '#a9834f'
  ctx.font = '44px "Parisienne", cursive'
  ctx.fillText('o meu look', W / 2, 150)

  const top = 180
  const bottom = H - 70 - lines.length * 40
  const gap = 10
  const rowH = (bottom - top - gap * (cells.length - 1)) / Math.max(1, cells.length)
  for (let i = 0; i < cells.length; i++) await drawCell(ctx, cells[i], 60, top + i * (rowH + gap), W - 120, rowH)

  ctx.fillStyle = '#3d2c22'
  ctx.font = '500 30px "Inter Variable", system-ui, sans-serif'
  lines.forEach((line, i) => ctx.fillText(line.length > 60 ? `${line.slice(0, 59)}…` : line, W / 2, bottom + 36 + i * 40))
  ctx.fillStyle = '#a9834f'
  ctx.font = '600 28px "Inter Variable", system-ui, sans-serif'
  ctx.fillText(footer, W / 2, H - 34)

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível montar a foto.'))), 'image/jpeg', 0.9))
}
