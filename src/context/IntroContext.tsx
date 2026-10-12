import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../hooks/useMediaQuery'

export type SceneKey = 'hero'

type IntroState = {
  // true quando a tela de carregamento terminou e a abertura pode animar
  introDone: boolean
  finishIntro: () => void
  showLoader: boolean
  // a capa já tem a primeira foto (ou não tem foto nenhuma)
  heroReady: boolean
  markReady: (key: SceneKey) => void
}

const IntroContext = createContext<IntroState | null>(null)

export function IntroProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState({ hero: false })
  const finishIntro = useCallback(() => setDone(true), [])
  const markReady = useCallback((key: SceneKey) => setReady((r) => (r[key] ? r : { ...r, [key]: true })), [])

  return (
    <IntroContext.Provider
      value={{
        introDone: done || reduced,
        finishIntro,
        showLoader: !reduced,
        heroReady: ready.hero,
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
