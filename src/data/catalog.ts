// Listas do catálogo: categorias, tamanhos, tecidos e cores com nome.
// Para incluir uma opção, é só acrescentar na lista (o painel e o site já usam daqui).

// Categorias da vitrine. Todas começam ligadas; dá para esconder uma categoria inteira pelo painel (/admin).
export type Category = { id: string; label: string }

export const categories: Category[] = [
  { id: 'vestidos', label: 'Vestidos' },
  { id: 'blusas', label: 'Blusas' },
  { id: 'tricot', label: 'Tricô' },
  { id: 'conjuntos', label: 'Conjuntos' },
  { id: 'calcas', label: 'Calças' },
  { id: 'saias-shorts', label: 'Saias e shorts' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'acessorios', label: 'Acessórios' },
]

export const categoryById = (id: string) => categories.find((c) => c.id === id)

// Tamanhos que o painel oferece para marcar em cada peça (na ordem em que aparecem)
export const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'U', '34', '36', '38', '40', '42', '44', '46']

export const sortSizes = (list: string[]) => sizes.filter((s) => list.includes(s))

// Tecidos: mudam o brilho, a textura e o caimento da peça no manequim 3D
export type Fabric = { id: string; label: string; hint: string }

export const fabrics: Fabric[] = [
  { id: 'malha', label: 'Malha', hint: 'macia e leve' },
  { id: 'canelado', label: 'Canelado', hint: 'abraça o corpo' },
  { id: 'tricot', label: 'Tricô', hint: 'quentinho e macio' },
  { id: 'linho', label: 'Linho', hint: 'fresco e natural' },
  { id: 'jeans', label: 'Jeans', hint: 'clássico que dura' },
  { id: 'cetim', label: 'Cetim', hint: 'brilho acetinado' },
  { id: 'crepe', label: 'Crepe', hint: 'caimento fluido' },
  { id: 'suplex', label: 'Suplex', hint: 'para treinar' },
  { id: 'renda', label: 'Renda', hint: 'delicada' },
  { id: 'estampado', label: 'Estampado', hint: 'usa o tecido da foto' },
]

export const fabricById = (id: string) => fabrics.find((f) => f.id === id) ?? fabrics[0]

// Cores com nome: servem de atalho no painel e para dar nome a uma cor escolhida no conta-gotas
export type NamedColor = { label: string; color: string }

export const palette: NamedColor[] = [
  { label: 'Preto', color: '#161414' },
  { label: 'Branco', color: '#f4f2ee' },
  { label: 'Off-white', color: '#ebe2d2' },
  { label: 'Bege', color: '#d6bf9f' },
  { label: 'Nude', color: '#d9a98e' },
  { label: 'Caramelo', color: '#ad7442' },
  { label: 'Marrom', color: '#5b3624' },
  { label: 'Chocolate', color: '#3d2318' },
  { label: 'Terracota', color: '#a9533a' },
  { label: 'Rosé', color: '#c48a84' },
  { label: 'Rosa', color: '#eaa5b8' },
  { label: 'Pink', color: '#d23c80' },
  { label: 'Vermelho', color: '#b0202e' },
  { label: 'Vinho', color: '#5c1a29' },
  { label: 'Amarelo manteiga', color: '#efe18f' },
  { label: 'Mostarda', color: '#c6932a' },
  { label: 'Verde oliva', color: '#6a6a3a' },
  { label: 'Verde', color: '#2e6a49' },
  { label: 'Verde menta', color: '#9ed6c2' },
  { label: 'Azul bebê', color: '#a8c5e6' },
  { label: 'Azul', color: '#3c6db5' },
  { label: 'Azul royal', color: '#2747a6' },
  { label: 'Azul marinho', color: '#1c2446' },
  { label: 'Lilás', color: '#b8a2d8' },
  { label: 'Roxo', color: '#88309e' },
  { label: 'Cinza', color: '#8a8987' },
  { label: 'Jeans claro', color: '#8eaecd' },
  { label: 'Jeans escuro', color: '#3d5679' },
]

function rgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Nome da cor mais parecida da lista (para sugerir o nome de uma cor tirada da foto)
export function nearestColorName(hex: string) {
  const [r, g, b] = rgb(hex)
  let nearest = palette[0]
  let best = Infinity
  for (const c of palette) {
    const [cr, cg, cb] = rgb(c.color)
    // distância com pesos aproximados da percepção de cor
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2
    if (d < best) {
      best = d
      nearest = c
    }
  }
  return nearest.label
}

// Preço guardado em centavos (0 = não mostra preço, "consulte")
export function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
