import { PerspectiveCamera, RenderTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { coverUrl, priceLabel, wornPieces } from '../../lib/products'
import type { Product } from '../../lib/siteTypes'
import { drawTag, TAG_SIZE, tagFontsReady } from '../../lib/tagArt'
import { Mannequin } from './Mannequin'
import { RACK_SPACING, type RackMotion } from './shared'
import { Glow, GoldDust, makeStudioEnvironment, SharedEnvironment, SoftShadow, StudioLights } from './Studio'

// Arara 3D do catálogo: as peças ficam penduradas em cabides dourados num varão.
// Arrastar (ou as setas) move a arara; os cabides balançam com o movimento.
// Peça com foto: a foto vira o cartão. Sem foto: o cartão é o manequim vestido com a peça.

const SPACING = RACK_SPACING
const CARD = { w: 1.1, h: 1.375 }
const RAIL_Y = 1.2
const WINDOW = 9 // quantos cartões de cada lado do centro ficam montados

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
  tag: new THREE.PlaneGeometry(0.5, 0.28),
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

function usePhoto(product: Product) {
  const url = coverUrl(product, 'thumb')
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    loadPhoto(url)
      .then((t) => {
        if (cancelled) return
        const photo = product.photos[0]
        const copy = t.clone()
        coverFit(copy, photo.width, photo.height)
        copy.needsUpdate = true
        setTexture(copy)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [url, product.photos])
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

// Foto do manequim vestido com a peça (renderizada uma vez numa textura)
function MannequinShot({ product, env }: { product: Product; env: THREE.Texture | null }) {
  const looks = useMemo(() => [wornPieces(product, 0)], [product])
  return (
    <RenderTexture attach="map" width={384} height={480} frames={3}>
      {/* `manual`: o formato da câmera é o do cartão, e não o da tela */}
      <PerspectiveCamera makeDefault manual aspect={384 / 480} position={[0, 1.74, 9.2]} fov={22} />
      <color attach="background" args={['#ece2d6']} />
      <SharedEnvironment texture={env} />
      <StudioLights />
      <Glow color="#ffffff" opacity={0.7} scale={7} position={[0, 2, -2]} />
      <group rotation={[0, 0.35, 0]}>
        <Mannequin looks={looks} detail={0.5} pedestal={false} />
      </group>
      <SoftShadow opacity={0.35} />
    </RenderTexture>
  )
}

const Card = memo(function Card({
  product,
  index,
  motion,
  onSelect,
  env,
  showPrices,
  reduced,
}: {
  product: Product
  index: number
  motion: React.MutableRefObject<RackMotion>
  onSelect: (p: Product) => void
  env: THREE.Texture | null
  showPrices: boolean
  reduced: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const swing = useRef({ angle: 0, velocity: 0, lift: 0, hover: false })
  const photo = usePhoto(product)
  const tag = useTag(product, showPrices)
  const hasPhoto = product.photos.length > 0

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
              {hasPhoto ? (
                // `key`: quando a foto chega o material é refeito (o shader muda: passa a ter textura)
                <meshStandardMaterial key={photo ? 'foto' : 'sem-foto'} map={photo} color={photo ? '#ffffff' : '#d9cbb8'} roughness={0.55} />
              ) : (
                <meshStandardMaterial roughness={0.6}>
                  <MannequinShot product={product} env={env} />
                </meshStandardMaterial>
              )}
            </mesh>
            {/* etiqueta pendurada no canto do cartão */}
            <group position={[0.36, -CARD.h / 2 - 0.02, 0.02]} rotation={[0, 0, 0.12]}>
              <mesh geometry={geometries.string} material={string} position={[0, -0.06, 0]} />
              <mesh geometry={geometries.tag} position={[0, -0.27, 0.005]} onPointerOver={over} onPointerOut={out} onClick={click}>
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
  const gl = useThree((s) => s.gl)
  const [env] = useState(() => makeStudioEnvironment(gl, 64))
  const [center, setCenter] = useState(0)
  useEffect(() => () => env.dispose(), [env])
  const envTexture = env.texture

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

  const from = Math.max(0, center - WINDOW)
  const visible = products.slice(from, center + WINDOW + 1)
  const length = Math.max(1, products.length - 1) * SPACING + SPACING * 2

  return (
    <>
      <RailBar length={length} motion={motion} />
      {visible.map((p, i) => (
        <Card key={p.id} product={p} index={from + i} motion={motion} onSelect={onSelect} env={envTexture} showPrices={showPrices} reduced={reduced} />
      ))}
      <GoldDust count={mobile ? 30 : 60} spread={1.4} />
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
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, 1.5))
  const { mobile } = props
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      camera={{ position: [0, 0.05, mobile ? 4.4 : 5.6], fov: mobile ? 42 : 34 }}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
      aria-hidden
    >
      <color attach="background" args={['#120f0d']} />
      <fog attach="fog" args={['#120f0d', 6, 13]} />
      <Glow color="#c9a06a" opacity={0.3} scale={14} position={[0, 0.2, -3]} />
      <StudioLights />
      <group position={[0, 0.75, 0]}>
        <Rack {...props} />
      </group>
    </Canvas>
  )
}
