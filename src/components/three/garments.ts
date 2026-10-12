import * as THREE from 'three'
import {
  BODY,
  limbLength,
  limbPhi,
  limbPoint,
  limbRadius,
  smoothstep,
  TORSO_BOTTOM,
  torsoPoint,
  wrapGrid,
  type Limb,
} from './body'

// Moldes das roupas do provador 3D. Cada molde é uma receita: partes (tronco, mangas, pernas,
// gola) que seguem o corpo do manequim com uma folga, e recortes (decote, cavas, costas, fenda)
// que o shader do tecido aplica. O nome e a lista dos moldes ficam em src/data/fits.ts.

// Recortes feitos no shader (coordenadas do corpo: y para cima, frente em +z)
export type Mask = {
  neckFront?: [y: number, halfWidth: number, shape: number] // decote: fundo em y; shape 1 = V, 2 = redondo, 5 = quadrado
  neckBack?: [y: number, halfWidth: number, shape: number]
  armhole?: number // raio da cava (peça sem manga)
  shoulderCut?: [x: number, y: number] // alças: tira o ombro além de |x| acima de y
  oneShoulder?: boolean // um ombro só (o coberto é o -x)
  halter?: number // frente única: inclinação do corte dos ombros
  back?: [mode: 1 | 2, y: number, width: number, slope: number] // 1 = costas abertas, 2 = nadador
  slit?: [side: 1 | -1, top: number, angle: number] // fenda lateral
  lace?: boolean // barra de renda
  rib?: number // altura da barra canelada
  placket?: boolean // carcela com botões (camisa)
}

type TorsoPart = {
  kind: 'torso'
  top: number // borda de cima (2.95 = até o pescoço)
  hem: number // altura da barra no meio
  hemSlope?: number // barra assimétrica (positivo: mais comprida no lado -x)
  hemBack?: number // mais comprida atrás
  hemSide?: number // barra curva: mais curta nas laterais
  ease: number // folga em relação ao corpo
  env?: { from: number; k: number; kz?: number } // caimento: abaixo de `from` desce solto e abre k por unidade
  ripples?: [count: number, amount: number] // ondas na barra (godê)
  mask?: Mask
}
type SleevesPart = { kind: 'sleeves'; to: number; ease: number; flare?: number; rib?: number }
type LegsPart = { kind: 'legs'; to: number; ease: number; straightFrom?: number; flare?: number }
type ExtraPart = { kind: 'collar' } | { kind: 'turtleneck' } | { kind: 'ring' }

export type Part = TorsoPart | SleevesPart | LegsPart | ExtraPart

export type FitSpec = { parts: Part[] }

const NECK_TOP = 2.95

// Decotes e cavas mais usados
const CREW = { neckFront: [2.84, 0.14, 2], neckBack: [2.9, 0.12, 2] } satisfies Mask
const TANK = { armhole: 0.135, shoulderCut: [0.245, 2.7] } satisfies Mask

// Parte de baixo: o "assento" (da cintura até o meio das coxas) mais as duas pernas
// o assento desce mais nas laterais (cobre a passagem do quadril para a coxa) e menos no meio (virilha)
const seat = (top: number, ease: number): TorsoPart => ({ kind: 'torso', top, hem: 1.62, hemSide: -0.16, ease, env: { from: 1.8, k: -0.12, kz: -0.2 } })

