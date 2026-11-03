// Verifica que toda variable CSS usada con var(--x) esté declarada en algún archivo de estilos.
import { listFiles, read, rel, stripCss, report } from './lib.mjs'

export function run() {
  const declared = new Set()
  for (const file of listFiles('src', ['.css'])) {
    for (const m of stripCss(read(file)).matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1])
  }
  const problems = []
  for (const file of listFiles('src', ['.css', '.js'])) {
    const lines = read(file).split('\n')
    lines.forEach((text, i) => {
      for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        // Con valor de respaldo var(--x, valor) no rompe el render, pero igual se reporta.
        if (!declared.has(m[1])) problems.push(`${rel(file)}:${i + 1} usa ${m[1]} sin declarar${m[2] === ',' ? ' (tiene respaldo)' : ''}`)
      }
    })
  }
  return report('Variables CSS declaradas', problems)
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(run() ? 0 : 1)
