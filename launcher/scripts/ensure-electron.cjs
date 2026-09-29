// Some npm setups skip dependency install scripts, which leaves Electron without its binary
// ("Electron uninstall" from electron-vite). Download it if it's missing.
const { existsSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
if (existsSync(electronDir) && !existsSync(path.join(electronDir, 'path.txt'))) {
  console.log('Electron binary missing; downloading it…')
  execFileSync(process.execPath, [path.join(electronDir, 'install.js')], { stdio: 'inherit' })
}
