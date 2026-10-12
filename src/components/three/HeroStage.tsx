import { Html, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { MotionValue } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Mannequin, restingFx, type MannequinFx, type WornPiece } from './Mannequin'
import { GoldDust, Glow, SoftShadow, Studio } from './Studio'
import { Warmup } from './Warmup'

// Marcos do scroll da abertura (0 a 1 ao longo da seção)
export const STORY = {
  explode: [0.1, 0.27],
  fabric: [0.3, 0.5],
  color: [0.53, 0.77],
  spin: [0.8, 0.97],
} as const

// Tecidos e cores que passam pela abertura
export const STORY_FABRICS = ['linho', 'tricot', 'canelado', 'cetim', 'renda'] as const
export const STORY_COLORS = ['#3d2318', '#efe18f', '#c48a84', '#a9533a', '#a8c5e6', '#161414'] as const

const seg = (v: number, a: number, b: number) => THREE.MathUtils.clamp((v - a) / (b - a), 0, 1)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const bell = (t: number) => Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1))

type Props = {
  progress: MotionValue<number>
  looks: WornPiece[][]
  play: boolean
  reduced: boolean
  mobile: boolean
  active?: boolean
  onReady?: () => void
  skin?: string
}

// Anotações escritas à mão na vista "explodida" (presas a pontos do manequim)
const NOTES = [
  { text: 'escolhida a dedo', at: new THREE.Vector3(-0.42, 2.95, 0.3), side: -1 },
  { text: 'tecido que abraça', at: new THREE.Vector3(0.4, 2.35, 0.35), side: 1 },
  { text: 'caimento perfeito', at: new THREE.Vector3(-0.45, 1.25, 0.3), side: -1 },
]

