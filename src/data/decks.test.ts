import { describe, expect, it } from 'vitest'
import { decks } from './decks'

describe('deck catalog', () => {
  it('ships five substantial starting decks', () => {
    expect(decks).toHaveLength(5)
    expect(decks.every((deck) => deck.words.length >= 50)).toBe(true)
  })

  it('uses unique deck ids and unique cards within each deck', () => {
    expect(new Set(decks.map((deck) => deck.id)).size).toBe(decks.length)

    for (const deck of decks) {
      expect(new Set(deck.words).size).toBe(deck.words.length)
    }
  })
})