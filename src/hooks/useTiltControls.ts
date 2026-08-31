import { useEffect, useEffectEvent, useState } from 'react'
import type { CardOutcome } from '../game/round'
import {
  getFaceTiltDegrees,
  getMotionFaceTiltDegrees,
  getTiltOutcome,
  TILT_NEUTRAL_DEGREES,
} from '../game/tilt'

export type SensorPermission =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'insecure'

interface SensorEventConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const CALIBRATION_SAMPLES = 8
const ACTION_COOLDOWN_MS = 650

export const requestMotionPermission = async (): Promise<SensorPermission> => {
  const constructors: SensorEventConstructorWithPermission[] = []

  if ('DeviceOrientationEvent' in window) {
    constructors.push(
      DeviceOrientationEvent as unknown as SensorEventConstructorWithPermission,
    )
  }

  if ('DeviceMotionEvent' in window) {
    constructors.push(
      DeviceMotionEvent as unknown as SensorEventConstructorWithPermission,
    )
  }

  if (!constructors.length) {
    return window.isSecureContext ? 'unavailable' : 'insecure'
  }

  const explicitRequests = constructors.filter(
    (eventConstructor) =>
      typeof eventConstructor.requestPermission === 'function',
  )

  if (explicitRequests.length < constructors.length) {
    return 'granted'
  }

  if (!window.isSecureContext) {
    return 'insecure'
  }

  try {
    const results = await Promise.all(
      explicitRequests.map((eventConstructor) =>
        eventConstructor.requestPermission!(),
      ),
    )
    return results.includes('granted') ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

interface UseTiltControlsOptions {
  enabled: boolean
  actionsEnabled?: boolean
  debugEnabled?: boolean
  onAction: (outcome: CardOutcome) => void
}

export interface TiltTelemetry {
  source: 'orientation' | 'motion'
  beta: number | null
  gamma: number | null
  gravityY: number | null
  gravityZ: number | null
  faceTilt: number
  baseline: number | null
  offset: number | null
  calibrationSamples: number
  armed: boolean
}

export const useTiltControls = ({
  enabled,
  actionsEnabled = enabled,
  debugEnabled = false,
  onAction,
}: UseTiltControlsOptions) => {
  const [sensorReady, setSensorReady] = useState(false)
  const [telemetry, setTelemetry] = useState<TiltTelemetry | null>(null)
  const [calibrationVersion, setCalibrationVersion] = useState(0)
  const onTiltAction = useEffectEvent(onAction)
  const canTriggerAction = useEffectEvent(() => actionsEnabled)
  const publishTelemetry = useEffectEvent((snapshot: TiltTelemetry) => {
    if (debugEnabled) {
      setTelemetry(snapshot)
    }
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    let baseline: number | null = null
    let calibrationTotal = 0
    let calibrationCount = 0
    let armed = true
    let lastActionAt = 0
    let lastTelemetryAt = 0
    let activeSource: TiltTelemetry['source'] | null = null
    let lastOrientationAt = 0
    const monitoringStartedAt = performance.now()

    const resetCalibration = () => {
      baseline = null
      calibrationTotal = 0
      calibrationCount = 0
      armed = true
      setSensorReady(false)
    }

    const reportTelemetry = (
      source: TiltTelemetry['source'],
      faceTilt: number,
      offset: number | null,
      raw: Pick<
        TiltTelemetry,
        'beta' | 'gamma' | 'gravityY' | 'gravityZ'
      >,
      force = false,
    ) => {
      const now = performance.now()
      if (!force && now - lastTelemetryAt < 80) {
        return
      }

      lastTelemetryAt = now
      publishTelemetry({
        source,
        ...raw,
        faceTilt,
        baseline,
        offset,
        calibrationSamples: calibrationCount,
        armed,
      })
    }

    const processSample = (
      source: TiltTelemetry['source'],
      axis: number,
      raw: Pick<
        TiltTelemetry,
        'beta' | 'gamma' | 'gravityY' | 'gravityZ'
      >,
    ) => {
      if (axis === null) {
        return
      }

      if (baseline === null) {
        calibrationTotal += axis
        calibrationCount += 1

        if (calibrationCount >= CALIBRATION_SAMPLES) {
          baseline = calibrationTotal / calibrationCount
          setSensorReady(true)
          reportTelemetry(source, axis, axis - baseline, raw, true)
        } else {
          reportTelemetry(source, axis, null, raw)
        }
        return
      }

      const offset = axis - baseline

      if (!canTriggerAction()) {
        reportTelemetry(source, axis, offset, raw)
        return
      }

      if (!armed) {
        if (Math.abs(offset) <= TILT_NEUTRAL_DEGREES) {
          armed = true
          reportTelemetry(source, axis, offset, raw, true)
        } else {
          reportTelemetry(source, axis, offset, raw)
        }
        return
      }

      if (Date.now() - lastActionAt < ACTION_COOLDOWN_MS) {
        reportTelemetry(source, axis, offset, raw)
        return
      }

      const outcome = getTiltOutcome(offset)
      if (outcome) {
        armed = false
        lastActionAt = Date.now()
        onTiltAction(outcome)
        reportTelemetry(source, axis, offset, raw, true)
      } else {
        reportTelemetry(source, axis, offset, raw)
      }
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const axis = getFaceTiltDegrees(event.beta, event.gamma)
      if (axis === null) {
        return
      }

      lastOrientationAt = performance.now()
      activeSource ??= 'orientation'
      if (activeSource !== 'orientation') {
        return
      }

      processSample('orientation', axis, {
        beta: event.beta,
        gamma: event.gamma,
        gravityY: null,
        gravityZ: null,
      })
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      const axis = getMotionFaceTiltDegrees(
        acceleration?.x ?? null,
        acceleration?.y ?? null,
        acceleration?.z ?? null,
      )
      if (axis === null) {
        return
      }

      const now = performance.now()
      if (activeSource === null) {
        if (now - monitoringStartedAt < 500) {
          return
        }
        activeSource = 'motion'
      } else if (
        activeSource === 'orientation' &&
        now - lastOrientationAt > 1200
      ) {
        activeSource = 'motion'
        resetCalibration()
      }

      if (activeSource !== 'motion') {
        return
      }

      processSample('motion', axis, {
        beta: null,
        gamma: null,
        gravityY: acceleration?.y ?? null,
        gravityZ: acceleration?.z ?? null,
      })
    }

    window.addEventListener('deviceorientation', handleOrientation)
    window.addEventListener('devicemotion', handleMotion)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('devicemotion', handleMotion)
      setSensorReady(false)
      setTelemetry(null)
    }
  }, [calibrationVersion, enabled])

  return {
    sensorReady,
    telemetry,
    recalibrate: () => setCalibrationVersion((version) => version + 1),
  }
}