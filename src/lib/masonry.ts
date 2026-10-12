// Mural em colunas: cada item vai para a coluna mais curta até ali, então a ordem de leitura
// continua "mais recentes em cima" e as colunas terminam quase na mesma altura.
export function toColumns<T>(items: T[], count: number, height: (item: T) => number) {
  const columns = Array.from({ length: count }, () => ({ height: 0, items: [] as { item: T; index: number }[] }))
  items.forEach((item, index) => {
    const target = columns.reduce((low, c) => (c.height < low.height - 0.01 ? c : low))
    target.items.push({ item, index })
    target.height += height(item)
  })
  return columns
}