export const SPECS: Record<string, FitSpec> = {
  // ---------- parte de cima ----------
  regata: {
    parts: [{ kind: 'torso', top: NECK_TOP, hem: 1.86, ease: 0.018, mask: { ...TANK, neckFront: [2.62, 0.17, 2.2], neckBack: [2.78, 0.15, 2] } }],
  },
  cropped: {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 2.24, ease: 0.014, mask: { armhole: 0.14, shoulderCut: [0.215, 2.66], neckFront: [2.56, 0.19, 2.6], neckBack: [2.66, 0.18, 2] } },
    ],
  },
  'top-fitness': {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 2.26,
        ease: 0.01,
        mask: { armhole: 0.15, shoulderCut: [0.225, 2.7], neckFront: [2.58, 0.165, 2], back: [2, 2.3, 0.05, 0.3], rib: 0.055 },
      },
    ],
  },
  'tomara-que-caia': {
    parts: [{ kind: 'torso', top: 2.555, hem: 1.95, ease: 0.014, mask: { armhole: 0.13 } }],
  },
  'ombro-so': {
    parts: [{ kind: 'torso', top: NECK_TOP, hem: 1.9, ease: 0.016, mask: { armhole: 0.13, oneShoulder: true } }, { kind: 'ring' }],
  },
  'frente-unica': {
    parts: [{ kind: 'torso', top: NECK_TOP, hem: 2.14, ease: 0.015, mask: { halter: 0.62, armhole: 0.12, back: [1, 2.22, 0, 0] } }],
  },
  assimetrica: {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 1.96,
        hemSlope: 0.17,
        ease: 0.016,
        env: { from: 2.5, k: 0.06, kz: 0.04 },
        ripples: [7, 0.01],
        mask: { halter: 0.62, armhole: 0.12, back: [1, 2.1, 0, 0], lace: true },
      },
    ],
  },
  'ombro-caido': {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 2.02, ease: 0.03, env: { from: 2.52, k: 0.02 }, mask: { ...CREW, rib: 0.07 } },
      { kind: 'sleeves', to: 0.3, ease: 0.05, flare: 0.06, rib: 0.03 },
    ],
  },
  'manga-curta': {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 1.92, ease: 0.026, env: { from: 2.52, k: 0.015 }, mask: { ...CREW } },
      { kind: 'sleeves', to: 0.36, ease: 0.03, flare: 0.025 },
    ],
  },
  'manga-longa': {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 1.9, ease: 0.022, mask: { ...CREW } },
      { kind: 'sleeves', to: 1, ease: 0.022 },
    ],
  },
  'gola-alta': {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 1.9, ease: 0.02 },
      { kind: 'sleeves', to: 1, ease: 0.02 },
      { kind: 'turtleneck' },
    ],
  },
  camisa: {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 1.74,
        hemSide: 0.09,
        ease: 0.04,
        env: { from: 2.52, k: 0.06, kz: 0.03 },
        mask: { neckFront: [2.6, 0.13, 1.2], neckBack: [2.93, 0.1, 2], placket: true },
      },
      { kind: 'sleeves', to: 0.7, ease: 0.05, flare: 0.012 },
      { kind: 'collar' },
    ],
  },

  // ---------- parte de baixo ----------
  pantalona: { parts: [seat(2.2, 0.022), { kind: 'legs', to: 0.985, ease: 0.026, straightFrom: 0.12, flare: 0.085 }] },
  'calca-reta': { parts: [seat(2.16, 0.017), { kind: 'legs', to: 0.97, ease: 0.018, straightFrom: 0.32 }] },
  legging: { parts: [seat(2.18, 0.008), { kind: 'legs', to: 0.93, ease: 0.008 }] },
  short: { parts: [seat(2.18, 0.026), { kind: 'legs', to: 0.27, ease: 0.03, straightFrom: 0.04, flare: 0.05 }] },
  'short-fitness': { parts: [seat(2.2, 0.009), { kind: 'legs', to: 0.36, ease: 0.009 }] },
  'saia-curta': {
    parts: [{ kind: 'torso', top: 2.16, hem: 1.4, ease: 0.015, env: { from: 1.88, k: 0.12, kz: 0.08 }, ripples: [9, 0.012] }],
  },
  'saia-short': {
    parts: [
      { kind: 'torso', top: 2.2, hem: 1.44, ease: 0.01, env: { from: 1.86, k: 0.36, kz: 0.26 }, ripples: [11, 0.02] },
      seat(2.1, 0.008),
      { kind: 'legs', to: 0.22, ease: 0.008 },
    ],
  },
  'saia-midi': {
    parts: [{ kind: 'torso', top: 2.16, hem: 0.74, ease: 0.015, env: { from: 1.88, k: 0.085, kz: 0.06 }, ripples: [10, 0.016] }],
  },
  'saia-longa': {
    parts: [{ kind: 'torso', top: 2.16, hem: 0.2, ease: 0.015, env: { from: 1.88, k: 0.09, kz: 0.07 }, ripples: [12, 0.02] }],
  },

  // ---------- peça inteira ----------
  'vestido-curto': {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 1.3,
        ease: 0.014,
        env: { from: 1.88, k: -0.02, kz: -0.01 },
        mask: { armhole: 0.13, shoulderCut: [0.255, 2.72], neckFront: [2.66, 0.16, 2], neckBack: [2.8, 0.14, 2] },
      },
    ],
  },
  'vestido-trapezio': {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 1.28,
        ease: 0.02,
        env: { from: 2.52, k: 0.15, kz: 0.1 },
        ripples: [9, 0.015],
        mask: { halter: 0.62, armhole: 0.12, back: [1, 2.3, 0, 0] },
      },
    ],
  },
  'vestido-midi': {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 0.75,
        ease: 0.014,
        env: { from: 1.94, k: 0.07, kz: 0.05 },
        ripples: [10, 0.015],
        mask: { armhole: 0.14, shoulderCut: [0.21, 2.66], neckFront: [2.6, 0.17, 1.3], neckBack: [2.6, 0.17, 2] },
      },
    ],
  },
  'vestido-longo': {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 0.22,
        ease: 0.014,
        env: { from: 1.88, k: 0.035, kz: 0.03 },
        mask: { neckFront: [2.8, 0.15, 2], neckBack: [2.85, 0.13, 2], slit: [1, 0.95, 0.12] },
      },
      { kind: 'sleeves', to: 0.2, ease: 0.02 },
    ],
  },
  chemise: {
    parts: [
      {
        kind: 'torso',
        top: NECK_TOP,
        hem: 1.18,
        hemSide: 0.06,
        ease: 0.035,
        env: { from: 2.52, k: 0.1, kz: 0.06 },
        ripples: [8, 0.01],
        mask: { neckFront: [2.6, 0.13, 1.2], neckBack: [2.93, 0.1, 2], placket: true },
      },
      { kind: 'sleeves', to: 0.45, ease: 0.045, flare: 0.015 },
      { kind: 'collar' },
    ],
  },
  macacao: {
    parts: [
      { kind: 'torso', top: NECK_TOP, hem: 1.5, ease: 0.02, mask: { armhole: 0.135, shoulderCut: [0.25, 2.72], neckFront: [2.6, 0.16, 1.6], neckBack: [2.76, 0.15, 2] } },
      { kind: 'legs', to: 0.985, ease: 0.024, straightFrom: 0.12, flare: 0.07 },
    ],
  },
}

