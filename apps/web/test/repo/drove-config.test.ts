// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '../../../..')
const config = JSON.parse(readFileSync(resolve(repoRoot, '.drove.json'), 'utf8')) as Record<string, string[] | undefined>

describe('.drove.json', () => {
  it('AC4: checks are the four current entries in order and quickChecks are unchanged', () => {
    expect(config.checks).toEqual([
      'npx --yes pnpm@9.15.4 typecheck',
      'npx --yes pnpm@9.15.4 lint',
      'npx --yes pnpm@9.15.4 -r test',
      'npm run build',
    ])
    expect(config.quickChecks).toEqual(['npx --yes pnpm@9.15.4 typecheck', 'npx --yes pnpm@9.15.4 lint'])
  })

  it('AC4: e2eSmoke, when present, is exactly npm run test:smoke', () => {
    if (config.e2eSmoke !== undefined) expect(config.e2eSmoke).toEqual(['npm run test:smoke'])
  })
})
