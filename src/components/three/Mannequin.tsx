import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { fitById, type Slot } from '../../data/fits'
import { DEFAULT_SKIN, skinById } from '../../data/skin'
import { BODY, bunGeometry, hairGeometry, headGeometry, limbGeometry, torsoGeometry } from './body'
import { applyFabric, applyMask, createBodyMaterials, createFabricMaterial, fabricUniforms, type BodyPart } from './fabric'
import { garmentMeshes, ringPlacement } from './garments'

// Uma peça vestida no manequim
export type WornPiece = {
  key: string
  fit: string
  color: string
  fabric: string
  swatch?: string // endereço do recorte do tecido (opcional)
}

// Efeitos da abertura, lidos a cada quadro (sem re-render do React)
export type MannequinFx = {
  rise: number // o corpo aparece até esta altura (10 = inteiro)
  sketch: number // 1 = só as linhas douradas do croqui, 0 = corpo pronto
  sew: number // a roupa aparece acima desta altura (-10 = inteira)
  explode: number // 0 a 1: as peças se afastam do corpo
  sweep: number // troca de cor: abaixo desta altura a roupa fica na cor `sweepColor`
  sweepColor: THREE.Color | null
  color: THREE.Color | null // troca a cor de todas as peças (abertura)
  fabric: string | null // troca o tecido de todas as peças (abertura)
  look: number // qual dos looks está vestido
}

export const restingFx = (): MannequinFx => ({ rise: 10, sketch: 0, sew: -10, explode: 0, sweep: -10, sweepColor: null, color: null, fabric: null, look: 0 })

// ---------- Recorte do tecido (textura vinda da foto) ----------

type Swatch = { texture: THREE.Texture; mean: number }
const swatchCache = new Map<string, Promise<Swatch>>()

function loadSwatch(url: string) {
  let hit = swatchCache.get(url)
  if (!hit) {
    hit = new Promise<Swatch>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // brilho médio do recorte: o shader usa só as variações de claro e escuro do tecido
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 16
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        let mean = 0.5
        if (ctx) {
          ctx.drawImage(img, 0, 0, 16, 16)
          const data = ctx.getImageData(0, 0, 16, 16).data
          let sum = 0
          for (let i = 0; i < data.length; i += 4) sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
          mean = sum / (data.length / 4)
        }
        const texture = new THREE.Texture(img)
        texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 4
        texture.needsUpdate = true
        resolve({ texture, mean })
      }
      img.onerror = () => reject(new Error('swatch'))
      img.src = url
    })
    swatchCache.set(url, hit)
  }
  return hit
}

function useSwatch(url: string | undefined) {
  const [swatch, setSwatch] = useState<Swatch | null>(null)
  useEffect(() => {
    if (!url) {
      setSwatch(null)
      return
    }
    let cancelled = false
    loadSwatch(url)
      .then((s) => !cancelled && setSwatch(s))
      .catch(() => !cancelled && setSwatch(null))
    return () => {
      cancelled = true
    }
  }, [url])
  return swatch
}

// ---------- Peça ----------

const ringMaterial = new THREE.MeshStandardMaterial({ color: '#d9b77e', metalness: 1, roughness: 0.22 })

// Para onde cada parte vai na vista "explodida" da abertura
const EXPLODE: Record<Slot, THREE.Vector3> = {
  top: new THREE.Vector3(0.05, 0.2, 0.55),
  bottom: new THREE.Vector3(0, -0.1, 0.32),
  full: new THREE.Vector3(0, 0.05, 0.32),
}

function Piece({ piece, detail, fx }: { piece: WornPiece; detail: number; fx?: MutableRefObject<MannequinFx> }) {
  const meshes = useMemo(() => garmentMeshes(piece.fit, detail), [piece.fit, detail])
  const materials = useMemo(() => meshes.map((m) => (m.kind === 'ring' ? ringMaterial : createFabricMaterial())), [meshes])
  const swatch = useSwatch(piece.swatch)
  const group = useRef<THREE.Group>(null)
  const slot = fitById(piece.fit)?.slot ?? 'top'
  const shownFabric = useRef(piece.fabric)
  const shownColor = useRef(false)
  const ring = useMemo(() => ringPlacement(), [])

  useEffect(() => {
    meshes.forEach((m, i) => {
      const material = materials[i]
      if (material === ringMaterial || !(material instanceof THREE.MeshPhysicalMaterial)) return
      applyMask(material, m.mask, piece.fabric)
      applyFabric(material, piece.color, piece.fabric, swatch)
    })
    shownFabric.current = piece.fabric
  }, [meshes, materials, piece.color, piece.fabric, swatch])

  useEffect(() => () => materials.forEach((m) => m !== ringMaterial && m.dispose()), [materials])

  useFrame(() => {
    const f = fx?.current
    if (!f) return
    const fabric = f.fabric ?? piece.fabric
    materials.forEach((material, i) => {
      if (material === ringMaterial || !(material instanceof THREE.MeshPhysicalMaterial)) return
      if (fabric !== shownFabric.current) {
        applyMask(material, meshes[i].mask, fabric)
        applyFabric(material, piece.color, fabric, f.fabric ? null : swatch)
      }
      if (f.color) material.color.copy(f.color)
      else if (shownColor.current) applyFabric(material, piece.color, fabric, f.fabric ? null : swatch)
      const u = fabricUniforms(material)
      u.uSew.value.set(f.sew, 0.07, f.sew > -5 ? 1 : 0, 0)
      u.uSweep.value.set(f.sweep, f.sweepColor && f.sweep > -5 ? 1 : 0, 0, 0)
      if (f.sweepColor) u.uColor2.value.copy(f.sweepColor)
    })
    shownFabric.current = fabric
    shownColor.current = Boolean(f.color)
    const g = group.current
    if (g) {
      g.position.copy(EXPLODE[slot]).multiplyScalar(f.explode)
      g.scale.setScalar(1 + f.explode * 0.04)
    }
  })

  return (
    <group ref={group}>
      {meshes.map((m, i) =>
        m.kind === 'ring' ? (
          <mesh
            key={i}
            geometry={m.geometry}
            material={materials[i]}
            position={ring.position}
            onUpdate={(self) => self.lookAt(ring.position.clone().add(ring.normal))}
          />
        ) : (
          <mesh key={i} geometry={m.geometry} material={materials[i]} />
        ),
      )}
    </group>
  )
}

