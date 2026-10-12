import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type * as THREE from 'three'

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// Desenha uma vez tudo o que existe na cena, inclusive o que ainda está escondido (rótulo,
// celofane, fitilho, faíscas). É no primeiro uso que o navegador termina de preparar cada
// shader; fazendo isso agora, atrás da tela de carregamento, nada engasga depois.
function renderEverythingOnce(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const saved: [THREE.Object3D, boolean, boolean][] = []
  scene.traverse((o) => {
    saved.push([o, o.visible, o.frustumCulled])
    o.visible = true
    o.frustumCulled = false
  })
  gl.render(scene, camera)
  for (const [o, visible, culled] of saved) {
    o.visible = visible
    o.frustumCulled = culled
  }
}

// Prepara a cena antes de ela aparecer: compila os shaders em paralelo (sem travar a página,
// onde o navegador suporta) e manda texturas e geometrias para a GPU. Assim a abertura e o
// configurador não engasgam na primeira vez que são vistos.
export function Warmup({ onReady, textures = [], texturesReady = true }: { onReady: () => void; textures?: THREE.Texture[]; texturesReady?: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)
  const compiled = useRef<Promise<unknown> | null>(null)
  const done = useRef(false)

  useEffect(() => {
    // em produção não busca os logs de compilação (cada busca é uma ida e volta à GPU)
    if (!import.meta.env.DEV) gl.debug.checkShaderErrors = false
    compiled.current ??= gl.compileAsync(scene, camera).catch(() => undefined)
  }, [gl, scene, camera])

  useEffect(() => {
    if (!texturesReady || done.current) return
    let cancelled = false
    ;(async () => {
      await compiled.current
      if (cancelled) return
      textures.forEach((t) => gl.initTexture(t))
      renderEverythingOnce(gl, scene, camera)
      await nextFrame()
      if (cancelled) return
      // mais dois quadros normais: o que ainda faltava sobe para a GPU agora
      advance(performance.now(), true)
      await nextFrame()
      if (cancelled) return
      advance(performance.now(), true)
      done.current = true
      onReady()
    })()
    return () => {
      cancelled = true
    }
  }, [texturesReady, textures, gl, advance, onReady])

  return null
}
