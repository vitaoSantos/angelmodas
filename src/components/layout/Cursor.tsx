import { useEffect, useRef } from 'react'
import { useFinePointer, useReducedMotion } from '../../hooks/useMediaQuery'

// Anel que segue o mouse com atraso e cresce sobre links e botões
export function Cursor() {
  const fine = useFinePointer()
  const reduced = useReducedMotion()
  const ring = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!fine || reduced) return
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let rx = x
    let ry = y
    let scale = 1
    let target = 1
    let raf = 0

    // o laço de animação para quando o anel alcança o mouse e volta no próximo movimento
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      const el = e.target as Element | null
      const drag = el?.closest?.('[data-cursor="drag"]')
      const hover = el?.closest?.('a, button, [data-cursor], input, textarea, label, select')
      target = drag ? 2.4 : hover ? 1.8 : 1
      if (hint.current) hint.current.style.opacity = drag ? '1' : '0'
      ring.current?.style.setProperty('opacity', '1')
      dot.current?.style.setProperty('opacity', '1')
      wake()
    }
    const onLeave = () => {
      ring.current?.style.setProperty('opacity', '0')
      dot.current?.style.setProperty('opacity', '0')
    }

    function loop() {
      rx += (x - rx) * 0.16
      ry += (y - ry) * 0.16
      scale += (target - scale) * 0.14
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scale})`
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      const settled = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1 && Math.abs(target - scale) < 0.002
      raf = settled ? 0 : requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [fine, reduced])

  if (!fine || reduced) return null

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] grid size-9 place-items-center rounded-full border border-gold/70 opacity-0 transition-opacity duration-300"
      >
        <span ref={hint} className="text-[5px] font-semibold uppercase tracking-widest text-gold opacity-0 transition-opacity">
          arraste
        </span>
      </div>
      <div ref={dot} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[100] size-1.5 rounded-full bg-rose opacity-0" />
    </>
  )
}
