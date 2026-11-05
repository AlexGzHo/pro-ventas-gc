import assert from 'node:assert/strict'
import { inspect } from '../scripts/verify/uniformity.mjs'

const rejected = [
  '.view { height: 40px; }',
  '.view { min-height: 2rem; }',
  '.view { font-size: 14px; }',
  '.view { border-radius: 8px; }',
  '.view { font-weight: 700; }',
  '.view { height:\n  40px; }',
  '.view { height: calc(100% - 40px); }',
  '.view .btn { color: red; }',
  '.view input:focus { color: red; }',
  '.view select,\n.view textarea { padding: 0; }',
  '.view input::placeholder { color: red; }',
  '.view { height: 40px; }\n/* uniformity-ok: comentario de otra línea */'
]
for (const source of rejected) assert.ok(inspect(source).length, `Debe rechazar: ${source}`)

const accepted = [
  '.view { height: var(--control-h); font-size: var(--text-md); border-radius: var(--radius-card); }',
  '.view { height: 100%; min-height: 0; }',
  '/* .btn { height: 40px; } */\n.view { display: grid; }',
  '.view { height: 40px; } /* uniformity-ok: altura de gráfico heredado */',
  '.view input { color: red; } /* uniformity-ok: caso de prueba explícito */',
  '.input-wrapper, .select-label { display: flex; }',
  '@media (max-width: 640px) { .view { display: grid; } }'
]
for (const source of accepted) assert.equal(inspect(source).length, 0, `Debe aceptar: ${source}`)
console.log(`Uniformidad: ${rejected.length + accepted.length} casos OK`)
