import { describe, expect, it } from 'vitest'
import {
  countCorrect,
  createRound,
  finishRound,
  markCard,
  shuffleCards,
  tickRound,
} from './round'

describe('round engine', () => {
  it('shuffles a copy without changing the source deck', () => {
    const cards = ['one', 'two', 'three']

    expect(shuffleCards(cards, () => 0)).toEqual(['two', 'three', 'one'])
    expect(cards).toEqual(['one', 'two', 'three'])
  })

  it('records correct and passed cards in order', () => {
    let round = createRound(['one', 'two', 'three'], 60, () => 0.999)

    round = markCard(round, 'correct')
    round = markCard(round, 'pass')

    expect(round.currentIndex).toBe(2)
    expect(round.results).toEqual([
      { word: 'one', outcome: 'correct' },
      { word: 'two', outcome: 'pass' },
    ])
    expect(countCorrect(round)).toBe(1)
  })

  it('finishes when the timer reaches zero', () => {
    const round = createRound(['one'], 1, () => 0.999)

    expect(tickRound(round)).toMatchObject({
      secondsLeft: 0,
      status: 'finished',
    })
  })

  it('finishes when every card has been played', () => {
    const round = markCard(createRound(['one'], 60), 'correct')

    expect(round.status).toBe('finished')
    expect(round.results).toHaveLength(1)
  })

  it('ignores scoring and timer actions after a round finishes', () => {
    const round = finishRound(createRound(['one', 'two'], 60))

    expect(markCard(round, 'correct')).toBe(round)
    expect(tickRound(round)).toBe(round)
  })

  it('does not start with invalid inputs', () => {
    expect(createRound([], 60).status).toBe('finished')
    expect(createRound(['one'], 0).status).toBe('finished')
  })
})