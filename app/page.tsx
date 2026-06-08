'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'proposal' | 'yes' | 'when' | 'vibes' | 'confirm'
interface Choices { dates: string[]; vibes: string[] }

// ─── Shared helpers ───────────────────────────────────────────────────────────
const cardVariants = {
  enter:  { opacity: 0, y: 28, scale: 0.96 },
  center: { opacity: 1, y: 0,  scale: 1    },
  exit:   { opacity: 0, y: -28, scale: 0.96 },
}
const spring = { type: 'spring' as const, stiffness: 290, damping: 26 }

const glass: React.CSSProperties = {
  background: 'rgba(255,248,238,0.62)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.5)',
}

const btnDisabled: React.CSSProperties = {
  background: '#F3F4F6',
  color: '#9CA3AF',
  cursor: 'not-allowed',
}

// ─── Haptics ────────────────────────────────────────────────────────────────
// Graceful no-op where the Vibration API is unsupported (e.g. iOS Safari).
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* ignore */ }
  }
}
const TAP = 10                 // light tap on selection
const STEP_OK: number[] = [12, 18, 12]  // advance to next step
const YES_BUZZ: number[] = [18, 40, 28] // the "sì"
const PARTY: number[] = [22, 45, 22, 45, 55] // confirm celebration

// ─── Date helpers (dynamic week navigation) ──────────────────────────────────
const DOW_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const
const WEEK_SECTION_OFFSETS = [0, 1] as const

function getCurrentMonday(): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

function capShortMonth(date: Date): string {
  return date.toLocaleDateString('it-IT', { month: 'short' })
    .replace(/\.$/, '')
    .replace(/^\w/, c => c.toUpperCase())
}

function weekRangeLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const sm = capShortMonth(monday)
  const em = capShortMonth(sunday)
  return sm === em
    ? `${monday.getDate()} – ${sunday.getDate()} ${em}`
    : `${monday.getDate()} ${sm} – ${sunday.getDate()} ${em}`
}

