import * as THREE from 'three'
import { BODY } from './body'
import type { Mask } from './garments'

// Material dos tecidos. Um shader só para todas as roupas (compila uma vez): os recortes das
// peças (decote, cavas, costas, fenda), a textura de cada tecido (nervuras do canelado, pontos do
// tricô, trama do linho, sarja do jeans, renda), o recorte do tecido tirado da foto e os efeitos
// da abertura (costura dourada e troca de cor) são todos uniforms.

export const FABRIC_INDEX: Record<string, number> = {
  malha: 0,
  canelado: 1,
  tricot: 2,
  linho: 3,
  jeans: 4,
  cetim: 5,
  crepe: 6,
  suplex: 7,
  renda: 8,
  estampado: 9,
}

// Brilho e "maciez" de cada tecido (sheen é o brilho aveludado de tecido do MeshPhysicalMaterial)
const LOOK: Record<string, { roughness: number; sheen: number; sheenRoughness: number }> = {
  malha: { roughness: 0.8, sheen: 0.45, sheenRoughness: 0.55 },
  canelado: { roughness: 0.74, sheen: 0.5, sheenRoughness: 0.5 },
  tricot: { roughness: 0.92, sheen: 0.75, sheenRoughness: 0.45 },
  linho: { roughness: 0.84, sheen: 0.3, sheenRoughness: 0.7 },
  jeans: { roughness: 0.9, sheen: 0.25, sheenRoughness: 0.7 },
  cetim: { roughness: 0.3, sheen: 0.55, sheenRoughness: 0.25 },
  crepe: { roughness: 0.7, sheen: 0.35, sheenRoughness: 0.5 },
  suplex: { roughness: 0.46, sheen: 0.3, sheenRoughness: 0.35 },
  renda: { roughness: 0.78, sheen: 0.5, sheenRoughness: 0.5 },
  estampado: { roughness: 0.74, sheen: 0.35, sheenRoughness: 0.5 },
}

export type FabricUniforms = {
  uFabric: { value: number }
  uBump: { value: number }
  uNeckF: { value: THREE.Vector4 }
  uNeckB: { value: THREE.Vector4 }
  uArm: { value: THREE.Vector4 }
  uStyle: { value: THREE.Vector4 }
  uBack: { value: THREE.Vector4 }
  uSlit: { value: THREE.Vector4 }
  uTrim: { value: THREE.Vector4 }
  uSwatch: { value: THREE.Texture | null }
  uSwatchOn: { value: THREE.Vector4 } // x: liga, y: brilho médio do recorte, z: usa as cores do recorte (estampa)
  uSew: { value: THREE.Vector4 } // x: altura da costura (some abaixo), y: largura do brilho, z: liga
  uSweep: { value: THREE.Vector4 } // x: altura da troca de cor, y: liga
  uColor2: { value: THREE.Color }
  uGold: { value: THREE.Color }
}

