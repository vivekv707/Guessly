import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bug,
  Check,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Crosshair,
  Download,
  Earth,
  Hand,
  Medal,
  PartyPopper,
  PawPrint,
  Play,
  RotateCcw,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import './guessly.css'
import { decks, getDeckById, type Deck, type DeckIcon } from './data/decks'
import {
  countCorrect,
  createRound,
  finishRound,
  markCard,
  tickRound,
  type CardOutcome,
  type RoundState,
} from './game/round'
import {
  TILT_NEUTRAL_DEGREES,
  TILT_TRIGGER_DEGREES,
} from './game/tilt'
import {
  requestMotionPermission,
  useTiltControls,
  type SensorPermission,
  type TiltTelemetry,
} from './hooks/useTiltControls'
import { playFeedback, primeFeedbackAudio } from './lib/feedback'

type Screen = 'home' | 'setup' | 'ready' | 'countdown' | 'round' | 'results'
interface GameSettings {
  duration: number
  sound: boolean
  haptics: boolean
}

interface GameStats {
  rounds: number
  best: number
  totalCorrect: number
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type DeckStyle = CSSProperties & {
  '--deck-color': string
  '--deck-soft': string
}

const SETTINGS_KEY = 'guessly:settings'
const STATS_KEY = 'guessly:stats'
const defaultSettings: GameSettings = {
  duration: 60,
  sound: true,
  haptics: true,
}
const defaultStats: GameStats = { rounds: 0, best: 0, totalCorrect: 0 }
const TILT_METER_RANGE = 35

const readStoredValue = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}

const getDeckStyle = (deck: Deck): DeckStyle => ({
  '--deck-color': deck.color,
  '--deck-soft': deck.softColor,
})

const DeckGlyph = ({ icon, size = 28 }: { icon: DeckIcon; size?: number }) => {
  const icons = {
    spark: Sparkles,
    screen: Clapperboard,
    wild: PawPrint,
    world: Earth,
    action: Hand,
  }
  const Icon = icons[icon]
  return <Icon aria-hidden="true" size={size} strokeWidth={2.2} />
}

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <div className={`brand${compact ? ' brand--compact' : ''}`} aria-label="Guessly">
    <span className="brand__mark" aria-hidden="true">
      <Sparkles size={compact ? 17 : 20} strokeWidth={2.6} />
    </span>
    <span className="brand__name">Guessly</span>
  </div>
)

const IconButton = ({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick: () => void
}) => (
  <button
    className="icon-button"
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
  >
    {children}
  </button>
)

const Toggle = ({
  checked,
  onChange,
  label,
  detail,
  icon,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  detail: string
  icon: ReactNode
}) => (
  <div className="setting-row">
    <span className="setting-row__icon" aria-hidden="true">
      {icon}
    </span>
    <span className="setting-row__copy">
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
    <button
      className="toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  </div>
)

const Confetti = () => (
  <div className="confetti" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => (
      <i key={index} style={{ '--piece': index } as CSSProperties} />
    ))}
  </div>
)

const formatDegrees = (value: number | null) => {
  if (value === null) {
    return '--'
  }

  const normalizedValue = Math.abs(value) < 0.05 ? 0 : value
  const prefix = normalizedValue > 0 ? '+' : ''
  return `${prefix}${normalizedValue.toFixed(1)} deg`
}

const formatAcceleration = (value: number | null) => {
  if (value === null) {
    return '--'
  }

  const normalizedValue = Math.abs(value) < 0.05 ? 0 : value
  const prefix = normalizedValue > 0 ? '+' : ''
  return `${prefix}${normalizedValue.toFixed(1)} m/s2`
}

