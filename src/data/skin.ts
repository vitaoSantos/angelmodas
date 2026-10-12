// Tons de pele do manequim 3D. A cliente escolhe no provador; o site lembra a escolha neste navegador.
// "Manequim" é o corpo de porcelana clássico, sem cabelo.
export type SkinTone = { id: string; label: string; skin: string; hair: string | null }

export const skinTones: SkinTone[] = [
  { id: 'clara', label: 'Clara', skin: '#f0c6a8', hair: '#5a3822' },
  { id: 'media', label: 'Média', skin: '#d39a72', hair: '#3a2316' },
  { id: 'morena', label: 'Morena', skin: '#a66c45', hair: '#26170f' },
  { id: 'negra', label: 'Negra', skin: '#6a3f27', hair: '#140d0a' },
  { id: 'manequim', label: 'Manequim', skin: '#c4aa8a', hair: null },
]

export const DEFAULT_SKIN = 'media'

export const skinById = (id: string) => skinTones.find((t) => t.id === id) ?? skinTones.find((t) => t.id === DEFAULT_SKIN)!