function buildWeekDays(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${y}-${mo}-${day}`
    return { key, dow: DOW_IT[i], num: d.getDate(), mon: capShortMonth(d), special: key === '2026-06-13' }
  })
}

function formatDateLabel(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// ─── Sunflower Background — SVG + Framer Motion ─────────────────────────────
// Each sunflower is a proper SVG (same design as creailtuobot/SunflowerDecoration)
// rotated via Framer Motion animate={{ rotate: 360 }} — always works, no CSS hacks
function SunflowerSVG({ size = 120, opacity = 0.07 }: { size?: number; opacity?: number }) {
  const N = 13  // Fibonacci petal count
  const cx = 120, cy = 120
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      aria-hidden="true"
      focusable="false"
      style={{ opacity }}
    >
      {/* 13 petals */}
      {Array.from({ length: N }, (_, i) => (
        <ellipse
          key={i}
          cx={cx} cy={cy - 80} rx={20} ry={52}
          fill="#E8C46A"
          transform={`rotate(${(360 / N) * i}, ${cx}, ${cy})`}
        />
      ))}
      {/* Center disk */}
      <circle cx={cx} cy={cy} r={47} fill="#2C1A0E" />
      {/* Outer seed ring — 21 dots */}
      {Array.from({ length: 21 }, (_, i) => {
        const a = ((360 / 21) * i - 90) * (Math.PI / 180)
        return (
          <circle key={`o${i}`}
            cx={cx + 36 * Math.cos(a)} cy={cy + 36 * Math.sin(a)}
            r={2.8} fill="#4A2E18" />
        )
      })}
      {/* Middle seed ring — 13 dots */}
      {Array.from({ length: 13 }, (_, i) => {
        const a = ((360 / 13) * i - 90) * (Math.PI / 180)
        return (
          <circle key={`m${i}`}
            cx={cx + 24 * Math.cos(a)} cy={cy + 24 * Math.sin(a)}
            r={3.2} fill="#3D2510" />
        )
      })}
      {/* Inner seed ring — 8 dots */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = ((360 / 8) * i - 90) * (Math.PI / 180)
        return (
          <circle key={`in${i}`}
            cx={cx + 13 * Math.cos(a)} cy={cy + 13 * Math.sin(a)}
            r={2.8} fill="#30200E" />
        )
      })}
      <circle cx={cx} cy={cy} r={5} fill="#1E1208" />
    </svg>
  )
}

const BG_SUNS: Array<{
  id: number
  pos: React.CSSProperties
  size: number
  opacity: number
  duration: number
}> = [
  { id: 0, pos: { top:  '-60px',  left:  '-60px'   }, size: 200, opacity: 0.22, duration: 30 },
  { id: 1, pos: { top:  '-40px',  right: '-50px'   }, size: 160, opacity: 0.18, duration: 24 },
  { id: 2, pos: { bottom: '-70px', left: '-65px'   }, size: 230, opacity: 0.26, duration: 36 },
  { id: 3, pos: { bottom: '-50px', right: '-55px'  }, size: 185, opacity: 0.22, duration: 28 },
  { id: 4, pos: { top:    '38%',  left:  '-55px'   }, size: 135, opacity: 0.16, duration: 21 },
  { id: 5, pos: { top:    '28%',  right: '-45px'   }, size: 115, opacity: 0.15, duration: 19 },
  { id: 6, pos: { top:     '8px', left:   '40%'    }, size:  80, opacity: 0.13, duration: 14 },
  { id: 7, pos: { bottom:  '8px', left:   '43%'    }, size:  90, opacity: 0.14, duration: 17 },
]

function SunflowerBg() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {BG_SUNS.map((s) => (
        <motion.div
          key={s.id}
          className="absolute select-none"
          style={s.pos}
          animate={{ rotate: 360 }}
          transition={{ duration: s.duration, repeat: Infinity, ease: 'linear' }}
        >
          <SunflowerSVG size={s.size} opacity={s.opacity} />
        </motion.div>
      ))}
    </div>
  )
}

// ─── Confetti (confirm screen) ────────────────────────────────────────────────
// Continuous stream that rises, sways and spins for the whole confirm screen.
const CONFETTI = ['💛','🌻','💕','🌻','💛','💕','🌻','✨','🌻','🧡','🌻','💕','🌻','💛','✨','🌻','💕','🧡','🌻']

function FloatingConfetti() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {CONFETTI.map((h, i) => (
        <span
          key={i}
          className="absolute float-heart select-none"
          style={{
            left:   (3 + i * 4.7) + '%',
            bottom: '-8%',
            fontSize: 16 + (i % 4) * 6,
            ['--hdur'   as string]: (3.2 + (i % 4) * 0.8) + 's',
            ['--hdelay' as string]: ((i % 7) * 0.42) + 's',
            ['--hsway'  as string]: ((i % 2 ? 1 : -1) * (16 + (i % 3) * 14)) + 'px',
            ['--hrot'   as string]: ((i % 2 ? 1 : -1) * (140 + (i % 4) * 90)) + 'deg',
          }}
        >
          {h}
        </span>
      ))}
    </div>
  )
}

// One-shot radial burst from the center — fires once when the confirm card mounts.
const BURST_EMOJI = ['🌻','💛','💕','✨','🌻','🧡','🌻','💛','🌻','💕','✨','🌻','🧡','🌻','💛','🌻','💕','🌻']

function ConfettiBurst() {
  const pieces = useMemo(() =>
    BURST_EMOJI.map((emoji, i) => {
      const angle = (360 / BURST_EMOJI.length) * i + (Math.random() * 26 - 13)
      const dist  = 130 + Math.random() * 170
      const rad   = (angle * Math.PI) / 180
      return {
        id: i,
        emoji,
        x:   Math.cos(rad) * dist,
        y:   Math.sin(rad) * dist,
        rot: Math.random() * 560 - 280,
        size: 20 + Math.random() * 18,
        dur:  0.85 + Math.random() * 0.55,
      }
    }), [])

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 40 }}
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none"
          style={{ fontSize: p.size }}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: 1, opacity: [0, 1, 1, 0], rotate: p.rot }}
          transition={{ duration: p.dur, ease: 'easeOut' }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — PROPOSAL
// ─────────────────────────────────────────────────────────────────────────────
function ProposalStep({ onYes }: { onYes: () => void }) {
  const noRef = useRef<HTMLButtonElement>(null)
  const yesRef = useRef<HTMLButtonElement>(null)
  const [flying, setFlying]     = useState(false)
  const [initPos, setInitPos]   = useState({ x: 0, y: 0 })
  const [flyPos, setFlyPos]     = useState({ x: 0, y: 0 })
  const [attempts, setAttempts] = useState(0)

  const escape = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bw = 145, bh = 58, margin = 20
    // Reserve a no-fly zone at the top so the button never covers the
    // message banner. Taller on mobile, where the banner wraps to 2-3 lines.
    const topSafe = vw < 640 ? 170 : 120

    if (!flying && noRef.current) {
      const r = noRef.current.getBoundingClientRect()
      setInitPos({ x: r.left, y: r.top })
      setFlying(true)
    }

    const curX = flying ? flyPos.x : (noRef.current?.getBoundingClientRect().left ?? vw / 2)
    const curY = flying ? flyPos.y : (noRef.current?.getBoundingClientRect().top  ?? vh / 2)

    // Vertical span available below the top no-fly zone.
    const ySpan = Math.max(vh - bh - topSafe - margin, 0)

    // No-fly zone around the "sì" button so the flying button never lands on
    // top of it (otherwise tapping it would accidentally trigger "sì").
    const pad = 28
    const yr = yesRef.current?.getBoundingClientRect()
    const overlapsYes = (x: number, y: number) =>
      !!yr &&
      x < yr.right + pad && x + bw > yr.left - pad &&
      y < yr.bottom + pad && y + bh > yr.top - pad

    let nx = 0, ny = 0, tries = 0
    do {
      nx = margin + Math.random() * (vw - bw - margin * 2)
      ny = topSafe + Math.random() * ySpan
      tries++
    } while (
      tries < 30 &&
      ((Math.abs(nx - curX) < 100 && Math.abs(ny - curY) < 70) || overlapsYes(nx, ny))
    )

    setFlyPos({ x: nx, y: ny })
    setAttempts(a => a + 1)
    vibrate(8) // tiny buzz as it darts away
  }, [flying, flyPos])

  const msgs = [
    '',
    'il forse non abita qui 👀',
    'dai señorita, non ci provare 😏',
    'inutile scappare 🌻',
    'il dubbio non esiste 😌',
    'ormai è deciso, ci vediamo 💕',
    'ancora? proprio sicura? 😅',
    'questo bottone non si clicca, mai 😇',
    'ti voglio bene lo stesso 💛',
    'però smettila dai 🌻',
    'ok ma ci vediamo lo stesso eh 😌',
    'stai solo perdendo tempo 👀',
  ]

  return (
    <>
      {/* Floating message banner — top-center, large and prominent */}
      <AnimatePresence mode="wait">
        {attempts > 0 && (
          <motion.div
            key={attempts}
            initial={{ opacity: 0, y: -50, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="fixed top-5 left-0 right-0 flex justify-center pointer-events-none"
            style={{ zIndex: 60 }}
          >
            <div
              className="px-8 py-4 rounded-2xl"
              style={{
                background: 'rgba(255,248,238,0.97)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '2.5px solid #F5C842',
                boxShadow: '0 8px 32px rgba(245,200,66,0.22), 0 2px 10px rgba(0,0,0,0.07)',
              }}
            >
              <p
                className="text-xl font-bold text-center"
                style={{ color: '#3B1A08', fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}
              >
                {msgs[attempts === 0 ? 0 : ((attempts - 1) % (msgs.length - 1)) + 1]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {flying && (
        <motion.button
          initial={{ x: initPos.x, y: initPos.y }}
          animate={{ x: flyPos.x, y: flyPos.y }}
          transition={{ type: 'spring', stiffness: 250, damping: 22 }}
          onMouseEnter={escape}
          onTouchStart={(e) => { e.preventDefault(); escape() }}
          onClick={(e)       => { e.preventDefault(); escape() }}
          className="fixed top-0 left-0 z-[70] select-none cursor-default rounded-full px-7 py-4 text-base font-semibold shadow-lg"
          style={{ background: '#EDE9FE', color: '#7C3AED' }}
        >
          Cliccami se riesci 🙈
        </motion.button>
      )}

      <motion.div
        variants={cardVariants}
        initial="enter" animate="center" exit="exit"
        transition={spring}
        className="w-full max-w-[440px] mx-auto px-5"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="rounded-3xl shadow-2xl px-10 py-12 text-center" style={glass}>

          {/* Photo — replace src */}
          <motion.div
            className="w-32 h-32 mx-auto mb-6 rounded-2xl overflow-hidden shadow-xl"
            style={{ outline: '4px solid #F5C842', outlineOffset: 3 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src="https://media.giphy.com/media/vFKqnCdLPNOKc/giphy.gif"
              alt="foto"
              className="w-full h-full object-cover"
            />
          </motion.div>



          <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: '#F5C842' }}>
            señorita 🌻
          </p>

          <h1
            className="text-[2.6rem] leading-[1.15] font-extrabold mb-10"
            style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif', color: '#3B1A08', letterSpacing: '-0.01em' }}
          >
            Ana, questa o la prossima settimana usciamo.
          </h1>

          <div className="flex items-center justify-center gap-4 min-h-[60px]">
            <motion.button
              ref={yesRef}
              onClick={() => { vibrate(YES_BUZZ); onYes() }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="rounded-full font-bold text-lg text-white shadow-lg"
              style={{ background: '#FF91A4', padding: '14px 44px' }}
            >
              sì 🌻
            </motion.button>

            {!flying && (
              <button
                ref={noRef}
                onMouseEnter={escape}
                onTouchStart={(e) => { e.preventDefault(); escape() }}
                onClick={(e)       => { e.preventDefault(); escape() }}
                className="rounded-full font-semibold select-none cursor-default"
                style={{ background: '#EDE9FE', color: '#7C3AED', padding: '14px 28px', fontSize: 16 }}
              >
                Cliccami se riesci 🙈
              </button>
            )}
          </div>

        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — YES REACTION
// ─────────────────────────────────────────────────────────────────────────────
function YesStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="enter" animate="center" exit="exit"
      transition={spring}
      className="w-full max-w-[420px] mx-auto px-5"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="rounded-3xl shadow-2xl px-10 py-12 text-center" style={glass}>

        {/* GIF — replace src */}
        <motion.div
          className="w-28 h-28 mx-auto mb-7 rounded-2xl overflow-hidden shadow-lg"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img
            src="https://media.giphy.com/media/xL7PDV9frcudO/giphy.gif"
            alt="reazione"
            className="w-full h-full object-cover"
          />
        </motion.div>

        <h2
          className="text-[2rem] font-extrabold leading-tight mb-2"
          style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif', color: '#3B1A08' }}
        >
          lo sapevo 🌻
        </h2>
        <p className="text-sm italic mb-9" style={{ color: '#9CA3AF' }}>
          ci voleva così poco 😜
        </p>

        <motion.button
          onClick={() => { vibrate(STEP_OK); onNext() }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          className="rounded-full font-semibold text-base text-white shadow-md"
          style={{ background: '#FF91A4', padding: '14px 40px' }}
        >
          okay okay! →
        </motion.button>

      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — WHEN
// ─────────────────────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  { key: 'pranzo',    label: 'Pranzo',    emoji: '🌞' },
  { key: 'aperitivo', label: 'Aperitivo', emoji: '🥂' },
  { key: 'cena',      label: 'Cena',      emoji: '🌙' },
]

function WhenStep({ onNext }: { onNext: (dates: string[]) => void }) {
  const [selDates, setSelDates] = useState<string[]>([])

  const baseMonday = useMemo(() => getCurrentMonday(), [])
  const weeks = useMemo(
    () => WEEK_SECTION_OFFSETS.map((offset) => {
      const monday = addWeeks(baseMonday, offset)
      return {
        key: monday.toISOString().slice(0, 10),
        label: weekRangeLabel(monday),
        days: buildWeekDays(monday),
      }
    }),
    [baseMonday]
  )

  const ready = selDates.length > 0
  const toggle = (key: string) => { vibrate(TAP); setSelDates(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }

  return (
    <motion.div
      variants={cardVariants}
      initial="enter" animate="center" exit="exit"
      transition={spring}
      className="w-full max-w-[420px] mx-auto px-5"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="rounded-3xl shadow-2xl px-8 py-9" style={glass}>

        <div className="text-center mb-6">
          <span className="text-4xl">📅 🌻</span>
          <h2
            className="text-2xl font-extrabold mt-2"
            style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif', color: '#3B1A08' }}
          >
            okay. ora dimmi quando preferisci
          </h2>
        </div>

        {weeks.map((week) => (
          <div key={week.key} className="mb-3 last:mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>
              {week.label}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {week.days.map((d) => (
                <button
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  className="relative flex flex-col items-center py-2 rounded-xl text-[10px] leading-tight transition-all duration-150"
                  style={
                    selDates.includes(d.key)
                      ? { background: '#F5C842', color: '#fff', fontWeight: 700, transform: 'scale(1.1)', boxShadow: '0 4px 12px rgba(245,200,66,0.3)' }
                      : d.special
                      ? { background: '#FFF3CD', color: '#3B1A08', border: '1.5px solid #F5C842' }
                      : { background: '#F9F9F9', color: '#4B5563' }
                  }
                >
                  {d.special && (
                    <span className="absolute -top-1.5 -right-1 text-[10px] leading-none">✨</span>
                  )}
                  <span className="capitalize font-medium">{d.dow}</span>
                  <span className="text-sm font-bold mt-0.5">{d.num}</span>
                  <span className="capitalize opacity-60">{d.mon}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Event hint — shown when Jun 13 is selected */}
        <AnimatePresence>
          {selDates.includes('2026-06-13') && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-4"
            >
              <div
                className="flex items-start gap-3 rounded-2xl px-4 py-3"
                style={{ background: '#FFFBEB', border: '1.5px solid #F5C842' }}
              >
                <span className="text-xl mt-0.5">🎶</span>
                <div>
                  <p className="text-xs font-extrabold" style={{ color: '#3B1A08', fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}>
                    Disco Euphoria
                  </p>
                  <p className="text-[11px] leading-snug" style={{ color: '#6B5240' }}>
                    Laghetti di Campogalliano — potrebbe essere una serata... interessante 😉
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => { if (ready) { vibrate(STEP_OK); onNext(selDates) } }}
          disabled={!ready}
          animate={ready ? { y: [0, -6, 0] } : { y: 0 }}
          transition={ready ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : {}}
          whileHover={ready ? { scale: 1.03 } : {}}
          whileTap={ready   ? { scale: 0.97 } : {}}
          className="w-full py-4 rounded-full font-semibold text-base transition-all duration-200"
          style={ready ? { background: '#FF91A4', color: '#fff' } : btnDisabled}
        >
          {ready ? `perfetto, ${selDates.length} ${selDates.length === 1 ? 'giorno' : 'giorni'} 🌻` : 'scegli almeno un giorno'}
        </motion.button>

      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — VIBES (merged food + activity, multi-select)
// ─────────────────────────────────────────────────────────────────────────────
const VIBES = [
  { key: 'pizza',       label: 'Pizza',       emoji: '🍕' },
  { key: 'sushi',       label: 'Sushi',       emoji: '🍣' },
  { key: 'pasta',       label: 'Pasta',       emoji: '🍝' },
  { key: 'burger',      label: 'Burger',      emoji: '🍔' },
  { key: 'aperitivo',   label: 'Aperitivo',   emoji: '🥂' },
  { key: 'gelato',      label: 'Gelato',      emoji: '🍦' },
  { key: 'bowling',     label: 'Bowling',     emoji: '🎳' },
  { key: 'picnic',      label: 'Picnic',      emoji: '🧺' },
  { key: 'passeggiata', label: 'Passeggiata', emoji: '🌿' },
  { key: 'cinema',      label: 'Cinema',      emoji: '🎬' },
  { key: 'discoteca',   label: 'Disco',       emoji: '🎶' },
  { key: 'marelago',    label: 'Mare/Lago',   emoji: '🏖️' },
]

function VibesStep({ onNext }: { onNext: (vibes: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([])

  const toggle = (key: string) => {
    vibrate(TAP)
    setSel(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="enter" animate="center" exit="exit"
      transition={spring}
      className="w-full max-w-[420px] mx-auto px-5"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="rounded-3xl shadow-2xl px-8 py-9" style={glass}>

        <h2
          className="text-2xl font-extrabold text-center mb-1"
          style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif', color: '#3B1A08' }}
        >
          adesso scegli. io organizzo 🌻
        </h2>
        <p className="text-[11px] text-center mb-5" style={{ color: '#9CA3AF' }}>
          le tue preferenze segnorita — anche tutto 🌻
        </p>

        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {VIBES.map((v) => {
            const active = sel.includes(v.key)
            return (
              <motion.button
                key={v.key}
                onClick={() => toggle(v.key)}
                whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl transition-all duration-150"
                style={
                  active
                    ? { background: '#FF91A4', boxShadow: '0 4px 14px rgba(255,145,164,0.35)' }
                    : { background: '#F3F0FF' }
                }
              >
                <span className="text-2xl leading-none">{v.emoji}</span>
                <span
                  className="text-[11px] font-bold leading-tight"
                  style={{ color: active ? '#fff' : '#374151' }}
                >
                  {v.label}
                </span>
              </motion.button>
            )
          })}
        </div>

        <motion.button
          onClick={() => { if (sel.length > 0) { vibrate(STEP_OK); onNext(sel) } }}
          disabled={sel.length === 0}
          animate={sel.length > 0 ? { y: [0, -6, 0] } : { y: 0 }}
          transition={sel.length > 0 ? { duration: 3.0, repeat: Infinity, ease: 'easeInOut' } : {}}
          whileHover={sel.length > 0 ? { scale: 1.03 } : {}}
          whileTap={sel.length > 0   ? { scale: 0.97 } : {}}
          className="w-full py-4 rounded-full font-semibold text-base transition-all duration-200"
          style={sel.length > 0 ? { background: '#FF91A4', color: '#fff' } : btnDisabled}
        >
          {sel.length > 0 ? `perfetto, ${sel.length} scelt${sel.length === 1 ? 'a' : 'e'} 🌻` : 'scegli almeno una cosa'}
        </motion.button>

      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — CONFIRM
// ─────────────────────────────────────────────────────────────────────────────
const VIBE_EMOJI: Record<string, string> = Object.fromEntries(VIBES.map(v => [v.key, v.emoji]))
const VIBE_LABEL: Record<string, string> = Object.fromEntries(VIBES.map(v => [v.key, v.label]))

function ConfirmStep({ choices }: { choices: Choices }) {
  const dateLabels = choices.dates.map(formatDateLabel)

  const [sent, setSent] = useState(false)
  const sentRef = useRef(false)

  const confirm = useCallback(() => {
    if (sentRef.current) return // guard against double-tap
    sentRef.current = true
    setSent(true)
    vibrate(PARTY) // celebration buzz on confirm
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dates: dateLabels,
        vibes: choices.vibes.map(k => VIBE_LABEL[k] ?? k),
      }),
    }).catch(() => { /* silent: Ana never sees a failure */ })
  }, [dateLabels, choices.vibes])

  return (
    <>
      {sent && <FloatingConfetti />}
      {sent && <ConfettiBurst />}

      <motion.div
        initial={{ opacity: 0, scale: 0.80 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 230, damping: 22 }}
        className="w-full max-w-[420px] mx-auto px-5"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="rounded-3xl shadow-2xl px-8 py-10 text-center" style={glass}>

          {/* Closing GIF — replace src */}
          <motion.div
            className="w-24 h-24 mx-auto mb-5 rounded-full overflow-hidden shadow-lg"
            style={{ outline: '4px solid #F5C842', outlineOffset: 3 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src="https://media.giphy.com/media/DfLwM9kttDFEQ/giphy.gif"
              alt="placeholder"
              className="w-full h-full object-cover"
            />
          </motion.div>

          <h2
            className="text-[2rem] font-extrabold leading-tight mb-1"
            style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif', color: '#3B1A08' }}
          >
            {sent ? 'è deciso señorita 🌻' : 'ecco il riepilogo 🌻'}
          </h2>
          <p className="text-sm italic mb-6" style={{ color: '#9CA3AF' }}>
            {sent ? 'ci vediamo presto 😏' : 'tanto lo so che confermi 🙈'}
          </p>

          <div
            className="rounded-2xl p-4 text-left mb-6"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📅</span>
              <div className="flex flex-col gap-0.5">
                {dateLabels.map(l => (
                  <p key={l} className="font-semibold text-sm capitalize" style={{ color: '#3B1A08' }}>{l}</p>
                ))}
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>le vibes</p>
            <div className="flex flex-wrap gap-2">
              {choices.vibes.map(k => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: '#FF91A4', color: '#fff' }}
                >
                  {VIBE_EMOJI[k]} {VIBE_LABEL[k]}
                </span>
              ))}
            </div>
          </div>

          {!sent ? (
            <motion.button
              onClick={confirm}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full py-4 rounded-full font-bold text-base text-white shadow-lg"
              style={{ background: '#FF91A4' }}
            >
              conferma 🌻
            </motion.button>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-[13px] italic leading-relaxed"
              style={{ color: '#C4C9D1' }}
            >
              non dire che non ci provo 🌻
            </motion.p>
          )}

        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS DOTS
// ─────────────────────────────────────────────────────────────────────────────
const PROGRESS_STEPS: Step[] = ['when', 'vibes']

function ProgressDots({ step }: { step: Step }) {
  if (!PROGRESS_STEPS.includes(step)) return null
  const cur = PROGRESS_STEPS.indexOf(step)
  return (
    <div
      className="fixed top-5 left-0 right-0 flex justify-center gap-2 pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {PROGRESS_STEPS.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: i === cur ? 1.5 : 1,
            backgroundColor: i <= cur ? '#FF91A4' : '#E5E7EB',
          }}
          transition={{ duration: 0.22 }}
          style={{ width: 8, height: 8, borderRadius: '50%' }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const EQ_BARS = [
  { dur: 0.55, delay: 0    },
  { dur: 0.45, delay: 0.12 },
  { dur: 0.65, delay: 0.25 },
  { dur: 0.50, delay: 0.08 },
]

function MusicIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.3 }}
      className="fixed bottom-5 right-4 flex items-center gap-2 px-3 py-2 rounded-full select-none"
      style={{
        background: 'rgba(255,248,238,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1.5px solid rgba(245,200,66,0.55)',
        boxShadow: '0 4px 18px rgba(245,200,66,0.22)',
        zIndex: 50,
      }}
    >
      {/* Equalizer bars */}
      <div className="flex items-end gap-[3px]" style={{ height: 16 }}>
        {EQ_BARS.map((b, i) => (
          <motion.div
            key={i}
            style={{ width: 3, height: 16, background: '#F5C842', borderRadius: 2, originY: 1 }}
            animate={{ scaleY: [0.25, 1, 0.25] }}
            transition={{ duration: b.dur, repeat: Infinity, delay: b.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-extrabold" style={{ color: '#3B1A08' }}>La Bamba 🎵</span>
        <span className="text-[9px] font-medium" style={{ color: '#9CA3AF' }}>alza il volume 😏</span>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DateProposal() {
  const [step, setStep]       = useState<Step>('proposal')
  const [choices, setChoices] = useState<Partial<Choices>>({})
  const [audioStarted, setAudioStarted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio('/audio/la-bamba.mp3')
    audioRef.current.volume = 0.75
    audioRef.current.loop = true
    return () => { audioRef.current?.pause() }
  }, [])

  return (
    <main
      className="relative overflow-hidden flex items-center justify-center"
      style={{ minHeight: '100svh' }}
    >
      <SunflowerBg />
      <ProgressDots step={step} />
      {audioStarted && <MusicIndicator />}

      <div
        className="relative w-full py-16 flex items-center justify-center"
        style={{ minHeight: '100svh', zIndex: 10 }}
      >
        <AnimatePresence mode="wait">

          {step === 'proposal' && (
            <ProposalStep
              key="proposal"
              onYes={() => {
                audioRef.current?.play().catch(() => {})
                setAudioStarted(true)
                setStep('yes')
              }}
            />
          )}

          {step === 'yes' && (
            <YesStep key="yes" onNext={() => setStep('when')} />
          )}

          {step === 'when' && (
            <WhenStep
              key="when"
              onNext={(dates) => {
                setChoices(c => ({ ...c, dates }))
                fetch('/api/notify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'dates_selected',
                    dates: dates.map(formatDateLabel),
                  }),
                }).catch(() => {})
                setStep('vibes')
              }}
            />
          )}

          {step === 'vibes' && (
            <VibesStep
              key="vibes"
              onNext={(vibes) => {
                setChoices(c => ({ ...c, vibes }))
                setStep('confirm')
                fetch('/api/notify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'reached_confirm',
                    vibes: vibes.map(k => VIBE_LABEL[k] ?? k),
                  }),
                }).catch(() => {})
              }}
            />
          )}

          {step === 'confirm' &&
            choices.dates?.length && choices.vibes?.length && (
              <ConfirmStep key="confirm" choices={choices as Choices} />
            )}

        </AnimatePresence>
      </div>
    </main>
  )
}
