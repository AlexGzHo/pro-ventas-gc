// Verifica que toda referencia ICONS.nombre exista en src/ui/icons.js (evita "undefined" en pantalla).
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listFiles, read, rel, report, ROOT } from './lib.mjs'

export async function run() {
  const iconPath = pathToFileURL(join(ROOT, 'src/ui/icons.js')).href
  const { ICONS } = await import(iconPath)
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit((await run()) ? 0 : 1)
