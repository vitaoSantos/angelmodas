import * as THREE from 'three'

// O manequim de vitrine, todo feito em código (sem modelo pronto).
// Unidades da cena: o manequim tem 3,5 de altura, com o chão em y = 0 e o rosto virado para +z.
// As roupas (garments.ts) usam as mesmas superfícies do corpo, afastadas um pouquinho.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const gauss = (t: number) => Math.exp(-t * t)

// ---------- Perfil do tronco ----------
// [altura, meia largura, profundidade na frente, profundidade atrás]
type Ring = [number, number, number, number]
const TORSO: Ring[] = [
  [2.94, 0.088, 0.085, 0.085], // base do pescoço
  [2.9, 0.15, 0.1, 0.105],
  [2.85, 0.25, 0.13, 0.145],
  [2.78, 0.325, 0.155, 0.17], // ombros
  [2.68, 0.335, 0.17, 0.18],
  [2.58, 0.305, 0.18, 0.18], // axilas
  [2.46, 0.29, 0.19, 0.17], // busto (o volume do busto entra à parte)
  [2.3, 0.268, 0.168, 0.155],
  [2.13, 0.24, 0.15, 0.142], // cintura
  [1.96, 0.28, 0.155, 0.168],
  [1.8, 0.33, 0.165, 0.215], // quadril
  [1.68, 0.325, 0.16, 0.2],
  [1.6, 0.29, 0.135, 0.16],
  [1.54, 0.13, 0.06, 0.06], // fundo (escondido pelas coxas)
]
export const TORSO_TOP = TORSO[0][0]
export const TORSO_BOTTOM = TORSO[TORSO.length - 1][0]

export const LEVELS = { neck: 2.94, shoulder: 2.78, armpit: 2.58, bust: 2.46, underBust: 2.3, waist: 2.13, highHip: 1.96, hip: 1.8, crotch: 1.58, knee: 0.96, ankle: 0.15 }

const BUST = { y: 2.47, h: 0.1, x: 0.1, w: 0.075, amount: 0.07 }
const GLUTES = { y: 1.82, h: 0.13, x: 0.12, w: 0.11, amount: 0.045 }

// Interpolação suave entre os anéis (Hermite com tangentes de Catmull-Rom)
function sampleProfile(y: number, column: 1 | 2 | 3) {
  const n = TORSO.length
  if (y >= TORSO[0][0]) return TORSO[0][column]
  if (y <= TORSO[n - 1][0]) return TORSO[n - 1][column]
  let i = 0
  while (i < n - 2 && TORSO[i + 1][0] > y) i++
  const y0 = TORSO[i][0]
  const y1 = TORSO[i + 1][0]
  const t = (y0 - y) / (y0 - y1)
  const v = (k: number) => TORSO[Math.min(n - 1, Math.max(0, k))]
  const p0 = v(i)[column]
  const p1 = v(i + 1)[column]
  const slope = (a: number, b: number) => (v(b)[column] - v(a)[column]) / Math.max(1e-6, v(a)[0] - v(b)[0])
  const m0 = (i > 0 ? slope(i - 1, i + 1) : slope(i, i + 1)) * (y0 - y1)
  const m1 = (i + 2 < n ? slope(i, i + 2) : slope(i, i + 1)) * (y0 - y1)
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1
}

export function profile(y: number) {
  return { rx: sampleProfile(y, 1), front: sampleProfile(y, 2), back: sampleProfile(y, 3) }
}

// Superelipse: o tronco fica levemente "quadrado", como o de verdade
const SQ = 2.3
const se = (c: number) => Math.sign(c) * Math.pow(Math.abs(c), 2 / SQ)

// Volume do busto e do bumbum. No corpo são dois volumes; no tecido, ele "estica" entre eles (tenda).
function bustAt(x: number, y: number, cloth: boolean) {
  const v = gauss((y - BUST.y) / BUST.h) * BUST.amount
  if (v < 1e-4) return 0
  const ax = Math.abs(x)
  if (cloth) return v * (ax < BUST.x ? 1 : gauss((ax - BUST.x) / (BUST.w * 1.15)))
  return v * (gauss((x - BUST.x) / BUST.w) + gauss((x + BUST.x) / BUST.w))
}

