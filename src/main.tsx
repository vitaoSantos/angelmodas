import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// O painel (/admin) é carregado à parte: quem visita o site não baixa o código dele
const AdminApp = lazy(() => import('./admin/AdminApp'))
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'
// Laboratório dos moldes 3D (só no `npm run dev`, em /moldes): todos os moldes vestidos lado a lado
const FitLab = import.meta.env.DEV ? lazy(() => import('./dev/FitLab')) : null
const isLab = Boolean(FitLab) && window.location.pathname === '/moldes'

// Sem restaurar a posição do scroll: a abertura sempre começa do topo
if (!isAdmin && 'scrollRestoration' in history) history.scrollRestoration = 'manual'
if (!isAdmin) window.scrollTo(0, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isLab && FitLab ? (
      <Suspense fallback={null}>
        <FitLab />
      </Suspense>
    ) : isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