function Director({ progress, looks, play, reduced, mobile, onReady, skin }: Props) {
  const fx = useRef<MannequinFx>({ ...restingFx(), rise: -1, sketch: 1, sew: 3.2 })
  const group = useRef<THREE.Group>(null)
  const spinner = useRef<THREE.Group>(null)
  const start = useRef<number | null>(null)
  const smoothed = useRef(progress.get())
  const mouse = useRef({ x: 0, y: 0 })
  const burst = useRef(0)
  const notes = useRef<(HTMLDivElement | null)[]>([])
  const colorA = useRef(new THREE.Color())
  const colorB = useRef(new THREE.Color())
  const { viewport } = useThree()

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.05)
    const f = fx.current
    const clock = frame.clock.elapsedTime

    // ---------- Construção (automática): croqui dourado → corpo → costura da roupa ----------
    if (play && start.current === null) start.current = clock
    const t = reduced ? 10 : start.current === null ? -1 : clock - start.current
    f.rise = t < 0 ? -1 : -0.2 + easeOut(seg(t, 0.1, 1.5)) * 3.9
    f.sketch = 1 - seg(t, 1.3, 2.3)
    const sewT = seg(t, 2.0, 3.4)
    f.sew = sewT >= 1 ? -10 : 3.15 - inOut(sewT) * 3.3

    // ---------- Scroll ----------
    smoothed.current = THREE.MathUtils.damp(smoothed.current, progress.get(), reduced ? 30 : 12, dt)
    const p = smoothed.current
    const explode = bell(seg(p, ...STORY.explode))
    const fabricT = seg(p, ...STORY.fabric)
    const zoom = inOut(seg(p, STORY.fabric[0] - 0.02, STORY.fabric[0] + 0.05)) * (1 - inOut(seg(p, STORY.fabric[1] - 0.04, STORY.fabric[1] + 0.02)))
    const colorT = seg(p, ...STORY.color) * (STORY_COLORS.length - 1)
    const spinT = seg(p, ...STORY.spin) * Math.max(0, looks.length - 1)

    f.explode = explode
    burst.current = explode
    // 02: o tecido troca enquanto a câmera chega perto
    f.fabric = fabricT > 0 && fabricT < 1 ? STORY_FABRICS[Math.min(STORY_FABRICS.length - 1, Math.floor(fabricT * STORY_FABRICS.length))] : null
    // 03: a cor nova escorre de cima para baixo, uma depois da outra
    if (p > STORY.color[0] - 0.01 && p < STORY.color[1] + 0.02) {
      const i = Math.min(STORY_COLORS.length - 2, Math.floor(colorT))
      const k = colorT >= STORY_COLORS.length - 1 ? 1 : colorT - i
      colorA.current.set(STORY_COLORS[i])
      colorB.current.set(STORY_COLORS[i + 1])
      f.color = colorB.current
      f.sweepColor = colorA.current
      f.sweep = 3.2 - inOut(k) * 3.4
    } else {
      f.color = null
      f.sweepColor = null
      f.sweep = -10
    }
    // 04: a cada volta, um look diferente
    f.look = p < STORY.spin[0] ? 0 : Math.min(looks.length - 1, Math.floor(spinT + 0.5))

    // anotações aparecem com a vista explodida
    notes.current.forEach((el) => {
      if (el) el.style.opacity = String(THREE.MathUtils.clamp((explode - 0.45) * 3, 0, 1))
    })

    // ---------- Posição, giro e flutuação ----------
    const g = group.current
    const sp = spinner.current
    if (!g || !sp) return
    const wide = !mobile && viewport.aspect > 1.15
    // No celular o manequim fica menor e no alto, com o texto embaixo
    const baseScale = wide ? 1 : Math.min(0.5, viewport.width / 4.8)
    const closeScale = baseScale * (wide ? 2.35 : 2.1)
    const scale = THREE.MathUtils.lerp(baseScale, closeScale, zoom)
    const baseX = wide ? 1.75 : 0
    // no celular a cabeça fica perto do topo e o texto ocupa a metade de baixo
    const baseY = wide ? -1.72 : viewport.height / 2 - 0.4 - 3.5 * baseScale
    // de perto: o peito fica na altura do meio da tela
    const closeY = (wide ? 0.15 : 0.6) - 2.35 * closeScale
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, scale, 5, dt))
    g.position.x = THREE.MathUtils.damp(g.position.x, baseX - zoom * (wide ? 0.25 : 0), 4, dt)
    const targetY = THREE.MathUtils.lerp(baseY, closeY, zoom) + (reduced ? 0 : Math.sin(clock * 0.8) * 0.03)
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 4, dt)

    const sway = reduced ? 0 : Math.sin(clock * 0.45) * 0.28 * (1 - explode) * (1 - zoom)
    const spin = Math.PI * 2 * (Math.floor(spinT) + inOut(spinT % 1))
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, sway + mouse.current.x * 0.25 - explode * 0.7 + zoom * 0.35, 3, dt)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, mouse.current.y * 0.04, 3, dt)
    sp.rotation.y = spinT >= looks.length - 1 ? 0 : spin
  })

  return (
    <>
      <group ref={group} position={[mobile ? 0 : 1.75, -1.72, 0]}>
        <group ref={spinner}>
          <Mannequin looks={looks.length ? looks : [[]]} fx={fx} detail={mobile ? 0.6 : 1} skin={skin} />
          <SoftShadow />
          {NOTES.map((note, i) => (
            <Html key={note.text} position={note.at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div
                ref={(el) => void (notes.current[i] = el)}
                style={{ opacity: 0, transform: `translate(${note.side < 0 ? '-100%' : '0'}, -50%)` }}
                className={`flex items-center gap-2 whitespace-nowrap ${note.side < 0 ? 'flex-row-reverse' : ''} ${mobile ? 'hidden' : ''}`}
              >
                <span className="h-px w-10 bg-gold/70" />
                <span className="font-script text-3xl text-gold-soft drop-shadow-[0_2px_8px_rgb(0_0_0/0.8)]">{note.text}</span>
              </div>
            </Html>
          ))}
        </group>
      </group>
      <GoldDust count={mobile ? 50 : 110} burst={burst} />
      {onReady && <Warmup onReady={onReady} />}
    </>
  )
}

export default function HeroStage({ active = true, onReady, ...props }: Props) {
  const { mobile } = props
  // Resolução máxima 1.5x; se o aparelho não aguentar 60 fps, cai para 1x sozinho
  const [cap] = useState(() => Math.min(window.devicePixelRatio || 1, 1.5))
  const [dpr, setDpr] = useState(cap)
  const [warm, setWarm] = useState(false)
  const handleReady = useCallback(() => {
    setWarm(true)
    onReady?.()
  }, [onReady])

  return (
    <Canvas
      frameloop={warm && active ? 'always' : 'never'}
      camera={{ position: [0, 0.15, 9.6], fov: 30 }}
      dpr={dpr}
      gl={{ antialias: !mobile, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(cap)} onFallback={() => setDpr(1)} flipflops={3} />
      <color attach="background" args={['#0e0c0b']} />
      <Glow color="#c9a06a" opacity={0.42} scale={12} position={[mobile ? 0 : 1.8, 0.2, -3]} />
      <Studio envSize={mobile ? 128 : 256} />
      <Director {...props} onReady={handleReady} />
    </Canvas>
  )
}