function glutesAt(x: number, y: number, cloth: boolean) {
  const v = gauss((y - GLUTES.y) / GLUTES.h) * GLUTES.amount
  if (v < 1e-4) return 0
  const ax = Math.abs(x)
  if (cloth) return v * (ax < GLUTES.x ? 1 : gauss((ax - GLUTES.x) / GLUTES.w))
  return v * (gauss((x - GLUTES.x) / GLUTES.w) + gauss((x + GLUTES.x) / GLUTES.w))
}

// Ponto da superfície do tronco no ângulo `theta` (0 = frente, π/2 = lado +x) e altura `y`,
// afastado `ease` do corpo (roupa). `cloth` usa o volume do busto em "tenda".
export function torsoPoint(theta: number, y: number, ease: number, cloth: boolean, out: THREE.Vector3) {
  const p = profile(y)
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const rz = p.back + (p.front - p.back) * smoothstep(-0.35, 0.35, c)
  const x = (p.rx + ease) * se(s)
  let z = (rz + ease) * se(c)
  if (c > 0) z += bustAt(x, y, cloth) * smoothstep(0, 0.6, c)
  else z -= glutesAt(x, y, cloth) * smoothstep(0, 0.6, -c)
  return out.set(x, y, z)
}

// Volume extra na frente (busto em tenda) numa altura: usado pelo caimento das roupas soltas
export const bustTent = (y: number) => gauss((y - BUST.y) / BUST.h) * BUST.amount

// ---------- Braços, pernas, pescoço e pés ----------

export type Limb = {
  curve: THREE.CatmullRomCurve3
  radius: [number, number][] // [t, raio] ao longo do caminho (t de 0 a 1)
  flatten?: number // achata a seção (mão e pé)
  up?: THREE.Vector3 // referência da "frente" da seção
  frames: { p: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3 }[]
}

const FRAME_STEPS = 96

function makeLimb(points: [number, number, number][], radius: [number, number][], opts: { flatten?: number; up?: THREE.Vector3 } = {}): Limb {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  )
  const up = opts.up ?? new THREE.Vector3(0, 0, 1)
  // Referenciais que acompanham o caminho sem torcer (transporte paralelo)
  const frames: Limb['frames'] = []
  let n = new THREE.Vector3()
  for (let i = 0; i <= FRAME_STEPS; i++) {
    const u = i / FRAME_STEPS
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u).normalize()
    if (i === 0) n = up.clone().sub(t.clone().multiplyScalar(up.dot(t))).normalize()
    else n.sub(t.clone().multiplyScalar(n.dot(t))).normalize()
    const b = new THREE.Vector3().crossVectors(t, n).normalize()
    frames.push({ p, n: n.clone(), b })
  }
  return { curve, radius, flatten: opts.flatten, up, frames }
}

export function limbRadius(limb: Limb, t: number) {
  const r = limb.radius
  if (t <= r[0][0]) return r[0][1]
  for (let i = 1; i < r.length; i++) {
    if (t <= r[i][0]) {
      const k = smoothstep(0, 1, (t - r[i - 1][0]) / (r[i][0] - r[i - 1][0]))
      return r[i - 1][1] + (r[i][1] - r[i - 1][1]) * k
    }
  }
  return r[r.length - 1][1]
}

const tmpN = new THREE.Vector3()
const tmpB = new THREE.Vector3()

// Ponto na superfície de um membro: `t` ao longo (0 a 1), `phi` em volta (0 = frente), raio dado
export function limbPoint(limb: Limb, t: number, phi: number, radius: number, out: THREE.Vector3) {
  const f = Math.min(FRAME_STEPS, Math.max(0, t * FRAME_STEPS))
  const i = Math.min(FRAME_STEPS - 1, Math.floor(f))
  const k = f - i
  const a = limb.frames[i]
  const b = limb.frames[i + 1]
  out.lerpVectors(a.p, b.p, k)
  tmpN.lerpVectors(a.n, b.n, k).normalize()
  tmpB.lerpVectors(a.b, b.b, k).normalize()
  // o achatamento (mão, pé) entra aos poucos: a emenda com o braço/perna fica redonda
  const flat = 1 + ((limb.flatten ?? 1) - 1) * smoothstep(0, 0.35, t)
  return out.addScaledVector(tmpN, Math.cos(phi) * radius).addScaledVector(tmpB, Math.sin(phi) * radius * flat)
}