// ---------- Geração das malhas ----------

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + (h * h * k) / 4
}

const tmp = new THREE.Vector3()

// Estado de cada coluna da roupa, de cima para baixo: direção e o "ponto mais largo" de onde o tecido cai
type Column = { dirX: number; dirZ: number; hang: number; last: number }

// Ponto de uma roupa no tronco: segue o corpo com folga e, abaixo de `env.from`, cai solta a partir
// da parte mais larga que veio acima (busto, quadril), abrindo `env.k` por unidade
function clothPoint(part: TorsoPart, col: Column, theta: number, y: number, ramp: number, out: THREE.Vector3) {
  const hasBody = y > TORSO_BOTTOM + 0.06
  let bodyD = 0
  if (hasBody) {
    torsoPoint(theta, y, part.ease, true, tmp)
    bodyD = Math.hypot(tmp.x, tmp.z)
    col.dirX = tmp.x / bodyD
    col.dirZ = tmp.z / bodyD
  }
  const env = part.env
  let d = bodyD
  if (env && y < env.from) {
    const drop = env.from - y
    // abre mais para os lados (k) ou para a frente/trás (kz), conforme a direção da coluna
    const k = env.k * col.dirX * col.dirX + (env.kz ?? env.k) * col.dirZ * col.dirZ
    col.hang = Math.max(col.hang + k * (col.last - y), hasBody ? bodyD : 0)
    d = hasBody ? bodyD + (smax(bodyD, col.hang, 0.06) - bodyD) * smoothstep(0, 0.1, drop) : col.hang
  } else if (hasBody) {
    col.hang = bodyD
  }
  col.last = y
  if (part.ripples) d += part.ripples[1] * Math.sin(theta * part.ripples[0] + 0.6) * ramp
  return out.set(col.dirX * d, y, col.dirZ * d)
}

