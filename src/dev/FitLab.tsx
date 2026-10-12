import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { fits } from '../data/fits'
import { Mannequin, type WornPiece } from '../components/three/Mannequin'
import { Studio, SoftShadow } from '../components/three/Studio'

// Laboratório de moldes (só no `npm run dev`, em /moldes): um manequim por molde
const COLORS = ['#4a2a1b', '#f1e38e', '#b97a74', '#ebe2d2', '#161414', '#8eaecd', '#7a4630', '#a9533a', '#a8c5e6', '#1c2446', '#9a35b0']
const FABRICS = ['malha', 'crepe', 'tricot', 'crepe', 'crepe', 'jeans', 'canelado', 'tricot', 'linho', 'suplex', 'suplex', 'cetim', 'renda']

export default function FitLab() {
  const params = new URLSearchParams(location.search)
  const only = params.get('fit')
  const list = fits.filter((f) => !only || only.split(',').includes(f.id))
  const cols = Number(params.get('cols') ?? 7)
  const view = params.get('view') ?? 'front'
  const rot = view === 'back' ? Math.PI : view === 'side' ? Math.PI / 2 : view === 'three' ? 0.6 : 0
  const fabricParam = params.get('fabric')
  const zoom = Number(params.get('zoom') ?? 1)
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0e0c0b' }}>
      <Canvas frameloop="demand" camera={{ position: [Number(params.get('cx') ?? 0), Number(params.get('cy') ?? 1.8 - (Math.ceil(list.length / cols) - 1) * 2.1), (9 + Math.ceil(list.length / cols) * 3.2) / zoom], fov: 32 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }} dpr={1}>
        <color attach="background" args={['#1a1614']} />
        <Studio />
        {list.map((f, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const pieces: WornPiece[] = [{ key: f.id, fit: f.id, color: COLORS[i % COLORS.length], fabric: fabricParam ?? FABRICS[i % FABRICS.length] }]
          if (f.slot === 'top' && params.get('pair') !== '0') pieces.push({ key: 'b', fit: 'calca-reta', color: '#3d5679', fabric: 'jeans' })
          if (f.slot === 'bottom' && params.get('pair') !== '0') pieces.push({ key: 't', fit: 'regata', color: '#f4f2ee', fabric: 'malha' })
          return (
            <group key={f.id} position={[(col - (Math.min(cols, list.length) - 1) / 2) * 1.6, -row * 4.2, 0]} rotation={[0, rot, 0]}>
              <Mannequin looks={[pieces]} bodyColor={(params.get('bodies')?.split(',')[i] ?? params.get('body')) || undefined} />
              <SoftShadow />
            </group>
          )
        })}
        <OrbitControls target={[Number(params.get('cx') ?? 0), Number(params.get('cy') ?? 1.8 - (Math.ceil(list.length / cols) - 1) * 2.1), 0]} />
      </Canvas>
    </div>
  )
}
