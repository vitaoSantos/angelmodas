// Compartilha um arquivo (foto ou vídeo do look) pelo menu do celular; sem isso, baixa o arquivo
export async function shareOrDownload(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      // a pessoa fechou o menu: não baixa nada
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

export const canRecordVideo = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
