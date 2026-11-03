// Verifica que toda clase usada en el markup tenga al menos una regla CSS.
// Detecta el fallo de .hero/.toolbar: CSS borrado como "sin uso" que en realidad sí se usaba.
// Las clases que solo sirven de gancho para JavaScript se declaran en class-hooks.txt.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listFiles, read, rel, stripCss, report, ROOT } from './lib.mjs'

export function run({ strict = process.argv.includes('--strict') } = {}) {
  const styled = new Set()
  for (const file of listFiles('src', ['.css'])) {
    for (const m of stripCss(read(file)).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) styled.add(m[1])
  }
  const hooksFile = join(ROOT, 'scripts/verify/class-hooks.txt')
  const hooks = new Set(
    existsSync(hooksFile)
      ? read(hooksFile).split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
      : []
  )

  const used = new Map() // clase -> primer lugar donde aparece
  const files = [...listFiles('src', ['.js']), join(ROOT, 'index.html')]
  for (const file of files) {
    read(file).split('\n').forEach((text, i) => {
      const add = (cls) => {
        if (/^[_a-zA-Z][\w-]*$/.test(cls) && !used.has(cls)) used.set(cls, `${rel(file)}:${i + 1}`)
      }
      for (const m of text.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g)) {
        // Se ignoran los fragmentos dinámicos ${...}; solo se toman nombres literales.
        // Una clase pegada a ${...} (p. ej. badge-${tono}) es dinámica: se descarta completa.
        m[1].replace(/[\w-]*\$\{[^}]*\}[\w-]*/g, ' ').split(/\s+/).forEach(add)
      }
      for (const m of text.matchAll(/classList\.(?:add|toggle|contains)\(\s*['"]([\w-]+)['"]/g)) add(m[1])
    })
  }

  const problems = []
  for (const [cls, where] of used) {
    if (!styled.has(cls) && !hooks.has(cls)) problems.push(`.${cls} se usa en ${where} pero no tiene estilos (si es solo un gancho de JS, agrégala a scripts/verify/class-hooks.txt)`)
  }
  return report('Clases con estilos', problems.sort(), { warnOnly: !strict })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(run() ? 0 : 1)