// Coordenadas do tecido: x em volta (unidades da cena), y = distância até a barra (para a barra de
// renda, a canelada e as estampas seguirem a peça)
function fabricCoords(geometry: THREE.BufferGeometry, cols: number, rows: number, around: number) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const fab = new Float32Array(pos.count * 2)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let c = 0; c <= cols; c++) {
    let dist = 0
    for (let r = rows; r >= 0; r--) {
      const i = r * (cols + 1) + c
      if (r < rows) {
        a.fromBufferAttribute(pos, i)
        b.fromBufferAttribute(pos, i + cols + 1)
        dist += a.distanceTo(b)
      }
      fab[i * 2] = (c / cols - 0.5) * around
      fab[i * 2 + 1] = dist
    }
  }
  geometry.setAttribute('aFab', new THREE.BufferAttribute(fab, 2))
  return geometry
}

function torsoGarment(part: TorsoPart, detail: number) {
  const hemAt = (theta: number) => {
    const s = Math.sin(theta)
    const c = Math.cos(theta)
    return part.hem - (part.hemSlope ?? 0) * s - (part.hemBack ?? 0) * Math.max(0, -c) + (part.hemSide ?? 0) * s * s
  }
  const cols = Math.round(96 * detail)
  const span = part.top - (part.hem - Math.abs(part.hemSlope ?? 0) - (part.hemBack ?? 0))
  const rows = Math.max(14, Math.min(120, Math.round((span / 0.024) * detail)))
  const from = part.env?.from ?? part.top
  // a grade é gerada linha por linha, de cima para baixo: cada coluna guarda o seu estado
  const columns: Column[] = Array.from({ length: cols + 1 }, () => ({ dirX: 0, dirZ: 1, hang: 0, last: part.top }))
  const geometry = wrapGrid(cols, rows, (u, v, out) => {
    const theta = Math.PI + u * Math.PI * 2
    const hem = hemAt(theta)
    const y = part.top - v * (part.top - hem)
    const ramp = part.ripples ? smoothstep(0, 1, (from - y) / Math.max(0.1, from - hem)) : 0
    clothPoint(part, columns[Math.round(u * cols)], theta, y, ramp, out)
  })
  return fabricCoords(geometry, cols, rows, Math.PI * 2 * 0.32)
}

function limbGarment(limb: Limb, from: number, to: number, radius: (t: number, phi: number) => number, detail: number, around: number) {
  const cols = Math.max(14, Math.round(36 * detail))
  const rows = Math.max(8, Math.round(((to - from) * limbLength(limb)) / 0.03 * detail))
  const geometry = wrapGrid(cols, rows, (u, v, out) => {
    const t = from + (to - from) * v
    const phi = limbPhi(u)
    limbPoint(limb, t, phi, radius(t, phi), out)
  })
  return fabricCoords(geometry, cols, rows, around)
}

function sleeves(part: SleevesPart, detail: number) {
  return BODY.arms.map((arm) =>
    limbGarment(arm, 0, part.to, (t) => limbRadius(arm, t) + part.ease + (part.flare ?? 0) * smoothstep(0.1, part.to, t), detail, Math.PI * 2 * 0.1),
  )
}

function legs(part: LegsPart, detail: number) {
  return BODY.legs.map((leg, i) => {
    const side = i === 0 ? -1 : 1
    const start = part.straightFrom
    const straight = start === undefined ? 0 : limbRadius(leg, start) + part.ease
    return limbGarment(
      leg,
      0,
      part.to,
      (t, phi) => {
        // gancho: o lado de dentro das pernas, lá em cima, encosta na outra perna e fecha a virilha
        const inward = Math.max(0, side * Math.sin(phi))
        const gusset = 0.075 * (1 - smoothstep(0.02, 0.32, t)) * Math.pow(inward, 1.5)
        const fitted = limbRadius(leg, t) + part.ease + gusset
        if (start === undefined || t <= start) return fitted
        return Math.max(fitted, straight + (part.flare ?? 0) * smoothstep(start, 1, t))
      },
      detail,
      Math.PI * 2 * 0.15,
    )
  })
}

