import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const child = spawn(
  process.argv[0],
  ['--no-warnings', '--experimental-import-meta-resolve', fileURLToPath(import.meta.resolve('prisma/build/index.js'))],
  {
    stdio: 'inherit',
    windowsHide: true,
  },
)
child.on('exit', (code) => {
  if (code !== null) {
    process.exit(code)
  }
})

child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
