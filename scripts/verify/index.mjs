// Ejecuta todos los verificadores. Uso: npm run verify   (o: npm run verify -- --strict)
// Sale con código 1 si alguno falla. Debe pasar antes de cada commit.
import { run as css } from './css.mjs'
import { run as tokens } from './tokens.mjs'
import { run as icons } from './icons.mjs'
import { run as classes } from './classes.mjs'

const results = [css(), tokens(), await icons(), classes()]
const ok = results.every(Boolean)
console.log(ok ? '\nVerificación completa: OK' : '\nVerificación completa: HAY ERRORES. No hagas commit hasta corregirlos.')
process.exit(ok ? 0 : 1)
