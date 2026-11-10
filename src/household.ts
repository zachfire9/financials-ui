// Settings for a household where two people retire at different times. Each
// account can name its owner; accounts without one are joint. The person IDs
// are fixed so renaming someone never detaches their accounts.

import type { ProjectionPerson } from './financialItemsApi'

export type PersonForm = {
  id: string
  name: string
  savingYears: string
}

export const defaultPeople: PersonForm[] = [
  { id: 'person-1', name: 'Person 1', savingYears: '10' },
  { id: 'person-2', name: 'Person 2', savingYears: '10' },
]

export const defaultGapWithdrawal = '0.00'

export function ownerName(ownerId: string | undefined, people: Array<{ id: string; name: string }>) {
  const owner = ownerId ? people.find((person) => person.id === ownerId) : undefined
  return owner ? displayName(owner.name) : 'Joint'
}

export function displayName(name: string) {
  return name.trim() === '' ? 'Unnamed' : name.trim()
}

// Restores saved people, falling back to the defaults for anything missing or
// malformed so an old or edited session still loads.
export function peopleFromSaved(saved: unknown): PersonForm[] {
  if (!Array.isArray(saved)) {
    return defaultPeople
  }
  return defaultPeople.map((fallback) => {
    const match = saved.find(
      (person): person is PersonForm =>
        Boolean(person) &&
        typeof person === 'object' &&
        (person as PersonForm).id === fallback.id &&
        typeof (person as PersonForm).name === 'string' &&
        typeof (person as PersonForm).savingYears === 'string',
    )
    return match ? { id: fallback.id, name: match.name, savingYears: match.savingYears } : fallback
  })
}

// The person still working through the transition years, if their retirement
// years differ: the one who retires last.
export function lastToRetire(people: ProjectionPerson[]) {
  if (people.length < 2) {
    return null
  }
  const sorted = [...people].sort((left, right) => left.savingYears - right.savingYears)
  return sorted[0].savingYears === sorted[sorted.length - 1].savingYears ? null : sorted[sorted.length - 1]
}

export function firstToRetire(people: ProjectionPerson[]) {
  const last = lastToRetire(people)
  return last ? [...people].sort((left, right) => left.savingYears - right.savingYears)[0] : null
}
