// Verifica que toda referencia ICONS.nombre exista en src/ui/icons.js (evita "undefined" en pantalla).
import { listFiles, read, rel, report, ROOT } from './lib.mjs'

export async function run() {
  const { ICONS } = await import(`${ROOT}src/ui/icons.js`)
  const problems = []
  for (const file of listFiles('src', ['.js'])) {
    read(file).split('\n').forEach((text, i) => {
      // (?<![\w$]) evita contar SHELL_ICONS.x u otros objetos que terminan en ICONS.
      for (const m of text.matchAll(/(?<![\w$])ICONS\.([A-Za-z_$][\w$]*)/g)) {
        if (!(m[1] in ICONS)) problems.push(`${rel(file)}:${i + 1} usa ICONS.${m[1]}, que no existe`)
      }
    })
  }
  return report('Iconos existentes', problems)
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit((await run()) ? 0 : 1)
