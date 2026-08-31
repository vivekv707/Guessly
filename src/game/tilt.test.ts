import { describe, expect, it } from 'vitest'
import {
  getFaceTiltDegrees,
  getMotionFaceTiltDegrees,
  getTiltOutcome,
  TILT_NEUTRAL_DEGREES,
  TILT_TRIGGER_DEGREES,
} from './tilt'

describe('tilt controls', () => {
  it('tracks both directions around a portrait forehead position', () => {
    expect(getFaceTiltDegrees(90, 0)).toBeCloseTo(0)
    expect(getFaceTiltDegrees(70, 0)).toBeCloseTo(20)
    expect(getFaceTiltDegrees(110, 0)).toBeCloseTo(-20)
  })

  it('tracks both directions across the landscape gamma boundary', () => {
    expect(getFaceTiltDegrees(0, 90)).toBeCloseTo(0)
    expect(getFaceTiltDegrees(0, 70)).toBeCloseTo(20)
    expect(getFaceTiltDegrees(180, 70)).toBeCloseTo(-20)
  })

  it('derives both directions from accelerometer gravity', () => {
    expect(getMotionFaceTiltDegrees(0, 1, 0)).toBeCloseTo(0)
    expect(getMotionFaceTiltDegrees(0, Math.cos(Math.PI / 9), Math.sin(Math.PI / 9))).toBeCloseTo(20)
    expect(getMotionFaceTiltDegrees(0, Math.cos(Math.PI / 9), -Math.sin(Math.PI / 9))).toBeCloseTo(-20)
  })

  it('maps a small downward tilt to correct and upward tilt to pass', () => {
    expect(getTiltOutcome(-TILT_TRIGGER_DEGREES)).toBe('correct')
    expect(getTiltOutcome(TILT_TRIGGER_DEGREES)).toBe('pass')
    expect(getTiltOutcome(TILT_TRIGGER_DEGREES - 1)).toBeNull()
  })

  it('keeps the neutral reset comfortably below the trigger', () => {
    expect(TILT_NEUTRAL_DEGREES).toBeLessThan(TILT_TRIGGER_DEGREES / 2)
  })
})