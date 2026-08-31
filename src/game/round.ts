export type CardOutcome = 'correct' | 'pass'

export interface CardResult {
  word: string
  outcome: CardOutcome
}

export interface RoundState {
  cards: string[]
  currentIndex: number
  secondsLeft: number
  duration: number
  results: CardResult[]
  status: 'playing' | 'finished'
}

export const shuffleCards = (
  cards: string[],
  random: () => number = Math.random,
) => {
  const shuffled = [...cards]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export const createRound = (
  cards: string[],
  duration: number,
  random: () => number = Math.random,
): RoundState => ({
  cards: shuffleCards(cards, random),
  currentIndex: 0,
  secondsLeft: duration,
  duration,
  results: [],
  status: cards.length > 0 && duration > 0 ? 'playing' : 'finished',
})

export const markCard = (
  state: RoundState,
  outcome: CardOutcome,
): RoundState => {
  if (state.status !== 'playing') {
    return state
  }

  const word = state.cards[state.currentIndex]
  if (!word) {
    return { ...state, status: 'finished' }
  }

  const nextIndex = state.currentIndex + 1

  return {
    ...state,
    currentIndex: nextIndex,
    results: [...state.results, { word, outcome }],
    status: nextIndex >= state.cards.length ? 'finished' : 'playing',
  }
}

export const tickRound = (state: RoundState): RoundState => {
  if (state.status !== 'playing') {
    return state
  }

  if (state.secondsLeft <= 1) {
    return { ...state, secondsLeft: 0, status: 'finished' }
  }

  return { ...state, secondsLeft: state.secondsLeft - 1 }
}

export const finishRound = (state: RoundState): RoundState => ({
  ...state,
  status: 'finished',
})

export const countCorrect = (state: RoundState) =>
  state.results.filter((result) => result.outcome === 'correct').length