// Gola alta: um tubo dobrado em volta do pescoço
function turtleneck(detail: number) {
  const neck = BODY.neck
  return limbGarment(
    neck,
    0,
    0.82,
    (t) => limbRadius(neck, t) + 0.034 + 0.012 * smoothstep(0.62, 0.82, t) + 0.025 * (1 - smoothstep(0, 0.25, t)),
    detail,
    Math.PI * 2 * 0.12,
  )
}

// Gola de camisa: o pé sobe em volta do pescoço e a gola dobra e deita nos ombros; aberta na frente
function collar(detail: number) {
  const cols = Math.round(64 * detail)
  const rows = 12
  const open = 0.42 // abertura da frente (radianos de cada lado)
  const pos: number[] = []
  const fab: number[] = []
  const stand = new THREE.Vector3()
  const lying = new THREE.Vector3()
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const theta = open + (c / cols) * (Math.PI * 2 - open * 2)
      const v = r / rows
      const front = Math.pow(Math.max(0, Math.cos(theta)), 3)
      const radius = 0.106
      if (v <= 0.4) {
        const y = 2.9 + 0.07 * (v / 0.4)
        pos.push(Math.sin(theta) * radius, y, Math.cos(theta) * radius * 0.95)
      } else {
        const w = (v - 0.4) / 0.6
        stand.set(Math.sin(theta) * radius, 2.97, Math.cos(theta) * radius * 0.95)
        // as pontas da gola (na frente) descem mais
        torsoPoint(theta, 2.97 - w * (0.2 + 0.17 * front), 0.035 + 0.03 * (1 - w), true, lying)
        stand.lerp(lying, smoothstep(0, 0.4, w))
        pos.push(stand.x, stand.y, stand.z)
      }
      fab.push((c / cols - 0.5) * 1.2, v * 0.22)
    }
  }
  const index: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c
      index.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('aFab', new THREE.Float32BufferAttribute(fab, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

// Argola dourada no ombro (blusa ombro só): posição e direção na frente da alça
export function ringPlacement() {
  const position = torsoPoint(-0.62, 2.74, 0.03, true, new THREE.Vector3())
  const normal = new THREE.Vector3(position.x, 0, position.z).normalize()
  return { position: position.addScaledVector(normal, 0.012), normal }
}

export type GarmentMesh = {
  geometry: THREE.BufferGeometry
  mask: Mask
  kind: Part['kind']
  rib?: number
}

const cache = new Map<string, GarmentMesh[]>()

// Malhas de um molde (guardadas: cada molde é gerado uma vez só por nível de detalhe)
export function garmentMeshes(fit: string, detail: number): GarmentMesh[] {
  const key = `${fit}:${detail}`
  const hit = cache.get(key)
  if (hit) return hit
  const spec = SPECS[fit]
  if (!spec) return []
  const out: GarmentMesh[] = []
  for (const part of spec.parts) {
    if (part.kind === 'torso') out.push({ geometry: torsoGarment(part, detail), mask: part.mask ?? {}, kind: 'torso' })
    else if (part.kind === 'sleeves') for (const g of sleeves(part, detail)) out.push({ geometry: g, mask: { rib: part.rib }, kind: 'sleeves' })
    else if (part.kind === 'legs') for (const g of legs(part, detail)) out.push({ geometry: g, mask: {}, kind: 'legs' })
    else if (part.kind === 'turtleneck') out.push({ geometry: turtleneck(detail), mask: { rib: 0.5 }, kind: 'turtleneck' })
    else if (part.kind === 'collar') out.push({ geometry: collar(detail), mask: {}, kind: 'collar' })
    else if (part.kind === 'ring') out.push({ geometry: new THREE.TorusGeometry(0.042, 0.011, 12, 36), mask: {}, kind: 'ring' })
  }
  cache.set(key, out)
  return out
}
