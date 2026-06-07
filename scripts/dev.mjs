import { spawn } from 'node:child_process'

const commands = [
  { name: 'server', command: 'bun', args: ['run', 'dev:server'] },
  { name: 'client', command: 'bun', args: ['run', 'dev:client'] },
]

const children = new Set()
let shuttingDown = false

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

for (const { name, command, args } of commands) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
  })

  children.add(child)

  child.on('exit', (code, signal) => {
    children.delete(child)

    if (!shuttingDown && code !== 0) {
      console.error(`[dev] ${name} exited with ${signal ?? code}`)
      stopAll()
      process.exitCode = code ?? 1
    }

    if (children.size === 0) {
      process.exit(process.exitCode ?? 0)
    }
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stopAll(signal))
}
