import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { coverUrl, pieceSource, priceLabel } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { drawTag, TAG_SIZE, tagFontsReady } from '../../lib/tagArt'
import { RACK_SPACING, type RackMotion } from './shared'
import { Glow, GoldDust, StudioLights } from './Studio'

// Arara 3D do catálogo: as peças ficam penduradas em cabides dourados num varão.
// Arrastar (ou as setas) move a arara; os cabides balançam com o movimento.
// O cartão é a foto da peça (com modelo); sem ela, a foto da peça sozinha num papel, ou o nome da peça.
// No celular a cena é mais leve: resolução 1x, sem antisserrilhado, menos cartões montados e sem as partículas.

const SPACING = RACK_SPACING
const CARD = { w: 1.1, h: 1.375 }
const RAIL_Y = 1.2
const WINDOW = { desktop: 8, mobile: 4 } // quantos cartões de cada lado do centro ficam montados

type Props = {
  products: Product[]
  motion: React.MutableRefObject<RackMotion>
  onSelect: (product: Product) => void
  active: boolean
  mobile: boolean
  reduced: boolean
  showPrices: boolean
}

// ---------- Peças compartilhadas ----------

const gold = new THREE.MeshStandardMaterial({ color: '#d9b77e', metalness: 1, roughness: 0.25 })
const paper = new THREE.MeshStandardMaterial({ color: '#f6efe6', roughness: 0.85 })
const string = new THREE.MeshBasicMaterial({ color: '#c9a46c' })

function hangerGeometry() {
  const r = 0.011
  const hook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.97, 0),
    new THREE.Vector3(0, 1.08, 0.01),
    new THREE.Vector3(0, RAIL_Y - 0.02, 0.06),
    new THREE.Vector3(0, RAIL_Y + 0.055, 0.0),
    new THREE.Vector3(0, RAIL_Y + 0.0, -0.055),
    new THREE.Vector3(0, RAIL_Y - 0.06, -0.04),
  ])
  const shoulders = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.56, 0.82, 0),
      new THREE.Vector3(-0.3, 0.9, 0),
      new THREE.Vector3(0, 0.97, 0),
      new THREE.Vector3(0.3, 0.9, 0),
      new THREE.Vector3(0.56, 0.82, 0),
    ],
    false,
    'catmullrom',
    0.1,
  )
  const bar = new THREE.LineCurve3(new THREE.Vector3(-0.56, 0.82, 0), new THREE.Vector3(0.56, 0.82, 0))
  const parts: THREE.BufferGeometry[] = [
    new THREE.TubeGeometry(hook, 40, r, 8),
    new THREE.TubeGeometry(shoulders, 40, r * 1.2, 8),
    new THREE.TubeGeometry(bar, 4, r, 8),
    new THREE.SphereGeometry(r * 1.6, 8, 8).translate(0, RAIL_Y - 0.06, -0.04),
  ]
  // prendedores do cartão
  for (const x of [-0.4, 0.4]) parts.push(new THREE.BoxGeometry(0.07, 0.07, 0.03).translate(x, 0.81, 0.012))
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))
}

// Cartão levemente curvado, como papel fotográfico pendurado
function cardGeometry(w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h, 16, 1)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2)
    pos.setZ(i, -0.035 * x * x)
  }
  g.computeVertexNormals()
  return g
}

const geometries = {
  hanger: hangerGeometry(),
  frame: cardGeometry(CARD.w, CARD.h),
  photo: cardGeometry(CARD.w - 0.07, CARD.h - 0.07),
  tag: new THREE.PlaneGeometry(0.9, 0.506),
  string: new THREE.CylinderGeometry(0.003, 0.003, 0.16, 4),
}

// ---------- Texturas ----------

const photoCache = new Map<string, Promise<THREE.Texture>>()

// Se a foto falhar (rede instável), tenta de novo duas vezes antes de desistir
function loadPhoto(url: string) {
  let hit = photoCache.get(url)
  if (!hit) {
    const attempt = (n: number): Promise<THREE.Texture> =>
      new THREE.TextureLoader().loadAsync(n ? `${url}&de-novo=${n}` : url).catch((err) => {
        if (n >= 2) throw err
        return new Promise<THREE.Texture>((resolve) => setTimeout(() => resolve(attempt(n + 1)), 1200 * (n + 1)))
      })
    hit = attempt(0).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    })
    hit.catch(() => photoCache.delete(url))
    photoCache.set(url, hit)
  }
  return hit
}