const PATTERN_GLSL = /* glsl */ `
uniform float uFabric;
uniform float uBump;
uniform vec4 uNeckF;
uniform vec4 uNeckB;
uniform vec4 uArm;
uniform vec4 uStyle;
uniform vec4 uBack;
uniform vec4 uSlit;
uniform vec4 uTrim;
uniform sampler2D uSwatch;
uniform vec4 uSwatchOn;
uniform vec4 uSew;
uniform vec4 uSweep;
uniform vec3 uColor2;
uniform vec3 uGold;
varying vec2 vFab;
varying vec3 vBody;

float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Some com o desenho quando ele fica menor que um pixel (evita o efeito moiré de longe)
float fFade(float freq) {
  float w = max(fwidth(vFab.x), fwidth(vFab.y)) * freq;
  return 1.0 - smoothstep(0.18, 0.55, w);
}

float ribs(vec2 p, float freq) { return 0.5 + 0.5 * cos(p.x * 6.2832 * freq); }

// Renda: flores vazadas numa rede (1 = tecido, 0 = furo)
float laceMask(vec2 p) {
  vec2 q = p * 26.0;
  vec2 cell = fract(q) - 0.5;
  float r = length(cell);
  float petals = 0.2 + 0.07 * cos(atan(cell.y, cell.x) * 5.0);
  float flower = step(petals, r);
  float center = 1.0 - step(0.06, r);
  vec2 q2 = fract(q + 0.5) - 0.5;
  float small = step(0.08, length(q2));
  return clamp(min(flower, small) + center, 0.0, 1.0);
}

// Relevo do tecido (0 a 1) e sombreado da cor nas reentrâncias
float fabricHeight(vec2 p, out float shade) {
  shade = 0.0;
  int kind = int(uFabric + 0.5);
  // barra canelada (tricô, fitness, punhos): nervuras verticais finas
  if (vFab.y < uTrim.y) {
    float h = ribs(p, 70.0);
    shade = -0.12 * (1.0 - h) * fFade(70.0);
    return h * fFade(70.0);
  }
  if (kind == 1) {
    float h = ribs(p, 52.0);
    shade = -0.16 * (1.0 - h) * fFade(52.0);
    return h * fFade(52.0);
  }
  if (kind == 2) {
    vec2 q = vec2(p.x * 36.0, p.y * 46.0);
    float col = fract(q.x) - 0.5;
    float v = fract(q.y + abs(col) * 1.3);
    float h = smoothstep(0.0, 0.5, v) * smoothstep(1.0, 0.5, v);
    h *= 1.0 - smoothstep(0.38, 0.5, abs(col));
    float f = fFade(46.0);
    shade = -0.2 * (1.0 - h) * f + (fNoise(p * 8.0) - 0.5) * 0.06;
    return h * f;
  }
  if (kind == 3) {
    float slub = fNoise(vec2(p.x * 26.0, p.y * 2.5)) * 0.6 + fNoise(vec2(p.x * 3.0, p.y * 80.0)) * 0.4;
    float weave = 0.5 + 0.25 * sin(p.x * 6.2832 * 64.0) + 0.25 * sin(p.y * 6.2832 * 64.0);
    float wrinkle = fNoise(p * vec2(4.0, 1.6));
    shade = (slub - 0.5) * 0.14;
    return mix(weave * fFade(64.0), slub, 0.5) * 0.7 + wrinkle * 0.6;
  }
  if (kind == 4) {
    float t = fract((p.x + p.y) * 64.0);
    float h = smoothstep(0.0, 0.5, t) * smoothstep(1.0, 0.5, t) * fFade(64.0);
    float fade = fNoise(vec2(p.x * 5.0, p.y * 2.2)) * 0.7 + fNoise(p * 30.0) * 0.3;
    shade = (fade - 0.5) * 0.32 + (h - 0.5) * 0.1;
    return h;
  }
  if (kind == 5) {
    // cetim: dobras largas que fazem o brilho correr
    return fNoise(vec2(p.x * 3.0, p.y * 0.9)) * 2.0;
  }
  if (kind == 6) {
    float n = fNoise(p * 90.0) * fFade(90.0);
    shade = (n - 0.5) * 0.05;
    return n * 0.6 + fNoise(p * vec2(5.0, 1.5)) * 0.5;
  }
  if (kind == 8) {
    float m = laceMask(p);
    shade = -0.1 * (1.0 - m);
    return m;
  }
  if (kind == 0) return fNoise(p * vec2(6.0, 2.0)) * 0.45;
  return fNoise(p * vec2(6.0, 2.0)) * 0.3;
}

// Recortes da peça (coordenadas do corpo)
bool cutAway(vec3 p) {
  float ax = abs(p.x);
  if (uNeckF.w > 0.5 && p.z >= 0.0 && ax < uNeckF.y && p.y > uNeckF.x + (2.96 - uNeckF.x) * pow(ax / uNeckF.y, uNeckF.z)) return true;
  if (uNeckB.w > 0.5 && p.z < 0.0 && ax < uNeckB.y && p.y > uNeckB.x + (2.96 - uNeckB.x) * pow(ax / uNeckB.y, uNeckB.z)) return true;
  if (uArm.x > 0.0) {
    if (distance(p, SHOULDER_L) < uArm.x || distance(p, SHOULDER_R) < uArm.x) return true;
  }
  // alças: tira o ombro por fora da alça; abaixo de uArm.z o corte desce em diagonal até a cava
  if (uArm.y > 0.0 && ax > uArm.y + max(0.0, uArm.z - p.y) * 1.3) return true;
  // um ombro só: o coberto é o -x
  if (uArm.w > 0.5) {
    if (p.x > -0.08 && p.y > 2.9 - (p.x + 0.08) * 1.15) return true;
    if (p.y > 2.86 && ax < 0.16) return true;
  }
  // frente única: ombros cortados em diagonal até o pescoço
  if (uStyle.x > 0.0 && p.y > 2.42 && ax > 0.075 + (2.96 - p.y) * uStyle.x) return true;
  // costas: abertas (fica a amarração no pescoço) ou nadador
  if (uBack.x > 0.5 && p.z < -0.02 && p.y > uBack.y) {
    if (uBack.x < 1.5) { if (p.y < 2.86) return true; }
    else if (ax > uBack.z + (p.y - uBack.y) * uBack.w) return true;
  }
  // fenda lateral, abrindo para baixo
  if (uSlit.x != 0.0 && p.y < uSlit.y) {
    float a = atan(p.x * uSlit.x, p.z);
    float w = uSlit.z * clamp((uSlit.y - p.y) / 0.5, 0.0, 1.0);
    if (abs(a - 1.5708) < w) return true;
  }
  // renda: furos no tecido todo, ou só na barra (com o recorte em ondinhas)
  int kind = int(uFabric + 0.5);
  if (kind == 8 && laceMask(vFab) < 0.5) return true;
  if (uTrim.x > 0.5 && vFab.y < 0.16) {
    float scallop = 0.028 * (0.5 + 0.5 * cos(vFab.x * 6.2832 * 12.0));
    if (vFab.y < scallop) return true;
    if (laceMask(vFab * 1.3) < 0.5 && vFab.y > 0.035) return true;
  }
  return false;
}
`

