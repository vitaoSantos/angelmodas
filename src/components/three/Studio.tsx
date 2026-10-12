import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

type Panel = { form: 'rect' | 'ring'; intensity: number; color: string; position: [number, number, number]; scale: [number, number, number] }

// Painéis de luz de estúdio que o tecido e a porcelana refletem: softbox quente na frente,
// contraluz rosado, aro branco por cima e um rebatedor dourado embaixo
const panels: Panel[] = [
  { form: 'rect', intensity: 3, color: '#fff3e6', position: [-3, 3, 5], scale: [4, 3, 1] },
  { form: 'rect', intensity: 1.6, color: '#ffd6d0', position: [4.5, 1, 3], scale: [2, 5, 1] },
  { form: 'ring', intensity: 2.2, color: '#ffffff', position: [0, 6, -2], scale: [3, 3, 1] },
  { form: 'rect', intensity: 1, color: '#e8b878', position: [0, -3, 3], scale: [7, 1, 1] },
  { form: 'rect', intensity: 0.7, color: '#d7c3ff', position: [-5, 2, -2], scale: [1, 6, 1] },
]

// Mapa de reflexos gerado uma vez só (PMREM) a partir dos painéis acima: sem baixar HDR
export function makeStudioEnvironment(gl: THREE.WebGLRenderer, size: number) {
  const envScene = new THREE.Scene()
  envScene.background = new THREE.Color('#1a1512')
  const rect = new THREE.PlaneGeometry()
  const ring = new THREE.RingGeometry(0.5, 1, 48)
  const materials = panels.map((panel) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(panel.color).multiplyScalar(panel.intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(panel.form === 'ring' ? ring : rect, material)
    mesh.position.set(...panel.position)
    mesh.scale.set(...panel.scale)
    mesh.lookAt(0, 0, 0)
    envScene.add(mesh)
    return material
  })
  const pmrem = new THREE.PMREMGenerator(gl)
  const target = pmrem.fromScene(envScene, 0, 0.1, 100, { size })
  pmrem.dispose()
  rect.dispose()
  ring.dispose()
  materials.forEach((m) => m.dispose())
  return target
}

function StudioEnvironment({ size }: { size: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useLayoutEffect(() => {
    const target = makeStudioEnvironment(gl, size)
    scene.environment = target.texture
    scene.environmentIntensity = 0.8
    return () => {
      if (scene.environment === target.texture) scene.environment = null
      target.dispose()
    }
  }, [gl, scene, size])

  return null
}

// Usa um mapa de reflexos já pronto (cenas dentro de texturas, como os cartões da arara)
export function SharedEnvironment({ texture }: { texture: THREE.Texture | null }) {
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    scene.environment = texture
    scene.environmentIntensity = 0.8
  }, [scene, texture])
  return null
}

export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#fff0e2" />
      <directionalLight position={[-3, 5, 6]} intensity={2.1} color="#fff3e4" />
      <directionalLight position={[4, 2, -3]} intensity={1.4} color="#ffc9c0" />
      <directionalLight position={[2, -1, 4]} intensity={0.5} color="#ffe2b8" />
      <spotLight position={[0, 7, 2]} angle={0.5} penumbra={0.8} intensity={30} distance={14} color="#fff1dc" />
    </>
  )
}

// Iluminação de vitrine: luz principal quente, contraluz rosado e um "spot" de cima
export function Studio({ envSize = 256 }: { envSize?: number }) {
  return (
    <>
      <StudioLights />
      <StudioEnvironment size={envSize} />
    </>
  )
}

// Poeirinha dourada flutuando em volta: o brilho da vitrine
export function GoldDust({ count = 120, spread = 1, burst }: { count?: number; spread?: number; burst?: { current: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => {
    let seed = 7
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2
      const radius = (1.2 + rand() * 3.4) * spread
      return {
        base: new THREE.Vector3(Math.cos(angle) * radius * 1.3, 0.2 + rand() * 3.6, -0.5 - rand() * 4 + Math.sin(angle) * 0.8),
        bob: rand() * Math.PI * 2,
        speed: 0.2 + rand() * 0.5,
        scale: 0.4 + rand() * 0.9,
      }
    })
  }, [count, spread])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const push = 1 + (burst?.current ?? 0) * 0.4
    data.forEach((d, i) => {
      dummy.position.set(d.base.x * push, d.base.y + Math.sin(t * d.speed + d.bob) * 0.25, d.base.z)
      dummy.scale.setScalar(d.scale * (0.75 + 0.25 * Math.sin(t * 2 * d.speed + d.bob)))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <octahedronGeometry args={[0.012, 0]} />
      <meshBasicMaterial color="#ffd9a0" toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  )
}

// Brilho atrás do manequim (plano com gradiente radial)
export function Glow({ color = '#d8b98a', opacity = 0.35, scale = 9, position = [0, 1.8, -3] as [number, number, number] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float a = pow(max(1.0 - d, 0.0), 1.9) * uOpacity;
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [color, opacity],
  )
  return (
    <mesh position={position} scale={scale} material={material}>
      <planeGeometry />
    </mesh>
  )
}

// Sombra macia no chão (um gradiente, mais leve que sombra de verdade)
export function SoftShadow({ radius = 0.9, opacity = 0.55 }: { radius?: number; opacity?: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: opacity } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            gl_FragColor = vec4(0.0, 0.0, 0.0, pow(max(1.0 - d, 0.0), 1.6) * uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    [opacity],
  )
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.095, 0]} scale={radius * 2.4} material={material}>
      <planeGeometry />
    </mesh>
  )
}
