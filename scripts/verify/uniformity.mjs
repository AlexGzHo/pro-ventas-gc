// Las vistas solo distribuyen componentes; no redefinen sus controles ni su escala.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFiles, read, rel, stripCss, report } from './lib.mjs'

const DECLARATION = /(?:^|[;{])\s*(height|min-height|font-size|font-weight|border-radius)\s*:\s*([^;{}]+)/gi
const LITERAL = /(?:\d*\.)?\d+(?:px|rem)\b/gi
const CONTROL = /\.btn(?:\b|[-\w])|(?:^|[\s>+~,(])(?:input|select|textarea)(?=$|[\s.#:[>+~,)])/g

export function inspect(source, file = 'vista.css') {
  const problems = []
  const rawLines = source.split('\n')
  const exceptions = rawLines.map(line => /\/\*\s*uniformity-ok:\s*[^*\s][\s\S]*?\*\//.test(line))
  const clean = stripCss(source)
  const lineAt = offset => clean.slice(0, offset).split('\n').length
  for (const declaration of clean.matchAll(DECLARATION)) {
    const property = declaration[1].toLowerCase()
    const value = declaration[2]
    const valueOffset = declaration.index + declaration[0].lastIndexOf(value)
    for (const literal of value.matchAll(LITERAL)) {
      const line = lineAt(valueOffset + literal.index)
      if (!exceptions[line - 1]) problems.push(`${file}:${line} ${property} usa un literal px/rem; usa un token`)
    }
    if (property === 'font-weight' && /^\d+\s*$/.test(value.trim())) {
      const line = lineAt(valueOffset)
      if (!exceptions[line - 1]) problems.push(`${file}:${line} font-weight usa ${value.trim()}; usa un token de peso`)
    }
  }
  // Mantiene offsets para informar la línea del selector incluso en listas multilínea.
  for (const match of clean.matchAll(/([^{};]+)\{/g)) {
    const selector = match[1].trim()
    if (selector.startsWith('@')) continue
    const first = match.index + match[0].indexOf(selector)
    for (const control of selector.matchAll(CONTROL)) {
      const line = lineAt(first + control.index + control[0].search(/\S/))
      if (!exceptions[line - 1]) problems.push(`${file}:${line} redefine un control compartido (${selector.replace(/\s+/g, ' ')})`)
    }
  }
  return problems
}

export function run() {
  const problems = listFiles('src/styles/views', ['.css']).flatMap(file => inspect(read(file), rel(file)))
  return report('Uniformidad de vistas', problems)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(run() ? 0 : 1)
