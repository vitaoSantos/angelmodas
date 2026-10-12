import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import type { Slot } from '../../data/fits'
import { useLook, type Row } from '../../context/LookContext'
import { pieceSource, priceLabel } from '../../lib/products'
import { PieceImage } from './PieceImage'

// O quadro do provador: as peças de verdade sobre um papel cor de linho. Duas faixas (parte de cima
// e parte de baixo) ou uma só (peça inteira). Arrastar para o lado, ou as setas, troca a peça da faixa.
export const rowSlot: Record<Row, Slot> = { top: 'top', bottom: 'bottom', whole: 'full' }
const ROW_LABEL: Record<Row, string> = { top: 'Parte de cima', bottom: 'Parte de baixo', whole: 'Peça inteira' }

export function LookBoard({ className = '' }: { className?: string }) {
  const { board, wearable } = useLook()
  const rows: Row[] = board.whole ? ['whole'] : ['top', 'bottom']
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] bg-[#efe6da] shadow-[inset_0_0_80px_rgb(120_90_60/0.18)] ${className}`}
      style={{ backgroundImage: 'radial-gradient(120% 80% at 30% 10%, #f8f2ea 0%, transparent 60%), linear-gradient(180deg, #f1e8dc, #e3d6c5)' }}
    >
      {wearable.length ? (
        <div className="absolute inset-0 grid gap-2 p-2.5 sm:p-3.5" style={{ gridTemplateRows: rows.map(() => 'minmax(0, 1fr)').join(' ') }}>
          {rows.map((row) => (
            <BoardRow key={row} row={row} />
          ))}
        </div>
      ) : (
        <p className="absolute inset-0 grid place-items-center p-10 text-center font-display text-2xl text-[#5b4636]">
          As peças do provador aparecem aqui assim que forem cadastradas.
        </p>
      )}
    </div>
  )
}

const slide = {
  enter: (dir: number) => ({ x: `${dir * 38}%`, opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -38}%`, opacity: 0 }),
}

function BoardRow({ row }: { row: Row }) {
  const { board, options, cycle } = useLook()
  const worn = board[row]
  const list = options[row]
  const [dir, setDir] = useState(1)
  const start = useRef<{ x: number; y: number } | null>(null)
  const at = worn ? list.findIndex((p) => p.id === worn.product.id) : -1
  const many = list.length > 1

  const go = (step: 1 | -1) => {
    setDir(step)
    cycle(row, step)
  }

  const price = worn ? priceLabel(worn.product) : ''
  const color = worn?.product.colors[worn.color]

  return (
    <div
      className="relative min-h-0 touch-pan-y select-none overflow-hidden rounded-[1.5rem]"
      data-cursor={many ? 'drag' : undefined}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s || !many) return
        const dx = e.clientX - s.x
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1)
      }}
      onPointerCancel={() => (start.current = null)}
    >
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div
          key={worn ? `${worn.product.id}:${worn.color}` : 'vazio'}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          // folga em cima e embaixo para as etiquetas não cobrirem a peça
          className="absolute inset-0 pb-11 pt-8"
        >
          {worn ? (
            <PieceImage source={pieceSource(worn.product, worn.color)} slot={rowSlot[row]} name={worn.product.name} hex={color?.hex} eager />
          ) : (
            <p className="grid h-full place-items-center p-6 text-center text-sm text-[#7a6352]">Escolha uma peça para esta parte do look.</p>
          )}
        </motion.div>
      </AnimatePresence>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5b4636] backdrop-blur-[2px]">
        {ROW_LABEL[row]}
        {many && at >= 0 && <span className="ml-1.5 tabular-nums text-[#a9834f]">{at + 1}/{list.length}</span>}
      </span>
      {worn && (
        <span className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-full bg-white/80 py-1.5 pl-3 pr-1.5 text-[#2a1d16] shadow-[0_6px_18px_-8px_rgb(60_40_20/0.5)]">
          <span className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
            <span className="size-3 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: color?.hex }} />
            <span className="truncate font-medium">{worn.product.name}</span>
          </span>
          {price && <span className="shrink-0 rounded-full bg-[#2a1d16] px-2.5 py-1 text-xs font-semibold text-[#f5ede2]">{price}</span>}
        </span>
      )}
      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`${ROW_LABEL[row]}: peça anterior`}
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg text-[#2a1d16] shadow-[0_4px_14px_-6px_rgb(60_40_20/0.6)] transition-transform hover:scale-105"
          >
            <TbChevronLeft aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`${ROW_LABEL[row]}: próxima peça`}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg text-[#2a1d16] shadow-[0_4px_14px_-6px_rgb(60_40_20/0.6)] transition-transform hover:scale-105"
          >
            <TbChevronRight aria-hidden />
          </button>
        </>
      )}
    </div>
  )
}
