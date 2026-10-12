// Limpeza de textos que chegam de fora (painel e recados). O React já escapa tudo na hora de mostrar;
// aqui é para não guardar lixo: caracteres de controle, de direção de texto e invisíveis.
const INVISIBLE = /[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g

// Uma linha só, sem espaços repetidos
export function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/\n/g, ' ').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Texto com parágrafos: mantém quebras de linha (no máximo uma linha em branco seguida)
export function cleanMultiline(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}
