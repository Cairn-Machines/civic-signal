// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '../../../..')
const read = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8')

describe('AGENTS.md', () => {
  it('AC2: every backticked `npm run <script>` it names is a root package.json script', () => {
    const scripts = Object.keys(JSON.parse(read('package.json')).scripts as Record<string, string>)
    const named = [...read('AGENTS.md').matchAll(/`npm run ([\w:.-]+)[^`]*`/g)].map((match) => match[1])

    expect(named.length).toBeGreaterThan(0)
    expect(named.filter((script) => !scripts.includes(script))).toEqual([])
  })

  it('AC2: names the smoke command and the primary public screen', () => {
    const doc = read('AGENTS.md')
    expect(doc).toContain('`npm run test:smoke`')
    expect(doc).toContain('`/polls`')
  })
})