export const limbLength = (limb: Limb) => limb.curve.getLength()

// Ângulo em volta do membro para a coluna `u` da grade (sentido que deixa a face para fora)
export const limbPhi = (u: number) => Math.PI - u * Math.PI * 2

function arm(s: 1 | -1) {
  return makeLimb(
    [
      [0.2 * s, 2.8, -0.02],
      [0.33 * s, 2.67, -0.02],
      [0.45 * s, 2.12, -0.05],
      [0.53 * s, 1.66, 0.03],
    ],
    [
      [0, 0.06],
      [0.12, 0.082],
      [0.3, 0.074],
      [0.56, 0.05],
      [0.63, 0.053],
      [0.76, 0.049],
      [1, 0.034],
    ],
  )
}

function hand(s: 1 | -1) {
  return makeLimb(
    [
      [0.525 * s, 1.68, 0.03],
      [0.552 * s, 1.5, 0.05],
      [0.56 * s, 1.33, 0.05],
    ],
    [
      [0, 0.034],
      [0.3, 0.043],
      [0.62, 0.038],
      [0.9, 0.022],
      [1, 0.004],
    ],
    { flatten: 0.55 },
  )
}

function leg(s: 1 | -1) {
  return makeLimb(
    [
      [0.15 * s, 1.74, -0.01],
      [0.14 * s, 1.3, 0.0],
      [0.122 * s, 0.96, 0.012],
      [0.112 * s, 0.55, -0.02],
      [0.105 * s, 0.15, -0.025],
      [0.104 * s, 0.08, -0.03],
    ],
    [
      [0, 0.172],
      [0.1, 0.166],
      [0.2, 0.148],
      [0.32, 0.124],
      [0.47, 0.084],
      [0.57, 0.088],
      [0.67, 0.086],
      [0.84, 0.058],
      [0.96, 0.044],
      [1, 0.042],
    ],
  )
}

function foot(s: 1 | -1) {
  return makeLimb(
    [
      [0.104 * s, 0.075, -0.085],
      [0.108 * s, 0.08, 0.02],
      [0.118 * s, 0.045, 0.15],
      [0.125 * s, 0.03, 0.22],
    ],
    [
      [0, 0.0],
      [0.08, 0.042],
      [0.3, 0.048],
      [0.7, 0.042],
      [0.95, 0.022],
      [1, 0.0],
    ],
    { flatten: 1.25, up: new THREE.Vector3(0, 1, 0) },
  )
}

export const BODY = {
  arms: [arm(-1), arm(1)] as const,
  hands: [hand(-1), hand(1)] as const,
  legs: [leg(-1), leg(1)] as const,
  feet: [foot(-1), foot(1)] as const,
  neck: makeLimb(
    [
      [0, 2.84, -0.012],
      [0, 2.96, 0.0],
      [0, 3.1, 0.025],
    ],
    [
      [0, 0.09],
      [0.5, 0.082],
      [1, 0.076],
    ],
  ),
  // centro das cavas (onde o braço sai do tronco)
  shoulders: [new THREE.Vector3(-0.33, 2.67, -0.02), new THREE.Vector3(0.33, 2.67, -0.02)] as const,
  head: { center: new THREE.Vector3(0, 3.27, 0.03), radii: new THREE.Vector3(0.145, 0.205, 0.17) },
}

// ---------- Malhas ----------

type PointFn = (u: number, v: number, out: THREE.Vector3) => void

