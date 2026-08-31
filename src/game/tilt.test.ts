import { describe, expect, it } from 'vitest'
import {
  FOREHEAD_HOLD_MS,
  FOREHEAD_MIN_SAMPLES,
  getFaceTiltDegrees,
  getForeheadCalibration,
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

  it('calibrates only after the phone is vertical and steady', () => {
    const stableSamples = Array.from(
      { length: FOREHEAD_MIN_SAMPLES },
      (_, index) => 2 + (index % 2),
    )

    expect(getForeheadCalibration(stableSamples, FOREHEAD_HOLD_MS - 1)).toBeNull()
    expect(
      getForeheadCalibration(stableSamples.slice(1), FOREHEAD_HOLD_MS),
    ).toBeNull()
    expect(
      getForeheadCalibration(
        Array.from({ length: FOREHEAD_MIN_SAMPLES }, () => 55),
        FOREHEAD_HOLD_MS,
      ),
    ).toBeNull()
    expect(
      getForeheadCalibration(
        Array.from(
          { length: FOREHEAD_MIN_SAMPLES },
          (_, index) => (index % 2 === 0 ? -5 : 5),
        ),
        FOREHEAD_HOLD_MS,
      ),
    ).toBeNull()
    expect(getForeheadCalibration(stableSamples, FOREHEAD_HOLD_MS)).toBe(2.5)
  })
})