function shoulderGLSL() {
  const [l, r] = BODY.shoulders
  const v = (p: THREE.Vector3) => `vec3(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`
  return `#define SHOULDER_L ${v(l)}\n#define SHOULDER_R ${v(r)}\n`
}

export function createFabricMaterial() {
  const uniforms: FabricUniforms = {
    uFabric: { value: 0 },
    uBump: { value: 1 },
    uNeckF: { value: new THREE.Vector4() },
    uNeckB: { value: new THREE.Vector4() },
    uArm: { value: new THREE.Vector4() },
    uStyle: { value: new THREE.Vector4() },
    uBack: { value: new THREE.Vector4() },
    uSlit: { value: new THREE.Vector4() },
    uTrim: { value: new THREE.Vector4() },
    uSwatch: { value: null },
    uSwatchOn: { value: new THREE.Vector4(0, 0.5, 0, 0) },
    uSew: { value: new THREE.Vector4(-10, 0.06, 0, 0) },
    uSweep: { value: new THREE.Vector4(-10, 0, 0, 0) },
    uColor2: { value: new THREE.Color('#ffffff') },
    uGold: { value: new THREE.Color('#ffcf8a') },
  }
  const material = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.8, sheen: 0.4, sheenRoughness: 0.5 })
  material.userData.uniforms = uniforms
  material.customProgramCacheKey = () => 'anghel-fabric-1'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFab;\nvarying vec2 vFab;\nvarying vec3 vBody;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFab = aFab;\nvBody = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${shoulderGLSL()}${PATTERN_GLSL}`)
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
        if (uSew.z > 0.5 && vBody.y < uSew.x) discard;
        if (cutAway(vBody)) discard;
        float fabShade;
        float fabH = fabricHeight(vFab, fabShade);`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        if (uSwatchOn.x > 0.5) {
          vec3 sw = texture2D(uSwatch, vFab * 1.6).rgb;
          if (uSwatchOn.z > 0.5) diffuseColor.rgb = sw;
          else {
            float lum = dot(sw, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb *= clamp(mix(1.0, lum / max(uSwatchOn.y, 0.05), 0.7), 0.4, 1.6);
          }
        }
        if (uSweep.y > 0.5 && vBody.y < uSweep.x) diffuseColor.rgb = uColor2;
        // carcela da camisa: duas costuras e os botões
        if (uTrim.z > 0.5 && vBody.z > 0.0 && abs(vBody.x) < 0.03) {
          float stitch = 1.0 - smoothstep(0.0015, 0.004, abs(abs(vBody.x) - 0.024));
          float button = 1.0 - smoothstep(0.009, 0.012, length(vec2(vBody.x, mod(vBody.y, 0.13) - 0.065)));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82, stitch * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.95, 0.92, 0.86), 0.55), button);
        }
        diffuseColor.rgb *= 1.0 + fabShade;
        // o avesso é mais escuro
        if (!gl_FrontFacing) diffuseColor.rgb *= 0.55;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (0.5 - fabH) * 0.12, 0.05, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 sPos = -vViewPosition;
          vec3 sx = dFdx(sPos);
          vec3 sy = dFdy(sPos);
          vec3 r1 = cross(sy, normal);
          vec3 r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec2 dh = vec2(dFdx(fabH), dFdy(fabH)) * 0.0022 * uBump;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        if (uSew.z > 0.5) {
          float edge = 1.0 - smoothstep(0.0, uSew.y, vBody.y - uSew.x);
          totalEmissiveRadiance += uGold * edge * 2.2;
        }
        if (uSweep.y > 0.5) {
          float seam = 1.0 - smoothstep(0.0, 0.025, abs(vBody.y - uSweep.x));
          totalEmissiveRadiance += uGold * seam * 1.8;
        }`,
      )
  }
  return material
}

const v4 = (target: THREE.Vector4, x = 0, y = 0, z = 0, w = 0) => target.set(x, y, z, w)

// Passa os recortes do molde para os uniforms do material
export function applyMask(material: THREE.MeshPhysicalMaterial, mask: Mask, fabric: string) {
  const u = material.userData.uniforms as FabricUniforms
  const nf = mask.neckFront
  const nb = mask.neckBack
  v4(u.uNeckF.value, nf?.[0], nf?.[1], nf?.[2], nf ? 1 : 0)
  v4(u.uNeckB.value, nb?.[0], nb?.[1], nb?.[2], nb ? 1 : 0)
  v4(u.uArm.value, mask.armhole ?? 0, mask.shoulderCut?.[0] ?? 0, mask.shoulderCut?.[1] ?? 0, mask.oneShoulder ? 1 : 0)
  v4(u.uStyle.value, mask.halter ?? 0)
  v4(u.uBack.value, mask.back?.[0] ?? 0, mask.back?.[1] ?? 0, mask.back?.[2] ?? 0, mask.back?.[3] ?? 0)
  v4(u.uSlit.value, mask.slit?.[0] ?? 0, mask.slit?.[1] ?? 0, mask.slit?.[2] ?? 0)
  // barra canelada: só nos tecidos de malha/tricô (ou quando o molde pede, como o top fitness)
  const knit = fabric === 'tricot' || fabric === 'canelado'
  const rib = mask.rib ?? 0
  v4(u.uTrim.value, mask.lace ? 1 : 0, knit || rib >= 0.5 || (rib > 0 && fabric === 'suplex') ? rib : 0, mask.placket ? 1 : 0)
}

// Cor e tecido. `swatch`: textura do recorte do tecido (com o brilho médio dela)
export function applyFabric(
  material: THREE.MeshPhysicalMaterial,
  color: string,
  fabric: string,
  swatch: { texture: THREE.Texture; mean: number } | null = null,
) {
  const u = material.userData.uniforms as FabricUniforms
  const look = LOOK[fabric] ?? LOOK.malha
  const printed = fabric === 'estampado'
  material.color.set(printed && swatch ? '#ffffff' : color)
  material.roughness = look.roughness
  material.sheen = look.sheen
  material.sheenRoughness = look.sheenRoughness
  // o brilho aveludado puxa para uma versão clara da própria cor
  material.sheenColor.set(color).lerp(new THREE.Color('#ffffff'), 0.45)
  u.uFabric.value = FABRIC_INDEX[fabric] ?? 0
  u.uSwatch.value = swatch?.texture ?? null
  v4(u.uSwatchOn.value, swatch ? 1 : 0, swatch?.mean ?? 0.5, printed && swatch ? 1 : 0)
}

export function fabricUniforms(material: THREE.Material) {
  return material.userData.uniforms as FabricUniforms
}

// Corpo do manequim: pele (com cabelo esculpido e o rosto pintado de leve) ou porcelana clássica.
// Na abertura ele "nasce" do chão em linhas douradas (croqui).
export type BodyUniforms = { uRise: { value: number }; uSketch: { value: number }; uGold: { value: THREE.Color } }

export type BodyPart = 'body' | 'face' | 'hair'
export type BodyMaterials = Record<BodyPart, THREE.MeshPhysicalMaterial> & { uniforms: BodyUniforms }


// Rosto pintado: lábios, mancha de blush, sobrancelhas e o traço dos cílios (olhos fechados, sereno).
// `vFace` é a direção na esfera da cabeça antes do relevo (as mesmas medidas de body.ts).
const FACE_PAINT = /* glsl */ `
  {
    vec3 hd = vFace;
    float onFace = smoothstep(0.35, 0.6, hd.z);
    float ax = abs(hd.x);
    // lábios: o de cima um pouco mais fino, e a linha da boca
    float lipUp = 1.0 - smoothstep(0.7, 1.0, length(vec2(hd.x / 0.19, (hd.y + 0.43) / 0.05)));
    float lipDown = 1.0 - smoothstep(0.7, 1.0, length(vec2(hd.x / 0.165, (hd.y + 0.535) / 0.06)));
    float lip = max(lipUp, lipDown) * onFace;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.84, 0.5, 0.5), lip * 0.75);
    float mouthY = -0.478 + 0.035 * (hd.x / 0.19) * (hd.x / 0.19);
    float mouth = (1.0 - smoothstep(0.004, 0.014, abs(hd.y - mouthY))) * (1.0 - smoothstep(0.13, 0.19, ax)) * onFace;
    diffuseColor.rgb *= 1.0 - 0.5 * mouth;
    // blush nas maçãs
    float blush = exp(-pow((ax - 0.46) / 0.17, 2.0) - pow((hd.y + 0.14) / 0.13, 2.0)) * onFace;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.78, 0.76), blush * 0.4);
    // sobrancelhas: arco mais grosso perto do nariz
    float bx = (ax - 0.32) / 0.2;
    float browY = 0.305 + 0.05 * (1.0 - bx * bx) - 0.012 * bx;
    float browW = mix(0.026, 0.012, clamp(bx * 0.5 + 0.5, 0.0, 1.0));
    float brow = (1.0 - smoothstep(browW * 0.6, browW, abs(hd.y - browY))) * (1.0 - smoothstep(0.75, 1.0, abs(bx))) * onFace;
    diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, brow * 0.8);
    // cílios: um traço curvo para baixo, puxado no canto de fora
    float ex = (ax - 0.31) / 0.15;
    float lashY = 0.115 - 0.04 * (1.0 - ex * ex) + 0.02 * smoothstep(0.4, 1.0, ex);
    float lash = (1.0 - smoothstep(0.006, 0.016, abs(hd.y - lashY))) * (1.0 - smoothstep(0.8, 1.05, abs(ex))) * onFace;
    diffuseColor.rgb = mix(diffuseColor.rgb, uAccent * 0.5, lash * 0.9);
    // pálpebra um pouco mais escura
    float lid = (1.0 - smoothstep(0.0, 0.05, hd.y - lashY)) * step(lashY, hd.y) * (1.0 - smoothstep(0.7, 1.0, abs(ex))) * onFace;
    diffuseColor.rgb *= 1.0 - 0.12 * lid;
  }
