// The smoke's Playwright webServer command (see playwright.config.ts): build the app, start a throwaway
// Postgres in docker, migrate it, then run `next start` on E2E_PORT. The container is removed when the
// server exits or this process gets SIGTERM/SIGINT, and on any failure.
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const port = String(Number(process.env.E2E_PORT) || 3100)
const containerName = `civicsignal-smoke-pg-${process.pid}-${randomBytes(4).toString('hex')}`
const password = `smoke-${randomBytes(8).toString('hex')}`

let activeChild = null
let containerStarted = false

const sh = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options })

const stopAll = (code) => {
  activeChild?.kill('SIGTERM')
  if (containerStarted) {
    containerStarted = false
    sh('docker', ['rm', '-f', containerName])
  }
  process.exit(code)
}

const fail = (message) => {
  console.error(`smoke serve: ${message}`)
  stopAll(1)
}

process.on('SIGINT', () => stopAll(130))
process.on('SIGTERM', () => stopAll(143))

const stream = (command, args, { cwd = root, env }) =>
  new Promise((resolveExit) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'] })
    activeChild = child
    child.on('error', (error) => {
      console.error(`smoke serve: ${command} failed to start: ${error.message}`)
      resolveExit(1)
    })
    child.on('exit', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)))
  })

const waitForPostgres = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (sh('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']).status === 0) return true
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000))
  }
  return false
}

const main = async () => {
  const docker = sh('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 20_000 })
  if (docker.status !== 0) fail('docker is not available (is the daemon running?); the smoke needs a throwaway Postgres container')

  // Always build: `npm run build` is turbo-cached on its inputs, so a stale .next is never served.
  console.log('smoke serve: building the app (npm run build)')
  if ((await stream('npm', ['run', 'build'], { env: { ...process.env, CI: '1' } })) !== 0) fail('npm run build failed')

  const started = sh('docker', [
    'run', '--rm', '-d', '--name', containerName,
    '-e', `POSTGRES_PASSWORD=${password}`,
    '-p', '127.0.0.1::5432',
    'postgres:17-alpine',
  ])
  if (started.status !== 0) fail(`could not start postgres:17-alpine: ${started.stderr.trim()}`)
  containerStarted = true

  if (!(await waitForPostgres())) fail('the throwaway postgres did not become ready in 60s')
  const mapped = sh('docker', ['port', containerName, '5432/tcp']).stdout.split('\n')[0] ?? ''
  const dbPort = mapped.split(':').pop()?.trim()
  if (!dbPort) fail('could not read the throwaway postgres port')
  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${dbPort}/postgres`

  const migrateEnv = { ...process.env, DATABASE_URL: databaseUrl }
  if ((await stream(join(root, 'packages/db/node_modules/.bin/tsx'), ['packages/db/src/migrate.ts'], { env: migrateEnv })) !== 0) {
    fail('database migration failed')
  }

  const origin = `http://127.0.0.1:${port}`
  const serverEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    APP_URL: origin,
    NEXT_PUBLIC_SITE_URL: origin,
    EMAIL_FROM: 'CivicSignal <smoke@example.invalid>',
    RESEND_API_KEY: '',
    SESSION_SECRET: 'smoke-not-a-secret',
  }
  return stream('node', ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', port], {
    cwd: join(root, 'apps/web'),
    env: serverEnv,
  })
}

main()
  .then((code) => stopAll(code))
  .catch((error) => fail(error instanceof Error ? error.message : String(error)))
