// Runs tests/*.test.ts with Node's built-in test runner (Node 20 can't expand globs itself).
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const files = readdirSync('tests')
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => `tests/${f}`)
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)