const TiltDebugger = ({
  telemetry,
  sensorReady,
  permission,
  onRecalibrate,
}: {
  telemetry: TiltTelemetry | null
  sensorReady: boolean
  permission: SensorPermission
  onRecalibrate: () => void
}) => {
  const offset = telemetry?.offset ?? 0
  const meterPosition = Math.max(
    0,
    Math.min(100, 50 + (offset / (TILT_METER_RANGE * 2)) * 100),
  )
  const thresholdOffset =
    (TILT_TRIGGER_DEGREES / (TILT_METER_RANGE * 2)) * 100
  const isCentered = Math.abs(offset) <= TILT_NEUTRAL_DEGREES
  const blockedStatus =
    permission === 'insecure'
      ? 'HTTP blocks sensors'
      : permission === 'denied'
        ? 'Permission denied'
        : permission === 'unavailable'
          ? 'No sensor API'
          : null
  const status = blockedStatus
    ? blockedStatus
    : !sensorReady
      ? `Calibrating ${telemetry?.calibrationSamples ?? 0}/8`
    : !telemetry?.armed
      ? 'Return to center'
      : isCentered
        ? 'Centered and armed'
        : offset < 0
          ? 'Moving down'
          : 'Moving up'
  const meterStyle = {
    '--tilt-position': `${meterPosition}%`,
    '--correct-threshold': `${50 - thresholdOffset}%`,
    '--pass-threshold': `${50 + thresholdOffset}%`,
  } as CSSProperties

  return (
    <aside className="tilt-debugger" aria-label="Tilt debugger">
      <div className="tilt-debugger__heading">
        <span>
          <Bug size={15} /> Tilt debugger
          <em>{telemetry?.source ?? 'waiting'}</em>
        </span>
        <strong
          className={
            sensorReady && telemetry?.armed ? 'is-armed' : 'is-waiting'
          }
        >
          {status}
        </strong>
        <button
          type="button"
          onClick={onRecalibrate}
          aria-label="Recenter tilt controls"
          title="Hold steady, then recenter"
        >
          <Crosshair size={14} /> Recenter
        </button>
      </div>

      <div className="tilt-debugger__meter-row" style={meterStyle}>
        <small>Got it</small>
        <div className="tilt-meter" aria-hidden="true">
          <i className="tilt-meter__threshold tilt-meter__threshold--correct" />
          <i className="tilt-meter__center" />
          <i className="tilt-meter__threshold tilt-meter__threshold--pass" />
          <span className="tilt-meter__needle" />
        </div>
        <small>Pass</small>
      </div>

      <div className="tilt-debugger__readouts">
        <span>
          <small>Relative</small>
          <b>{formatDegrees(telemetry?.offset ?? null)}</b>
        </span>
        <span>
          <small>Face</small>
          <b>{formatDegrees(telemetry?.faceTilt ?? null)}</b>
        </span>
        <span>
          <small>{telemetry?.source === 'motion' ? 'Gravity Y' : 'Beta'}</small>
          <b>
            {telemetry?.source === 'motion'
              ? formatAcceleration(telemetry.gravityY)
              : formatDegrees(telemetry?.beta ?? null)}
          </b>
        </span>
        <span>
          <small>{telemetry?.source === 'motion' ? 'Gravity Z' : 'Gamma'}</small>
          <b>
            {telemetry?.source === 'motion'
              ? formatAcceleration(telemetry.gravityZ)
              : formatDegrees(telemetry?.gamma ?? null)}
          </b>
        </span>
      </div>
    </aside>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0].id)
  const [settings, setSettings] = useState<GameSettings>(() =>
    readStoredValue(SETTINGS_KEY, defaultSettings),
  )
  const [stats, setStats] = useState<GameStats>(() =>
    readStoredValue(STATS_KEY, defaultStats),
  )
  const [round, setRound] = useState<RoundState | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [motionPermission, setMotionPermission] =
    useState<SensorPermission>('unknown')
  const [lastOutcome, setLastOutcome] = useState<CardOutcome | null>(null)
  const [showTiltDebugger, setShowTiltDebugger] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [toast, setToast] = useState('')
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const roundRecordedRef = useRef(false)
  const selectedDeck = getDeckById(selectedDeckId)

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  }, [stats])

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => setInstallPrompt(null)

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (screen !== 'countdown') {
      return
    }

    const timer = window.setTimeout(
      () => {
        if (countdown > 0) {
          setCountdown((value) => value - 1)
          return
        }

        roundRecordedRef.current = false
        setRound(createRound(selectedDeck.words, settings.duration))
        setScreen('round')
      },
      countdown > 0 ? 800 : 350,
    )

    return () => window.clearTimeout(timer)
  }, [countdown, screen, selectedDeck.words, settings.duration])

  useEffect(() => {
    if (screen !== 'round' || round?.status !== 'playing') {
      return
    }

    const timer = window.setInterval(() => {
      setRound((current) => (current ? tickRound(current) : current))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [round?.status, screen])

  const leaveGameMode = async () => {
    await wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
    window.screen.orientation?.unlock?.()

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    if (
      screen !== 'round' ||
      round?.status !== 'finished' ||
      roundRecordedRef.current
    ) {
      return
    }

    roundRecordedRef.current = true
    const score = countCorrect(round)
    setStats((current) => ({
      rounds: current.rounds + 1,
      best: Math.max(current.best, score),
      totalCorrect: current.totalCorrect + score,
    }))

    const timer = window.setTimeout(() => {
      void leaveGameMode()
      setScreen('results')
    }, 450)

    return () => window.clearTimeout(timer)
  }, [round, screen])

  useEffect(() => {
    if (!showHowTo) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowHowTo(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showHowTo])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const handleCardAction = (outcome: CardOutcome) => {
    if (screen !== 'round' || round?.status !== 'playing') {
      return
    }

    playFeedback(outcome, settings.sound, settings.haptics)
    setLastOutcome(outcome)
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current)
    }
    feedbackTimerRef.current = window.setTimeout(
      () => setLastOutcome(null),
      420,
    )
    setRound((current) => (current ? markCard(current, outcome) : current))
  }

  const handleKeyboardAction = useEffectEvent(handleCardAction)

  useEffect(() => {
    if (screen !== 'round') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault()
        handleKeyboardAction('correct')
      } else if (event.key === 'ArrowUp' || event.key === 'Backspace') {
        event.preventDefault()
        handleKeyboardAction('pass')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen])

  const { sensorReady, telemetry, recalibrate } = useTiltControls({
    enabled:
      screen === 'countdown' ||
      (screen === 'round' && round?.status === 'playing'),
    actionsEnabled: screen === 'round' && round?.status === 'playing',
    debugEnabled: showTiltDebugger,
    onAction: handleCardAction,
  })

  const selectDeck = (deckId: string) => {
    setSelectedDeckId(deckId)
    setScreen('setup')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const prepareCountdown = async () => {
    const permissionPromise = requestMotionPermission()
    const fullscreenPromise = document.documentElement.requestFullscreen
      ? document.documentElement.requestFullscreen().catch(() => undefined)
      : Promise.resolve()

    await primeFeedbackAudio(settings.sound).catch(() => undefined)
    const permission = await permissionPromise
    await fullscreenPromise
    setMotionPermission(permission)

    await window.screen.orientation
      ?.lock?.('landscape')
      .catch(() => undefined)
    wakeLockRef.current =
      (await navigator.wakeLock?.request('screen').catch(() => null)) ?? null

    setCountdown(3)
    setScreen('countdown')
  }

  const endRound = () => {
    setRound((current) => (current ? finishRound(current) : current))
  }

  const goHome = () => {
    setRound(null)
    setScreen('home')
  }

  const installApp = async () => {
    if (!installPrompt) {
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  const shareScore = async () => {
    if (!round) {
      return
    }
    const score = countCorrect(round)
    const text = `I got ${score} right in ${selectedDeck.title} on Guessly. Your turn!`

    if (navigator.share) {
      await navigator
        .share({ title: 'My Guessly score', text })
        .catch(() => undefined)
      return
    }

    try {
      await navigator.clipboard?.writeText(text)
      showToast('Score copied')
    } catch {
      showToast('Sharing is unavailable')
    }
  }

  const renderTopbar = (backAction?: () => void) => (
    <header className="topbar">
      {backAction ? (
        <IconButton label="Go back" onClick={backAction}>
          <ArrowLeft size={20} />
        </IconButton>
      ) : (
        <Brand />
      )}
      {backAction && <Brand compact />}
      <div className="topbar__actions">
        {installPrompt && !backAction && (
          <button
            className="header-action"
            type="button"
            onClick={() => void installApp()}
          >
            <Download size={18} />
            <span>Install</span>
          </button>
        )}
        <IconButton label="How to play" onClick={() => setShowHowTo(true)}>
          <CircleHelp size={20} />
        </IconButton>
      </div>
    </header>
  )

  const renderHome = () => (
    <div className="app-shell screen-enter">
      {renderTopbar()}
      <main>
        <section className="home-intro">
          <div className="home-intro__copy">
            <p className="eyebrow">
              <Zap size={15} /> Five decks. Zero paywalls.
            </p>
            <h1>
              Pick the vibe.<br />
              <span>Start guessing.</span>
            </h1>
            <p className="lede">
              One phone, a room of friends, and sixty very loud seconds.
            </p>
          </div>
          <div className="quick-stats" aria-label="Your Guessly stats">
            <span className="quick-stats__icon">
              <Trophy size={24} />
            </span>
            <span>
              <small>Your best</small>
              <strong>{stats.rounds ? stats.best : 'Ready?'}</strong>
            </span>
            <i />
            <span>
              <small>Rounds</small>
              <strong>{stats.rounds}</strong>
            </span>
          </div>
        </section>

        <section className="deck-section" aria-labelledby="deck-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Choose a deck</p>
              <h2 id="deck-heading">What are we guessing?</h2>
            </div>
            <span>{decks.length} ready to play</span>
          </div>
          <div className="deck-grid">
            {decks.map((deck, index) => (
              <button
                className="deck-card"
                style={getDeckStyle(deck)}
                type="button"
                key={deck.id}
                onClick={() => selectDeck(deck.id)}
              >
                <span className="deck-card__art" aria-hidden="true">
                  <span className="deck-card__number">0{index + 1}</span>
                  <span className="deck-card__glyph">
                    <DeckGlyph icon={deck.icon} size={42} />
                  </span>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="deck-card__body">
                  <small>{deck.eyebrow}</small>
                  <strong>{deck.title}</strong>
                  <span>{deck.description}</span>
                  <span className="deck-card__meta">
                    {deck.words.length} cards
                    <ChevronRight size={19} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <button
          className="howto-strip"
          type="button"
          onClick={() => setShowHowTo(true)}
        >
          <span className="howto-strip__icon">
            <Smartphone size={27} />
          </span>
          <span>
            <strong>New to the forehead thing?</strong>
            <small>It takes ten seconds to learn.</small>
          </span>
          <ChevronRight size={21} />
        </button>
      </main>
      <footer>
        <Brand compact />
        <span>Made for the room you are in.</span>
      </footer>
    </div>
  )

  const renderSetup = () => (
    <div
      className="app-shell screen-enter"
      style={getDeckStyle(selectedDeck)}
    >
      {renderTopbar(() => setScreen('home'))}
      <main className="setup-main">
        <section className="deck-spotlight">
          <div className="deck-spotlight__art" aria-hidden="true">
            <span>
              <DeckGlyph icon={selectedDeck.icon} size={78} />
            </span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="section-kicker">{selectedDeck.eyebrow}</p>
          <h1>{selectedDeck.title}</h1>
          <p>{selectedDeck.description}</p>
          <div className="deck-spotlight__facts">
            <span>{selectedDeck.words.length} cards</span>
            <span>Best with 3+</span>
          </div>
        </section>

        <section className="round-setup" aria-labelledby="setup-heading">
          <div className="round-setup__heading">
            <span>
              <Settings2 size={21} />
            </span>
            <div>
              <p className="section-kicker">Round setup</p>
              <h2 id="setup-heading">Make it yours</h2>
            </div>
          </div>

          <div className="duration-setting">
            <div>
              <strong>Round time</strong>
              <small>How long can you handle?</small>
            </div>
            <div className="segmented" aria-label="Round duration">
              {[30, 60, 90].map((duration) => (
                <button
                  className={settings.duration === duration ? 'is-active' : ''}
                  type="button"
                  key={duration}
                  onClick={() =>
                    setSettings((value) => ({ ...value, duration }))
                  }
                  aria-pressed={settings.duration === duration}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>

          <Toggle
            checked={settings.sound}
            onChange={(sound) =>
              setSettings((value) => ({ ...value, sound }))
            }
            label="Sound"
            detail="Tiny dings, dramatic buzzes"
            icon={
              settings.sound ? <Volume2 size={21} /> : <VolumeX size={21} />
            }
          />
          <Toggle
            checked={settings.haptics}
            onChange={(haptics) =>
              setSettings((value) => ({ ...value, haptics }))
            }
            label="Haptics"
            detail="Feel every correct answer"
            icon={<Smartphone size={21} />}
          />

          <button
            className="primary-button"
            type="button"
            onClick={() => setScreen('ready')}
          >
            <Play size={21} fill="currentColor" />
            Play this deck
          </button>
        </section>
      </main>

      <section className="rule-ribbon" aria-label="How a round works">
        <span>
          <b>1</b>
          <small>Friend gives clues</small>
        </span>
        <i />
        <span>
          <b>2</b>
          <small>You guess</small>
        </span>
        <i />
        <span>
          <b>3</b>
          <small>Tilt and score</small>
        </span>
      </section>
    </div>
  )

  const renderReady = () => (
    <div className="ready-screen screen-enter" style={getDeckStyle(selectedDeck)}>
      <div className="ready-screen__top">
        <IconButton
          label="Back to deck setup"
          onClick={() => setScreen('setup')}
        >
          <ArrowLeft size={21} />
        </IconButton>
        <Brand compact />
        <span />
      </div>
      <div className="ready-screen__content">
        <div className="phone-demo" aria-hidden="true">
          <span className="phone-demo__arrow phone-demo__arrow--up">
            <ArrowUp />
          </span>
          <div className="phone-demo__phone">
            <span>
              GUESS
              <br />
              ME
            </span>
          </div>
          <span className="phone-demo__arrow phone-demo__arrow--down">
            <ArrowDown />
          </span>
        </div>
        <p className="section-kicker">Phone to forehead</p>
        <h1>
          Turn sideways.
          <br />
          Hold it steady.
        </h1>
        <div className="tilt-legend">
          <span>
            <ArrowDown size={22} />
            <b>Tilt down</b>
            <small>Got it</small>
          </span>
          <i />
          <span>
            <ArrowUp size={22} />
            <b>Tilt up</b>
            <small>Pass</small>
          </span>
        </div>
        <button
          className="primary-button primary-button--light"
          type="button"
          onClick={() => void prepareCountdown()}
        >
          <Check size={22} />
          I'm ready
        </button>
        <small className="ready-screen__note">
          Touch controls stay on as a backup.
        </small>
      </div>
    </div>
  )

  const renderCountdown = () => (
    <div className="countdown-screen" style={getDeckStyle(selectedDeck)}>
      <Brand compact />
      <div key={countdown} className="countdown-screen__number">
        {countdown || 'GO!'}
      </div>
      <p>{countdown ? 'Hold steady...' : 'Start guessing!'}</p>
    </div>
  )

  const renderRound = () => {
    if (!round) {
      return null
    }

    const currentWord = round.cards[round.currentIndex] ?? ''
    const score = countCorrect(round)
    const progress = `${(round.secondsLeft / round.duration) * 100}%`
    const sensorLabel =
      motionPermission === 'insecure'
        ? 'HTTP blocks tilt'
        : motionPermission === 'denied'
          ? 'Motion denied'
          : motionPermission === 'unavailable'
            ? 'No motion sensor'
        : sensorReady
          ? 'Tilt ready'
          : 'Hold steady...'

    return (
      <div
        className={`round-screen${lastOutcome ? ` is-${lastOutcome}` : ''}`}
        style={getDeckStyle(selectedDeck)}
      >
        <div className="round-screen__pattern" aria-hidden="true" />
        <header className="round-hud">
          <div className="round-hud__tools">
            <button
              className="round-hud__exit"
              type="button"
              onClick={endRound}
              aria-label="End round"
              title="End round"
            >
              <X size={22} />
            </button>
            <button
              className="round-hud__debug"
              type="button"
              onClick={() => setShowTiltDebugger((visible) => !visible)}
              aria-label="Toggle tilt debugger"
              aria-pressed={showTiltDebugger}
              title="Toggle tilt debugger"
            >
              <Bug size={19} />
            </button>
          </div>
          <div className="round-timer">
            <Clock3 size={20} />
            <strong>{round.secondsLeft}</strong>
            <span>sec</span>
          </div>
          <div className="round-score">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
        </header>
        <div className="round-progress" aria-hidden="true">
          <span style={{ width: progress }} />
        </div>

        <main className="word-stage" aria-live="polite">
          <p>{selectedDeck.title}</p>
          <h1>{currentWord}</h1>
          <span className={`sensor-status${sensorReady ? ' is-ready' : ''}`}>
            <i /> {sensorLabel}
          </span>
          {showTiltDebugger && (
            <TiltDebugger
              telemetry={telemetry}
              sensorReady={sensorReady}
              permission={motionPermission}
              onRecalibrate={recalibrate}
            />
          )}
        </main>

        <div className="round-actions">
          <button
            className="round-action round-action--pass"
            type="button"
            onClick={() => handleCardAction('pass')}
          >
            <ArrowUp size={24} />
            <span>
              <small>Tilt up</small>
              <strong>Pass</strong>
            </span>
          </button>
          <button
            className="round-action round-action--correct"
            type="button"
            onClick={() => handleCardAction('correct')}
          >
            <span>
              <small>Tilt down</small>
              <strong>Got it</strong>
            </span>
            <ArrowDown size={24} />
          </button>
        </div>

        {lastOutcome && (
          <div className="answer-flash" aria-hidden="true">
            {lastOutcome === 'correct' ? (
              <Check size={74} />
            ) : (
              <RotateCcw size={68} />
            )}
          </div>
        )}
      </div>
    )
  }

  const renderResults = () => {
    if (!round) {
      return null
    }

    const score = countCorrect(round)
    return (
      <div
        className="app-shell results-shell screen-enter"
        style={getDeckStyle(selectedDeck)}
      >
        <Confetti />
        {renderTopbar(goHome)}
        <main className="results-main">
          <section className="score-hero">
            <p className="section-kicker">Round complete</p>
            <div className="score-orbit">
              <span>{score}</span>
              <small>correct</small>
            </div>
            <h1>
              {score >= 10
                ? 'That was electric.'
                : score >= 5
                  ? 'Nicely played.'
                  : "Now you're warmed up."}
            </h1>
            <p>
              {selectedDeck.title} | {settings.duration} second round
            </p>
            <div className="score-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setScreen('ready')}
              >
                <RotateCcw size={20} /> Play again
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void shareScore()}
              >
                <Share2 size={20} /> Share score
              </button>
            </div>
          </section>

          <section className="round-review" aria-labelledby="review-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">The tape</p>
                <h2 id="review-heading">Every guess</h2>
              </div>
              <span>{round.results.length} played</span>
            </div>
            {round.results.length ? (
              <ul className="result-list">
                {round.results.map((result, index) => (
                  <li key={`${result.word}-${index}`}>
                    <span
                      className={
                        result.outcome === 'correct' ? 'is-correct' : 'is-pass'
                      }
                    >
                      {result.outcome === 'correct' ? (
                        <Check size={18} />
                      ) : (
                        <ArrowUp size={18} />
                      )}
                    </span>
                    <strong>{result.word}</strong>
                    <small>
                      {result.outcome === 'correct' ? 'Got it' : 'Passed'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-review">
                <PartyPopper size={28} />
                <span>No guesses this time. The rematch is right there.</span>
              </div>
            )}
          </section>

          <section className="lifetime-stats" aria-label="Lifetime stats">
            <span>
              <Medal size={22} />
              <small>Best round</small>
              <strong>{stats.best}</strong>
            </span>
            <i />
            <span>
              <Sparkles size={22} />
              <small>Total correct</small>
              <strong>{stats.totalCorrect}</strong>
            </span>
            <i />
            <span>
              <Trophy size={22} />
              <small>Rounds played</small>
              <strong>{stats.rounds}</strong>
            </span>
          </section>
        </main>
      </div>
    )
  }

  return (
    <>
      {screen === 'home' && renderHome()}
      {screen === 'setup' && renderSetup()}
      {screen === 'ready' && renderReady()}
      {screen === 'countdown' && renderCountdown()}
      {screen === 'round' && renderRound()}
      {screen === 'results' && renderResults()}

      {showHowTo && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowHowTo(false)}
        >
          <section
            className="howto-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="howto-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <span>
                <Smartphone size={24} />
              </span>
              <div>
                <p className="section-kicker">Quick start</p>
                <h2 id="howto-title">How to play</h2>
              </div>
              <IconButton label="Close" onClick={() => setShowHowTo(false)}>
                <X size={20} />
              </IconButton>
            </div>
            <ol className="howto-list">
              <li>
                <b>1</b>
                <span>
                  <strong>Pick a deck</strong>
                  <small>Choose a topic your group will know.</small>
                </span>
              </li>
              <li>
                <b>2</b>
                <span>
                  <strong>Phone on your forehead</strong>
                  <small>
                    Your friends describe the card. No saying the answer.
                  </small>
                </span>
              </li>
              <li>
                <b>3</b>
                <span>
                  <strong>Tilt to keep moving</strong>
                  <small>Down when you get it. Up when you want to pass.</small>
                </span>
              </li>
            </ol>
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowHowTo(false)}
            >
              Got it
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

export default App