// Recorta a foto para o formato do cartão (como object-fit: cover)
function coverFit(texture: THREE.Texture, width: number, height: number) {
  const aspect = (CARD.w - 0.07) / (CARD.h - 0.07)
  const image = width / height
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  if (image > aspect) {
    texture.repeat.x = aspect / image
    texture.offset.x = (1 - texture.repeat.x) / 2
  } else {
    texture.repeat.y = image / aspect
    texture.offset.y = (1 - texture.repeat.y) / 2
  }
}

// Peça sem foto com modelo: a foto da peça sozinha pousada num papel cor de linho (ou só o nome)
async function paperCard(product: Product) {
  const canvas = document.createElement('canvas')
  canvas.width = 440
  canvas.height = 550
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bg.addColorStop(0, '#f3ebe0')
  bg.addColorStop(1, '#e2d5c4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const piece = pieceSource(product, 0)
  if (piece.kind === 'piece') {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = piece.url
    })
    const pad = piece.cutout ? 36 : 28
    const s = piece.cutout
      ? Math.min((canvas.width - pad * 2) / img.width, (canvas.height - pad * 2) / img.height)
      : Math.max((canvas.width - pad * 2) / img.width, (canvas.height - pad * 2) / img.height)
    const w = img.width * s
    const h = img.height * s
    ctx.save()
    if (!piece.cutout) {
      ctx.beginPath()
      ctx.rect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2)
      ctx.clip()
    }
    ctx.shadowColor = 'rgba(60, 40, 20, 0.3)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 14
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
    ctx.restore()
  } else {
    await tagFontsReady()
    ctx.fillStyle = product.colors[0]?.hex ?? '#d6bf9f'
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 90, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2a1d16'
    ctx.textAlign = 'center'
    ctx.font = '600 40px "Cormorant Garamond Variable", Georgia, serif'
    ctx.fillText(product.name.length > 24 ? `${product.name.slice(0, 23)}…` : product.name, canvas.width / 2, canvas.height / 2 + 110)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function usePhoto(product: Product) {
  const url = coverUrl(product, 'thumb')
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    const ready = url
      ? loadPhoto(url).then((t) => {
          const photo = product.photos[0]
          const copy = t.clone()
          coverFit(copy, photo.width, photo.height)
          copy.needsUpdate = true
          return copy
        })
      : paperCard(product)
    ready.then((t) => !cancelled && setTexture(t)).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [url, product])
  return texture
}

function useTag(product: Product, showPrices: boolean) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = TAG_SIZE.width
    canvas.height = TAG_SIZE.height
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => {
    let cancelled = false
    tagFontsReady().then(() => {
      if (cancelled) return
      drawTag(texture.image as HTMLCanvasElement, {
        name: product.name,
        price: showPrices ? priceLabel(product) : '',
        isNew: product.isNew,
        soldOut: product.soldOut,
        colors: product.colors.map((c) => c.hex),
      })
      texture.needsUpdate = true
    })
    return () => {
      cancelled = true
    }
  }, [texture, product, showPrices])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

// ---------- Cartão ----------

