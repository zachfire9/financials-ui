import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importedItemProblems } from './itemValidation'

// Keeps the committed example backups importable as the app's rules change.

const examplesDir = join(process.cwd(), 'examples')

function readBackup(path: string) {
  return JSON.parse(readFileSync(join(examplesDir, path), 'utf8')) as { schemaVersion: number; items: unknown[] }
}

const validExamples = readdirSync(examplesDir).filter((file) => file.endsWith('.json'))

describe('example backups', () => {
  it.each(validExamples)('%s imports without validation problems', (file) => {
    const backup = readBackup(file)
    expect(backup.schemaVersion).toBe(1)
    expect(backup.items.length).toBeGreaterThan(0)
    expect(backup.items.flatMap((item, index) => importedItemProblems(item, index))).toEqual([])
  })

  it('uses unique IDs everywhere except the import-repair example', () => {
    for (const file of validExamples.filter((name) => name !== 'missing-and-duplicate-ids.json')) {
      const ids = readBackup(file).items.map((item) => (item as { id?: string }).id)
      expect(ids.every((id) => typeof id === 'string' && id !== ''), file).toBe(true)
      expect(new Set(ids).size, file).toBe(ids.length)
    }
  })

  it('shows nine accounts so the gray fallback color is visible', () => {
    expect(readBackup('many-accounts.json').items).toHaveLength(9)
  })

  it('keeps the invalid example invalid in the documented ways', () => {
    const backup = readBackup('invalid/invalid-items.json')
    const problems = backup.items.flatMap((item, index) => importedItemProblems(item, index))
    expect(problems).toEqual([
      'Item 2: currency must be a 3-letter code such as USD.',
      'Item 3: name is required.',
      'Item 3: amountCents must be a whole number of cents, 0 or more.',
      'Item 3: annualContributionCents must be a whole number of cents, 0 or more.',
    ])
  })

  it('every example is documented in the examples README', () => {
    const readme = readFileSync(join(examplesDir, 'README.md'), 'utf8')
    for (const file of [...validExamples, 'invalid/invalid-items.json']) {
      expect(readme, file).toContain(`\`${file}\``)
    }
  })
})