`

// Fios do cabelo: listras finas que somem quando ficam pequenas demais na tela (não tremem)
const HAIR_FIBERS = /* glsl */ `
  {
    float phase = vStrand;
    float fiber = 0.5 + 0.5 * sin(phase * 6.2831853);
    float group = bHash(vec3(floor(phase), 0.0, 1.0));
    float fade = smoothstep(0.25, 0.6, fwidth(phase));
    diffuseColor.rgb *= mix(0.84 + 0.22 * fiber, 1.0, fade) * (0.95 + 0.1 * group);
  }
`

function bodyMaterial(part: BodyPart, porcelain: boolean, color: string, accent: string, uniforms: BodyUniforms) {
  const material = porcelain
    ? new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        metalness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        sheen: 0.3,
        sheenColor: new THREE.Color('#fff1dc'),
      })
    : part === 'hair'
      ? new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.42,
          clearcoat: 0.3,
          clearcoatRoughness: 0.35,
          sheen: 0.7,
          sheenRoughness: 0.35,
          sheenColor: new THREE.Color(color).lerp(new THREE.Color('#e8c9a0'), 0.35),
        })
      : new THREE.MeshPhysicalMaterial({
          // pele: fosca, com um brilho aveludado quente nas bordas (lembra a luz atravessando a pele)
          color,
          roughness: 0.55,
          clearcoat: 0.1,
          clearcoatRoughness: 0.5,
          sheen: 0.55,
          sheenRoughness: 0.5,
          sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ff9c84'), 0.55),
        })
  const accentColor = new THREE.Color(accent)
  const paint = !porcelain && part === 'face'
  const fibers = !porcelain && part === 'hair'
  material.userData.uniforms = uniforms
  material.customProgramCacheKey = () => `anghel-body-2:${porcelain ? 'p' : 's'}:${part}`
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uAccent: { value: accentColor } })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBody;
        ${paint ? 'attribute vec3 aFace;\nvarying vec3 vFace;' : ''}
        ${fibers ? 'attribute float aStrand;\nvarying float vStrand;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBody = position;
        ${paint ? 'vFace = aFace;' : ''}
        ${fibers ? 'vStrand = aStrand;' : ''}`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uRise;
        uniform float uSketch;
        uniform vec3 uGold;
        uniform vec3 uAccent;
        varying vec3 vBody;
        ${paint ? 'varying vec3 vFace;' : ''}
        ${fibers ? 'varying float vStrand;' : ''}
        float bHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
        if (vBody.y > uRise) discard;
        // curvas de nível douradas, como um croqui
        float ringD = abs(fract(vBody.y / 0.075) - 0.5) * 0.075;
        float line = 1.0 - smoothstep(0.0025, 0.006, ringD);
        if (uSketch > 0.001 && line < 0.5 && bHash(floor(vBody * 90.0)) < uSketch) discard;`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${paint ? FACE_PAINT : ''}${fibers ? HAIR_FIBERS : ''}`)
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        ${porcelain || part === 'hair' ? '' : '// luz que atravessa a pele: sombras um pouco mais quentes\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.09, 0.04, 0.03);'}
        totalEmissiveRadiance += uGold * (line * uSketch * 1.6 + (1.0 - smoothstep(0.0, 0.08, uRise - vBody.y)) * 2.0);`,
      )
  }
  return material
}

// Os três materiais do manequim (corpo, rosto e cabelo) dividem os uniforms da abertura
export function createBodyMaterials(tone: { skin: string; hair: string | null }): BodyMaterials {
  const uniforms: BodyUniforms = { uRise: { value: 10 }, uSketch: { value: 0 }, uGold: { value: new THREE.Color('#ffcf8a') } }
  const porcelain = !tone.hair
  const accent = tone.hair ?? '#3a2316'
  return {
    uniforms,
    body: bodyMaterial('body', porcelain, tone.skin, accent, uniforms),
    face: bodyMaterial('face', porcelain, tone.skin, accent, uniforms),
    hair: bodyMaterial('hair', porcelain, tone.hair ?? tone.skin, accent, uniforms),
  }
}