const Card = memo(function Card({
  product,
  index,
  motion,
  onSelect,
  showPrices,
  reduced,
}: {
  product: Product
  index: number
  motion: React.MutableRefObject<RackMotion>
  onSelect: (p: Product) => void
  showPrices: boolean
  reduced: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const swing = useRef({ angle: 0, velocity: 0, lift: 0, hover: false })
  const photo = usePhoto(product)
  const tag = useTag(product, showPrices)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const m = motion.current
    const s = swing.current
    // posição na arara (o varão é levemente curvo: as pontas ficam mais ao fundo)
    const x = index * SPACING - m.current
    g.position.set(x, 0, -0.07 * x * x)
    g.rotation.y = Math.atan(0.14 * x) * 0.9
    // balanço: mola + amortecimento, empurrado pela velocidade da arara
    const push = reduced ? 0 : -m.velocity * 0.11
    s.velocity += (-26 * s.angle - 3.2 * s.velocity + push) * dt
    s.angle += s.velocity * dt
    s.angle = THREE.MathUtils.clamp(s.angle, -0.5, 0.5)
    const idle = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9 + index * 1.7) * 0.012
    g.rotation.z = s.angle + idle
    s.lift = THREE.MathUtils.damp(s.lift, s.hover ? 1 : 0, 8, dt)
    g.children[0].position.set(0, s.lift * 0.05, s.lift * 0.18)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    swing.current.hover = true
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    swing.current.hover = false
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!motion.current.dragged) onSelect(product)
  }

  return (
    // o grupo gira em volta do gancho (no varão)
    <group ref={group}>
      <group>
        {/* o cabide e o cartão são desenhados com o varão em y = RAIL_Y; o gancho fica no centro do giro */}
        <group position={[0, -RAIL_Y, 0]}>
          <mesh geometry={geometries.hanger} material={gold} />
          <group position={[0, 0.82 - CARD.h / 2, 0]}>
            <mesh geometry={geometries.frame} material={paper} onPointerOver={over} onPointerOut={out} onClick={click} />
            <mesh geometry={geometries.photo} position={[0, 0, 0.004]} onPointerOver={over} onPointerOut={out} onClick={click}>
              {/* `key`: quando a foto chega o material é refeito (o shader muda: passa a ter textura) */}
              <meshStandardMaterial key={photo ? 'foto' : 'sem-foto'} map={photo} color={photo ? '#ffffff' : '#d9cbb8'} roughness={0.55} />
            </mesh>
            {/* etiqueta pendurada no canto do cartão */}
            <group position={[0.3, -CARD.h / 2 - 0.02, 0.03]} rotation={[0, 0, 0.07]}>
              <mesh geometry={geometries.string} material={string} position={[0, -0.06, 0]} />
              <mesh geometry={geometries.tag} position={[0, -0.385, 0.005]} onPointerOver={over} onPointerOut={out} onClick={click}>
                <meshStandardMaterial map={tag} roughness={0.9} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
})

// ---------- Cena ----------

function Rack({ products, motion, onSelect, mobile, reduced, showPrices }: Omit<Props, 'active'>) {
  const [center, setCenter] = useState(0)
  const reach = mobile ? WINDOW.mobile : WINDOW.desktop

  useFrame((_, delta) => {
    const m = motion.current
    const dt = Math.min(delta, 0.05)
    const max = Math.max(0, (products.length - 1) * SPACING)
    if (!m.dragging) m.target = THREE.MathUtils.clamp(m.target, 0, max)
    const before = m.current
    m.current = THREE.MathUtils.damp(m.current, m.target, reduced ? 20 : 6, dt)
    m.velocity = THREE.MathUtils.damp(m.velocity, (m.current - before) / Math.max(dt, 1e-3), 10, dt)
    // monta só os cartões perto do centro (catálogos grandes continuam leves)
    const c = Math.round(m.current / SPACING)
    if (c !== center) setCenter(c)
  })

  const from = Math.max(0, center - reach)
  const visible = products.slice(from, center + reach + 1)
  const length = Math.max(1, products.length - 1) * SPACING + SPACING * 2

  return (
    <>
      <RailBar length={length} motion={motion} />
      {visible.map((p, i) => (
        <Card key={p.id} product={p} index={from + i} motion={motion} onSelect={onSelect} showPrices={showPrices} reduced={reduced} />
      ))}
      {!mobile && <GoldDust count={60} spread={1.4} />}
    </>
  )
}

// O varão dourado, com os pés nas pontas
function RailBar({ length, motion }: { length: number; motion: React.MutableRefObject<RackMotion> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.x = -SPACING - motion.current.current
  })
  return (
    <group ref={group}>
      <mesh material={gold} position={[length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, length, 16]} />
      </mesh>
      {[0, length].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={gold}>
            <sphereGeometry args={[0.05, 16, 12]} />
          </mesh>
          <mesh material={gold} position={[0, -1.6, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 3.2, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function RackStage({ active, ...props }: Props) {
  const { mobile } = props
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5))
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      camera={{ position: [0, 0.05, mobile ? 4.4 : 5.6], fov: mobile ? 42 : 34 }}
      gl={{ antialias: !mobile, alpha: false, powerPreference: mobile ? 'low-power' : 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      aria-hidden
    >
      <color attach="background" args={['#120f0d']} />
      <fog attach="fog" args={['#120f0d', 6, 13]} />
      <Glow color="#c9a06a" opacity={0.3} scale={14} position={[0, 0.2, -3]} />
      <StudioLights />
      <group position={[0, 0.88, 0]}>
        <Rack {...props} />
      </group>
    </Canvas>
  )
}