// ---------- Manequim ----------

type BodyParts = { geometry: THREE.BufferGeometry; key: string; part: BodyPart }[]

const bodyCache = new Map<string, BodyParts>()

// `human`: rosto esculpido e cabelo; sem isso, a cabeça lisa do manequim de porcelana
function bodyParts(detail: number, human: boolean): BodyParts {
  const id = `${detail}:${human}`
  const hit = bodyCache.get(id)
  if (hit) return hit
  const parts: BodyParts = [
    { key: 'torso', part: 'body', geometry: torsoGeometry(detail) },
    { key: 'head', part: 'face', geometry: headGeometry(detail, human) },
    { key: 'neck', part: 'body', geometry: limbGeometry(BODY.neck, detail, 24, 12) },
    ...BODY.arms.map((a, i) => ({ key: `arm${i}`, part: 'body' as const, geometry: limbGeometry(a, detail, 24, 44) })),
    ...BODY.hands.map((a, i) => ({ key: `hand${i}`, part: 'body' as const, geometry: limbGeometry(a, detail, 18, 16) })),
    ...BODY.legs.map((a, i) => ({ key: `leg${i}`, part: 'body' as const, geometry: limbGeometry(a, detail, 28, 64) })),
    ...BODY.feet.map((a, i) => ({ key: `foot${i}`, part: 'body' as const, geometry: limbGeometry(a, detail, 18, 18) })),
  ]
  if (human) parts.push({ key: 'hair', part: 'hair', geometry: hairGeometry(detail) }, { key: 'bun', part: 'hair', geometry: bunGeometry(detail) })
  bodyCache.set(id, parts)
  return parts
}

// `looks`: um ou mais looks; com `fx`, aparece o de número `fx.look` (os outros ficam prontos e escondidos).
// `skin`: tom de pele (data/skin.ts); "manequim" é a porcelana clássica, sem cabelo.
export function Mannequin({
  looks,
  detail = 1,
  fx,
  skin = DEFAULT_SKIN,
  pedestal = true,
}: {
  looks: WornPiece[][]
  detail?: number
  fx?: MutableRefObject<MannequinFx>
  skin?: string
  pedestal?: boolean
}) {
  const tone = skinById(skin)
  const human = tone.hair !== null
  const parts = useMemo(() => bodyParts(detail, human), [detail, human])
  const materials = useMemo(() => createBodyMaterials(tone), [tone])
  const groups = useRef<(THREE.Group | null)[]>([])
  useEffect(
    () => () => {
      materials.body.dispose()
      materials.face.dispose()
      materials.hair.dispose()
    },
    [materials],
  )

  useFrame(() => {
    const f = fx?.current
    if (!f) return
    materials.uniforms.uRise.value = f.rise
    materials.uniforms.uSketch.value = f.sketch
    groups.current.forEach((g, i) => {
      if (g) g.visible = i === f.look % Math.max(1, looks.length)
    })
  })

  return (
    <group>
      {parts.map((p) => (
        <mesh key={p.key} geometry={p.geometry} material={materials[p.part]} />
      ))}
      {looks.map((pieces, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={i === 0}>
          {pieces.map((piece) => (
            <Piece key={piece.key} piece={piece} detail={detail} fx={fx} />
          ))}
        </group>
      ))}
      {pedestal && <Pedestal />}
    </group>
  )
}

const pedestalMaterial = new THREE.MeshPhysicalMaterial({ color: '#161210', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 })
const goldMaterial = new THREE.MeshStandardMaterial({ color: '#d9b77e', metalness: 1, roughness: 0.28 })

// Base redonda preta com friso dourado
export function Pedestal() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]} material={pedestalMaterial}>
        <cylinderGeometry args={[0.62, 0.66, 0.1, 64]} />
      </mesh>
      <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMaterial}>
        <torusGeometry args={[0.62, 0.008, 8, 96]} />
      </mesh>
    </group>
  )
}
