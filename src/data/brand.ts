// Dados da marca usados em todo o site.
// Campos vazios simplesmente não aparecem (ex.: sem e-mail, o item some do contato).
export const brand = {
  name: 'Anghel Modas',
  tagline: 'Moda feminina',
  // Só números, com DDI e DDD. Ex.: '5535999998888'.
  // Enquanto estiver vazio, os botões abrem o WhatsApp para a pessoa escolher o contato.
  whatsapp: '5535988747707',
  // Só o usuário, sem @
  instagram: 'aanghelmodas',
  email: '',
  // Ex.: 'Poços de Caldas e região'
  city: '',
}

export function whatsappUrl(message: string) {
  const text = encodeURIComponent(message)
  return brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${text}` : `https://wa.me/?text=${text}`
}

export const instagramUrl = brand.instagram ? `https://www.instagram.com/${brand.instagram}/` : ''

// (35) 98874-7707
export function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}
