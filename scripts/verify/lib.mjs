// Utilidades compartidas de los verificadores. Sin dependencias externas.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../')

export function listFiles(dir, exts) {
  const out = []
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (exts.some((e) => p.endsWith(e))) out.push(p)
    }
  }
  walk(join(ROOT, dir))
  return out.sort()
}

export const read = (p) => readFileSync(p, 'utf8')
export const rel = (p) => relative(ROOT, p)

// Elimina comentarios y cadenas de un CSS conservando los saltos de línea (para reportar líneas reales).
export function stripCss(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => ' '.repeat(m.length))
}

// Recorre un CSS y devuelve los bloques con su selector/at-rule, línea y padre.
export function cssBlocks(src) {
  const clean = stripCss(src)
  const blocks = []
  const stack = []
  let buf = ''
  let line = 1
  const errors = []
  for (const ch of clean) {
    if (ch === '\n') line++
    if (ch === '{') {
      const head = buf.split(/[;}]/).pop().trim()
      const block = { head, line, parent: stack.at(-1) || null }
      blocks.push(block)
      stack.push(block)
      buf = ''
    } else if (ch === '}') {
      if (!stack.pop()) errors.push(`línea ${line}: "}" sin bloque abierto`)
      buf = ''
    } else buf += ch
  }
  for (const b of stack) errors.push(`línea ${b.line}: bloque "${b.head.slice(0, 60)}" nunca se cierra`)
  return { blocks, errors }
}

export function report(name, problems, { warnOnly = false } = {}) {
  if (!problems.length) {
    console.log(`✅ ${name}: OK`)
    return true
  }
  const icon = warnOnly ? '⚠️ ' : '❌'
  console.log(`${icon} ${name}: ${problems.length} problema(s)`)
  for (const p of problems) console.log(`   - ${p}`)
  return warnOnly
}
