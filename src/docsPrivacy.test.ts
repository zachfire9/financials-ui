import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readText(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

// Guards against committing real private network details in docs or example config.
describe('committed docs privacy', () => {
  it('keeps README and .env.example free of private network literals', () => {
    const committedDocs = [readText('README.md'), readText('.env.example')].join('\n')

    expect(committedDocs).not.toMatch(/\b10(?:\.\d{1,3}){3}\b/)
    expect(committedDocs).not.toMatch(/\b192\.168(?:\.\d{1,3}){2}\b/)
    expect(committedDocs).not.toMatch(/\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/)
    expect(committedDocs).not.toMatch(/\.local\b/i)
  })
})
