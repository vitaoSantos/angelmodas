import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Mannequin, type WornPiece } from '../components/three/Mannequin'
import { SoftShadow, Studio } from '../components/three/Studio'
import { fits } from '../data/fits'

// Laboratório dos moldes (só no `npm run dev`, em /moldes): um manequim para cada molde, para ajustar
// o desenho das roupas em src/components/three/garments.ts. Parâmetros do endereço:
//   ?fit=regata,camisa   só esses moldes
//   ?view=back|side|three   costas, lado ou três quartos
//   ?fabric=tricot   o mesmo tecido em todos
//   ?cols=4&zoom=2&cy=2.2   colunas, aproximação e altura do centro da câmera
//   ?pair=0   sem a peça de acompanhamento (calça jeans com as blusas, regata com as calças)
const COLORS = ['#4a2a1b', '#f1e38e', '#b97a74', '#ebe2d2', '#161414', '#8eaecd', '#7a4630', '#a9533a', '#a8c5e6', '#1c2446', '#9a35b0']
const FABRICS = ['malha', 'crepe', 'tricot', 'crepe', 'crepe', 'jeans', 'canelado', 'tricot', 'linho', 'suplex', 'suplex', 'cetim', 'renda']
const VIEWS: Record<string, number> = { front: 0, back: Math.PI, side: Math.PI / 2, three: 0.6 }

export default function FitLab() {
  const params = new URLSearchParams(location.search)
  const only = params.get('fit')?.split(',')
  const list = fits.filter((f) => !only || only.includes(f.id))
  const cols = Number(params.get('cols') ?? 7)
  const rows = Math.ceil(list.length / cols)
  const zoom = Number(params.get('zoom') ?? 1)
  const rotation = VIEWS[params.get('view') ?? 'front'] ?? 0
  const fabric = params.get('fabric')
  const pair = params.get('pair') !== '0'
  const centerY = Number(params.get('cy') ?? 1.8 - (rows - 1) * 2.1)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0e0c0b' }}>
      <Canvas
        frameloop="demand"
        dpr={1}
        camera={{ position: [0, centerY, (9 + rows * 3.2) / zoom], fov: 32 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1a1614']} />
        <Studio />
        {list.map((f, i) => {
          const pieces: WornPiece[] = [{ key: f.id, fit: f.id, color: COLORS[i % COLORS.length], fabric: fabric ?? FABRICS[i % FABRICS.length] }]
          if (pair && f.slot === 'top') pieces.push({ key: 'calca', fit: 'calca-reta', color: '#3d5679', fabric: 'jeans' })
          if (pair && f.slot === 'bottom') pieces.push({ key: 'regata', fit: 'regata', color: '#f4f2ee', fabric: 'malha' })
          return (
            <group key={f.id} position={[((i % cols) - (Math.min(cols, list.length) - 1) / 2) * 1.6, -Math.floor(i / cols) * 4.2, 0]} rotation={[0, rotation, 0]}>
              <Mannequin looks={[pieces]} />
              <SoftShadow />
            </group>
          )
        })}
        <OrbitControls target={[0, centerY, 0]} />
      </Canvas>
    </div>
  )
}
