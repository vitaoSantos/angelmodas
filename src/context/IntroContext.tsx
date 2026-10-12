import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../hooks/useMediaQuery'

export type SceneKey = 'hero' | 'fitting'

type IntroState = {
  // true quando a tela de carregamento terminou e a abertura pode animar
  introDone: boolean
  finishIntro: () => void
  showLoader: boolean
  // cenas 3D já compiladas e com tudo na GPU (prontas para rodar sem engasgar)
  heroReady: boolean
  scenesReady: boolean
  markReady: (key: SceneKey) => void
}

const IntroContext = createContext<IntroState | null>(null)

export function IntroProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState({ hero: false, fitting: false })
  const finishIntro = useCallback(() => setDone(true), [])
  const markReady = useCallback((key: SceneKey) => setReady((r) => (r[key] ? r : { ...r, [key]: true })), [])

  return (
    <IntroContext.Provider
      value={{
        introDone: done || reduced,
        finishIntro,
        showLoader: !reduced,
        heroReady: ready.hero,
        scenesReady: ready.hero && ready.fitting,
        markReady,
      }}
    >
      {children}
    </IntroContext.Provider>
  )
}

export function useIntro() {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro precisa estar dentro de IntroProvider')
  return ctx
}
