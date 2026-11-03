// Verifica la estructura del CSS: llaves balanceadas y ningún bloque anidado por error.
// Detecta el fallo que rompió el login: reglas "tragadas" por un @keyframes/@media sin cerrar.
import { listFiles, read, rel, cssBlocks, report } from './lib.mjs'

const KEYFRAME_STEP = /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/

export function run() {
  const problems = []
  for (const file of listFiles('src', ['.css'])) {
    const { blocks, errors } = cssBlocks(read(file))
    errors.forEach((e) => problems.push(`${rel(file)} ${e}`))
    for (const b of blocks) {
      const p = b.parent
      if (!p) continue
      const where = `${rel(file)}:${b.line} "${b.head.slice(0, 50)}"`
      if (p.head.startsWith('@keyframes') && !KEYFRAME_STEP.test(b.head)) {
        problems.push(`${where} quedó dentro de ${p.head} (L${p.line}): falta cerrar el @keyframes`)
      } else if (!p.head.startsWith('@') && !b.head.startsWith('&')) {
        problems.push(`${where} quedó anidado dentro de "${p.head.slice(0, 40)}" (L${p.line})`)
      } else if (b.head.startsWith('@media') && p.head.startsWith('@media')) {
        problems.push(`${where} @media dentro de otro @media (L${p.line}): probablemente falta una llave`)
      }
    }
  }
  return report('Estructura CSS', problems)
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(run() ? 0 : 1)
