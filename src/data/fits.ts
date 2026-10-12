// Moldes do provador 3D: é o formato com que cada peça aparece vestida no manequim.
// No painel, cada peça do catálogo escolhe o molde mais parecido (um conjunto escolhe dois: o de cima e o de baixo).
// O desenho 3D de cada molde fica em src/components/three/garments.ts.

// Onde a peça veste: parte de cima, de baixo ou inteira (vestido, macacão)
export type Slot = 'top' | 'bottom' | 'full'

export type Fit = { id: string; label: string; slot: Slot }

export const fits: Fit[] = [
  // Parte de cima
  { id: 'regata', label: 'Regata', slot: 'top' },
  { id: 'cropped', label: 'Cropped de alcinha', slot: 'top' },
  { id: 'top-fitness', label: 'Top fitness', slot: 'top' },
  { id: 'tomara-que-caia', label: 'Tomara que caia', slot: 'top' },
  { id: 'ombro-so', label: 'Ombro só', slot: 'top' },
  { id: 'frente-unica', label: 'Frente única', slot: 'top' },
  { id: 'assimetrica', label: 'Frente única assimétrica', slot: 'top' },
  { id: 'ombro-caido', label: 'Manguinha ombro caído', slot: 'top' },
  { id: 'manga-curta', label: 'Manga curta', slot: 'top' },
  { id: 'manga-longa', label: 'Manga longa', slot: 'top' },
  { id: 'gola-alta', label: 'Gola alta', slot: 'top' },
  { id: 'camisa', label: 'Camisa', slot: 'top' },
  // Parte de baixo
  { id: 'pantalona', label: 'Calça pantalona', slot: 'bottom' },
  { id: 'calca-reta', label: 'Calça reta / jeans', slot: 'bottom' },
  { id: 'legging', label: 'Legging / skinny', slot: 'bottom' },
  { id: 'short', label: 'Short', slot: 'bottom' },
  { id: 'short-fitness', label: 'Short fitness', slot: 'bottom' },
  { id: 'saia-curta', label: 'Saia curta', slot: 'bottom' },
  { id: 'saia-short', label: 'Saia-short', slot: 'bottom' },
  { id: 'saia-midi', label: 'Saia midi', slot: 'bottom' },
  { id: 'saia-longa', label: 'Saia longa', slot: 'bottom' },
  // Peça inteira
  { id: 'vestido-curto', label: 'Vestido curto', slot: 'full' },
  { id: 'vestido-trapezio', label: 'Vestido trapézio frente única', slot: 'full' },
  { id: 'vestido-midi', label: 'Vestido midi de alça', slot: 'full' },
  { id: 'vestido-longo', label: 'Vestido longo com fenda', slot: 'full' },
  { id: 'chemise', label: 'Vestido chemise', slot: 'full' },
  { id: 'macacao', label: 'Macacão', slot: 'full' },
]

export const fitById = (id: string) => fits.find((f) => f.id === id)

export const slotLabels: Record<Slot, string> = { top: 'Parte de cima', bottom: 'Parte de baixo', full: 'Peça inteira' }

// Molde sugerido quando a peça é cadastrada, pela categoria (dá para trocar no painel)
export const suggestedFits: Record<string, string[]> = {
  vestidos: ['vestido-curto'],
  blusas: ['manga-curta'],
  tricot: ['manga-longa'],
  conjuntos: ['camisa', 'short'],
  calcas: ['calca-reta'],
  'saias-shorts': ['saia-curta'],
  fitness: ['top-fitness', 'legging'],
  acessorios: [],
}

// Uma peça veste até dois moldes: um de cima e um de baixo, ou uma peça inteira sozinha
export function validFits(ids: string[]) {
  const list = ids.map(fitById).filter((f): f is Fit => Boolean(f))
  const full = list.find((f) => f.slot === 'full')
  if (full) return [full.id]
  const top = list.find((f) => f.slot === 'top')
  const bottom = list.find((f) => f.slot === 'bottom')
  return [top, bottom].filter((f): f is Fit => Boolean(f)).map((f) => f.id)
}