// Grade de `cols` x `rows` pontos que dá a volta completa (u de 0 a 1) e vai de v = 0 a 1.
// A coluna da emenda é repetida (para as coordenadas de textura) e as normais são igualadas nela.
export function wrapGrid(cols: number, rows: number, point: PointFn, extra?: (u: number, v: number, p: THREE.Vector3, i: number) => void) {
  const count = (cols + 1) * (rows + 1)
  const position = new Float32Array(count * 3)
  const p = new THREE.Vector3()
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const i = r * (cols + 1) + c
      point(c / cols, r / rows, p)
      position.set([p.x, p.y, p.z], i * 3)
      extra?.(c / cols, r / rows, p, i)
    }
  }
  const index: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c
      const b = a + 1
      const d = a + cols + 1
      const e = d + 1
      index.push(a, d, b, b, d, e)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  // emenda: primeira e última coluna ficam com a mesma normal
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
  const n = new THREE.Vector3()
  for (let r = 0; r <= rows; r++) {
    const a = r * (cols + 1)
    const b = a + cols
    n.set(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize()
    normal.setXYZ(a, n.x, n.y, n.z)
    normal.setXYZ(b, n.x, n.y, n.z)
  }
  return geometry
}

// Tronco do manequim (do pescoço até o meio das coxas)
export function torsoGeometry(detail: number) {
  const cols = Math.round(72 * detail)
  const rows = Math.round(70 * detail)
  return wrapGrid(cols, rows, (u, v, out) => {
    // emenda nas costas (u = 0 → atrás)
    const theta = Math.PI + u * Math.PI * 2
    const y = TORSO_TOP + 0.01 - v * (TORSO_TOP + 0.01 - TORSO_BOTTOM)
    torsoPoint(theta, y, 0, false, out)
  })
}

export function limbGeometry(limb: Limb, detail: number, cols = 28, rows = 40) {
  const c = Math.max(10, Math.round(cols * detail))
  const r = Math.max(10, Math.round(rows * detail))
  return wrapGrid(c, r, (u, v, out) => {
    limbPoint(limb, v, limbPhi(u), limbRadius(limb, v), out)
  })
}

// Rosto esculpido de leve, como manequim de vitrine: nariz, maçãs, lábios, orelhas e o arco das sobrancelhas.
// `d`: direção numa esfera de raio 1 (frente = +z). Devolve quanto a superfície sai (ou entra) nessa direção.
function faceRelief(d: THREE.Vector3) {
  const front = smoothstep(0.45, 0.85, d.z)
  const ax = Math.abs(d.x)
  const y = d.y
  // nariz: fino na raiz, mais largo e saliente na ponta
  const tip = y > -0.2 ? 0.025 + 0.155 * smoothstep(0.24, -0.2, y) : 0.18 * smoothstep(-0.33, -0.2, y)
  const width = 0.055 + 0.05 * smoothstep(0.05, -0.24, y)
  const nose = tip * gauss(d.x / width)
  const sockets = -0.05 * gauss((ax - 0.31) / 0.13) * gauss((y - 0.12) / 0.1)
  const brow = 0.03 * gauss((y - 0.29) / 0.07) * smoothstep(0.75, 0.2, ax)
  const cheeks = 0.035 * gauss((ax - 0.47) / 0.16) * gauss((y + 0.1) / 0.13)
  const lips = 0.05 * gauss(d.x / 0.17) * gauss((y + 0.42) / 0.045) + 0.045 * gauss(d.x / 0.15) * gauss((y + 0.54) / 0.05)
  const ears = 0.07 * smoothstep(0.82, 0.97, ax) * gauss((y + 0.1) / 0.16) * gauss((d.z + 0.1) / 0.12)
  return front * (nose + sockets + brow + cheeks + lips) + ears
}

// Formato da cabeça (sem o rosto): queixo mais fino e um pouco para a frente; nuca mais cheia
function shapeHead(v: THREE.Vector3) {
  const low = smoothstep(0, -1, v.y)
  v.x *= 1 - 0.2 * low
  v.z *= 1 - 0.1 * low
  if (v.z > 0) v.z += 0.08 * low * v.z
  if (v.z < 0 && v.y > -0.2) v.z *= 1.06
  return v
}

