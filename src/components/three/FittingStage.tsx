import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { Mannequin, restingFx, type MannequinFx, type WornPiece } from './Mannequin'
import { Glow, GoldDust, SoftShadow, Studio } from './Studio'
import type { Spin } from './shared'
import { Warmup } from './Warmup'

// Provador 3D: o manequim vestido com o look, girando devagar. Arrastar gira o manequim.
// Também tira a foto e grava o vídeo de 360° do look (com o nome da loja e as peças escritas).

// Funções de captura que o provador expõe para os botões
export type Capture = {
  photo: (overlay: Overlay) => Promise<Blob>
  video: (overlay: Overlay, seconds: number, onProgress?: (p: number) => void) => Promise<{ blob: Blob; ext: string }>
}

export type Overlay = { title: string; lines: string[]; footer: string }

type Props = {
  pieces: WornPiece[]
  spin: MutableRefObject<Spin>
  active: boolean
  mobile: boolean
  reduced: boolean
  capture?: MutableRefObject<Capture | null>
  onReady?: () => void
  background?: string
}

// Quadro do vídeo/foto: cabeçalho, manequim e a lista das peças
function drawFrame(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, overlay: Overlay) {
  const { width: w, height: h } = ctx.canvas
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#1a1513')
  bg.addColorStop(1, '#0e0c0b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // o manequim ocupa o meio, sem cortar
  const top = h * 0.13
  const bottom = h * (overlay.lines.length > 2 ? 0.25 : 0.21)
  const area = h - top - bottom
  const scale = Math.min(w / source.width, area / source.height)
  const dw = source.width * scale
  const dh = source.height * scale
  ctx.drawImage(source, (w - dw) / 2, top + (area - dh) / 2, dw, dh)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ecd8b4'
  ctx.font = `${Math.round(w * 0.09)}px Parisienne, cursive`
  ctx.fillText(overlay.title, w / 2, h * 0.085)
  ctx.fillStyle = 'rgba(245, 237, 226, 0.92)'
  ctx.font = `600 ${Math.round(w * 0.036)}px "Inter Variable", system-ui, sans-serif`
  overlay.lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line.length > 46 ? `${line.slice(0, 45)}…` : line, w / 2, h - bottom + h * 0.055 + i * w * 0.055)
  })
  ctx.fillStyle = '#d8b98a'
  ctx.font = `600 ${Math.round(w * 0.03)}px "Inter Variable", system-ui, sans-serif`
  ctx.fillText(overlay.footer, w / 2, h - h * 0.035)
}

