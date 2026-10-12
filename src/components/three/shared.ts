// Tipos e números usados tanto pelas cenas 3D quanto pela página. Este arquivo não importa o
// three.js: assim a página não baixa o 3D antes da hora (as cenas são carregadas à parte).

// Giro do manequim do provador, controlado pelo arrastar (fora do React)
export type Spin = { angle: number; velocity: number; dragging: boolean; auto: boolean }

export const newSpin = (): Spin => ({ angle: 0.35, velocity: 0, dragging: false, auto: true })

// Distância entre os cabides da arara
export const RACK_SPACING = 1.5

// Posição da arara, compartilhada com os botões e o arrastar (fora do React)
export type RackMotion = { target: number; current: number; velocity: number; dragging: boolean; dragged: boolean }

export const newRackMotion = (): RackMotion => ({ target: 0, current: 0, velocity: 0, dragging: false, dragged: false })
