// Mês em que a foto foi tirada, lido do EXIF do JPEG (DateTimeOriginal), no formato "2025-03".
// Só serve para já deixar a data preenchida no painel; se não achar, devolve '' e a pessoa escolhe.
export async function photoMonth(file: Blob): Promise<string> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (view.getUint16(0) !== 0xffd8) return '' // não é JPEG
    let offset = 2
    while (offset + 10 <= view.byteLength) {
      const marker = view.getUint16(offset)
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return '' // começou a imagem: não tem EXIF
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return readDate(view, offset + 10) // "Exif"
      offset += 2 + view.getUint16(offset + 2)
    }
  } catch {
    // arquivo curto ou EXIF quebrado: segue sem data
  }
  return ''
}

function readDate(view: DataView, tiff: number) {
  const little = view.getUint16(tiff) === 0x4949
  const u16 = (at: number) => view.getUint16(tiff + at, little)
  const u32 = (at: number) => view.getUint32(tiff + at, little)
  // posição do valor de uma tag dentro de um diretório do EXIF (-1 se não tiver)
  const find = (dir: number, tag: number) => {
    for (let i = 0, n = u16(dir); i < n; i++) {
      const entry = dir + 2 + i * 12
      if (u16(entry) === tag) return u32(entry + 8)
    }
    return -1
  }
  const main = u32(4)
  const exif = find(main, 0x8769)
  let at = exif > 0 ? find(exif, 0x9003) : -1 // data em que foi tirada
  if (at < 0) at = find(main, 0x0132) // data do arquivo
  if (at < 0) return ''
  const text = String.fromCharCode(...Array.from({ length: 7 }, (_, i) => view.getUint8(tiff + at + i))) // "2025:03"
  const match = /^(\d{4}):(0[1-9]|1[0-2])$/.exec(text)
  if (!match || Number(match[1]) < 2000 || Number(match[1]) > new Date().getFullYear() + 1) return ''
  return `${match[1]}-${match[2]}`
}
