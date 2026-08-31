import type { CardOutcome } from './round'

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI

// Raised the trigger degrees to require a larger tilt before firing
// and nudged the neutral zone up slightly so accidental small movements
// won't immediately re-arm the action.
// Further increase thresholds to reduce sensitivity per user request
export const TILT_TRIGGER_DEGREES = 30
export const TILT_NEUTRAL_DEGREES = 12
export const FOREHEAD_MAX_TILT_DEGREES = 25
export const FOREHEAD_STABILITY_DEGREES = 6
export const FOREHEAD_HOLD_MS = 600
export const FOREHEAD_MIN_SAMPLES = 8

export const getForeheadCalibration = (
  samples: readonly number[],
  elapsedMs: number,
) => {
  if (
    samples.length < FOREHEAD_MIN_SAMPLES ||
    elapsedMs < FOREHEAD_HOLD_MS ||
    samples.some((sample) => Math.abs(sample) > FOREHEAD_MAX_TILT_DEGREES)
  ) {
    return null
  }

  const lowestSample = Math.min(...samples)
  const highestSample = Math.max(...samples)
  if (highestSample - lowestSample > FOREHEAD_STABILITY_DEGREES) {
    return null
  }

  return samples.reduce((total, sample) => total + sample, 0) / samples.length
}

export const getFaceTiltDegrees = (
  beta: number | null,
  gamma: number | null,
) => {
  if (beta === null || gamma === null) {
    return null
  }

  const verticalScreenNormal =
    Math.cos(beta * DEGREES_TO_RADIANS) *
    Math.cos(gamma * DEGREES_TO_RADIANS)
  const clampedNormal = Math.max(-1, Math.min(1, verticalScreenNormal))

  return Math.asin(clampedNormal) * RADIANS_TO_DEGREES
}

export const getMotionFaceTiltDegrees = (
  x: number | null,
  y: number | null,
  z: number | null,
) => {
  if (x === null || y === null || z === null) {
    return null
  }

  const gravity = Math.hypot(x, y, z)
  if (gravity < 0.5) {
    return null
  }

  const verticalScreenNormal = Math.max(-1, Math.min(1, z / gravity))
  return Math.asin(verticalScreenNormal) * RADIANS_TO_DEGREES
}

export const getTiltOutcome = (
  offset: number,
): CardOutcome | null => {
  if (offset <= -TILT_TRIGGER_DEGREES) {
    return 'correct'
  }

  if (offset >= TILT_TRIGGER_DEGREES) {
    return 'pass'
  }

  return null
}