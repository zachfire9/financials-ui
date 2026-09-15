import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readText(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('local network smoke-test workflow', () => {
  it('documents the placeholder-only network smoke test flow', () => {
    const readme = readText('README.md')

    expect(readme).toContain('## Local network smoke test')
    expect(readme).toContain('npm run dev:network')
    expect(readme).toContain('http://<dev-machine-private-ip>:5173')
    expect(readme).toContain('VITE_FINANCIALS_API_PROXY_TARGET=http://localhost:8080')
    expect(readme).toContain('Do not commit the real private IP address, hostname, firewall/router details, or real financial values.')
  })

  it('provides explicit local-only and network-visible Vite commands', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['dev:local']).toBe('vite --host 127.0.0.1')
    expect(packageJson.scripts['dev:network']).toBe('vite --host 0.0.0.0')
  })

  it('keeps committed smoke-test documentation free of private network literals', () => {
    const committedDocs = [readText('README.md'), readText('.env.example')].join('\n')

    expect(committedDocs).not.toMatch(/\b10(?:\.\d{1,3}){3}\b/)
    expect(committedDocs).not.toMatch(/\b192\.168(?:\.\d{1,3}){2}\b/)
    expect(committedDocs).not.toMatch(/\b172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}\b/)
    expect(committedDocs).not.toMatch(/\.local\b/i)
  })
})
