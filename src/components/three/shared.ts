// Números usados tanto pela arara 3D quanto pela página. Este arquivo não importa o three.js:
// assim a página não baixa o 3D antes da hora (a arara é carregada à parte).

// Distância entre os cabides da arara
export const RACK_SPACING = 1.5

// Posição da arara, compartilhada com os botões e o arrastar (fora do React)
export type RackMotion = { target: number; current: number; velocity: number; dragging: boolean; dragged: boolean }

export const newRackMotion = (): RackMotion => ({ target: 0, current: 0, velocity: 0, dragging: false, dragged: false })