export function headGeometry(detail: number, face = true) {
  const g = new THREE.SphereGeometry(1, Math.round(96 * detail), Math.round(80 * detail))
  const { center, radii } = BODY.head
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  // direção original de cada ponto: o shader pinta o rosto (lábios, sobrancelhas, cílios) com ela
  g.setAttribute('aFace', pos.clone())
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    if (face) v.multiplyScalar(1 + faceRelief(v))
    shapeHead(v).multiply(radii).add(center)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

// ---------- Cabelo esculpido: preso para trás num coque baixo ----------

// Altura da linha do cabelo em volta da cabeça, pela posição de frente (1) a costas (-1)
const HAIRLINE: [number, number][] = [
  [-1, -0.62],
  [-0.5, -0.55],
  [-0.2, -0.36],
  [0.05, -0.16],
  [0.3, 0.06],
  [0.6, 0.27],
  [0.85, 0.42],
  [1, 0.5],
]

function hairline(front: number) {
  for (let i = 1; i < HAIRLINE.length; i++) {
    const [x1, y1] = HAIRLINE[i]
    if (front <= x1) {
      const [x0, y0] = HAIRLINE[i - 1]
      return y0 + ((front - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return HAIRLINE[HAIRLINE.length - 1][1]
}

export const BUN = { center: new THREE.Vector3(0, 3.235, -0.165), radii: new THREE.Vector3(0.088, 0.074, 0.062) }

// Os fios correm da testa para o coque: cada fio é um "meridiano" em volta do eixo testa → coque
const HAIR_AXIS = new THREE.Vector3(0, 0.4, 1).normalize()
const HAIR_SIDE = new THREE.Vector3(1, 0, 0)
const HAIR_UP = new THREE.Vector3().crossVectors(HAIR_AXIS, HAIR_SIDE)

// A malha vai do alto da cabeça (v = 0) até a linha do cabelo (v = 1), dando a volta inteira:
// a borda da malha é a própria linha do cabelo, uma curva lisa (sem degraus de triângulos)
export function hairGeometry(detail: number) {
  const cols = Math.round(120 * detail)
  const rows = Math.round(40 * detail)
  const { center, radii } = BODY.head
  const strand: number[] = []
  const d = new THREE.Vector3()
  const geometry = wrapGrid(
    cols,
    rows,
    (u, v, out) => {
      const around = Math.PI + u * Math.PI * 2 // emenda atrás, escondida pelo coque
      const edge = Math.acos(hairline(Math.cos(around)))
      const polar = v * edge
      d.set(Math.sin(polar) * Math.sin(around), Math.cos(polar), Math.sin(polar) * Math.cos(around))
      // volume: mais alto no topo, assentado na linha do cabelo
      const thick = 0.012 + (0.04 + 0.05 * Math.max(d.y, 0) + 0.05 * Math.max(-d.z, 0)) * (1 - 0.5 * Math.max(d.z, 0)) * (1 - smoothstep(0.45, 1, v))
      out.copy(d).multiplyScalar(1 + faceRelief(d) + thick)
      shapeHead(out).multiply(radii).add(center)
    },
    (_u, _v, _p, i) => {
      strand[i] = (Math.atan2(d.dot(HAIR_SIDE), d.dot(HAIR_UP)) / (Math.PI * 2)) * 70
    },
  )
  geometry.setAttribute('aStrand', new THREE.BufferAttribute(new Float32Array(strand), 1))
  return geometry
}

// Coque: uma bola achatada com os fios torcidos em espiral
export function bunGeometry(detail: number) {
  const g = new THREE.SphereGeometry(1, Math.round(40 * detail), Math.round(28 * detail))
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const strand = new Float32Array(pos.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    strand[i] = (Math.atan2(v.y, v.x) / (Math.PI * 2)) * 14 + Math.acos(Math.max(-1, Math.min(1, -v.z))) * 2.5
    v.multiply(BUN.radii).add(BUN.center)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.setAttribute('aStrand', new THREE.BufferAttribute(strand, 1))
  g.computeVertexNormals()
  return g
}
