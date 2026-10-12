import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// O painel (/admin) é carregado à parte: quem visita o site não baixa o código dele
const AdminApp = lazy(() => import('./admin/AdminApp'))
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

// Sem restaurar a posição do scroll: a abertura sempre começa do topo
if (!isAdmin && 'scrollRestoration' in history) history.scrollRestoration = 'manual'
if (!isAdmin) window.scrollTo(0, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