const VIDEO_TYPES = [
  ['video/mp4;codecs=avc1', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm', 'webm'],
] as const

function Scene({ pieces, spin, mobile, reduced, capture, onReady }: Omit<Props, 'active'>) {
  const fx = useRef<MannequinFx>(restingFx())
  const turn = useRef<THREE.Group>(null)
  const sewStart = useRef(-10)
  const recording = useRef<{ start: number; seconds: number; ctx: CanvasRenderingContext2D; overlay: Overlay; onProgress?: (p: number) => void; done: () => void } | null>(null)
  const photoJob = useRef<{ ctx: CanvasRenderingContext2D; overlay: Overlay; done: () => void } | null>(null)
  const { gl, scene, camera } = useThree()
  const looks = useMemo(() => [pieces], [pieces])
  const lookKey = pieces.map((p) => p.key + p.color).join('|')

  // Peça nova: ela "é costurada" de cima para baixo, com o brilho dourado
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!reduced) sewStart.current = performance.now()
  }, [lookKey, reduced])

  useEffect(() => {
    if (!capture) return
    capture.current = {
      photo: (overlay) =>
        new Promise<Blob>((resolve, reject) => {
          const canvas = document.createElement('canvas')
          canvas.width = 1080
          canvas.height = 1350
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Sem canvas'))
          photoJob.current = {
            ctx,
            overlay,
            done: () => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sem imagem'))), 'image/jpeg', 0.92),
          }
        }),
      video: (overlay, seconds, onProgress) =>
        new Promise((resolve, reject) => {
          const type = VIDEO_TYPES.find(([t]) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))
          const canvas = document.createElement('canvas')
          canvas.width = 720
          canvas.height = 1280
          const ctx = canvas.getContext('2d')
          if (!type || !ctx || !('captureStream' in canvas)) return reject(new Error('Este navegador não grava vídeo.'))
          const stream = canvas.captureStream(30)
          const recorder = new MediaRecorder(stream, { mimeType: type[0], videoBitsPerSecond: 4_000_000 })
          const chunks: Blob[] = []
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
          recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: type[0].split(';')[0] }), ext: type[1] })
          recorder.onerror = () => reject(new Error('Não foi possível gravar o vídeo.'))
          recorder.start()
          recording.current = {
            start: performance.now(),
            seconds,
            ctx,
            overlay,
            onProgress,
            done: () => {
              recorder.stop()
              stream.getTracks().forEach((t) => t.stop())
            },
          }
        }),
    }
    return () => {
      capture.current = null
    }
  }, [capture])

  // prioridade 1: este quadro desenha a cena por conta própria e, logo depois, copia a imagem
  // para a foto/vídeo (o canvas WebGL só tem a imagem logo após desenhar)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = spin.current
    const rec = recording.current
    const now = performance.now()
    if (rec) {
      // gravando: uma volta completa, lisinha
      const t = Math.min(1, (now - rec.start) / (rec.seconds * 1000))
      s.angle = 0.35 + t * Math.PI * 2
      rec.onProgress?.(t)
    } else if (!s.dragging) {
      if (s.auto && !reduced) s.angle += dt * 0.32
      s.angle += s.velocity * dt
      s.velocity *= Math.exp(-3.5 * dt)
    }
    if (turn.current) {
      turn.current.rotation.y = rec ? s.angle : THREE.MathUtils.damp(turn.current.rotation.y, s.angle, 8, dt)
      turn.current.position.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9) * 0.02
    }
    const sew = (now - sewStart.current) / 900
    fx.current.sew = sew >= 0 && sew < 1 ? 3.2 - sew * 3.4 : -10

    gl.render(scene, camera)
    if (photoJob.current) {
      drawFrame(photoJob.current.ctx, gl.domElement, photoJob.current.overlay)
      photoJob.current.done()
      photoJob.current = null
    }
    if (rec) {
      drawFrame(rec.ctx, gl.domElement, rec.overlay)
      if (now - rec.start >= rec.seconds * 1000) {
        recording.current = null
        rec.done()
      }
    }
  }, 1)

  return (
    <>
      {/* o manequim desce até o meio da tela (a câmera fica em y = 0, olhando reto) */}
      <group position={[0, -1.72, 0]}>
        <group ref={turn} rotation={[0, 0.35, 0]}>
          <Mannequin looks={looks} fx={fx} detail={mobile ? 0.65 : 1} />
          <SoftShadow />
        </group>
      </group>
      <group position={[0, -1.72, 0]}>
        <GoldDust count={mobile ? 24 : 50} spread={0.8} />
      </group>
      {onReady && <Warmup onReady={onReady} />}
    </>
  )
}

export default function FittingStage({ active, onReady, background = '#161311', ...props }: Props) {
  const [warm, setWarm] = useState(false)
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, 1.5))
  const handleReady = useCallback(() => {
    setWarm(true)
    onReady?.()
  }, [onReady])

  return (
    <Canvas
      // gravando, o quadro precisa continuar mesmo fora da tela
      frameloop={warm && active ? 'always' : 'never'}
      camera={{ position: [0, 0, 10.2], fov: 26 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
      aria-hidden
    >
      <color attach="background" args={[background]} />
      <Glow color="#c9a06a" opacity={0.35} scale={9} position={[0, 0.3, -3]} />
      <Studio envSize={props.mobile ? 128 : 256} />
      <Scene {...props} onReady={handleReady} />
    </Canvas>
  )
}
