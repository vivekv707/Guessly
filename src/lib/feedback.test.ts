import { afterEach, describe, expect, it, vi } from 'vitest'
import { playPositionReadyFeedback } from './feedback'

describe('position ready feedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays a distinct double pulse when haptics are enabled', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    playPositionReadyFeedback(true)

    expect(vibrate).toHaveBeenCalledWith([55, 45, 100])
  })

  it('stays silent when haptics are disabled', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    playPositionReadyFeedback(false)

    expect(vibrate).not.toHaveBeenCalled()
  })
})