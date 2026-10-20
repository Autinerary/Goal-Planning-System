'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * The person's character driving a little race car, for "You are here" on
 * the track (Liam, October 2026: "for the track view could we have a car
 * with the person inside of it? And when there is a task done it beeps?").
 * `honk` goes up by one each time a step is done: the car bounces and says
 * "Beep beep!" (the sound is lib/taskSound.ts playCarBeep). Still for anyone
 * who asked for less motion.
 */
export default function CharacterCar({ character, honk = 0, size = 64 }: { character: ReactNode; honk?: number; size?: number }) {
  const [bouncing, setBouncing] = useState(false)
  useEffect(() => {
    if (!honk) return
    setBouncing(true)
    const t = setTimeout(() => setBouncing(false), 1400)
    return () => clearTimeout(t)
  }, [honk])

  const h = Math.round(size * 0.625)
  return (
    <span className="relative inline-block align-middle" style={{ width: size, height: h }} data-character-car>
      <style>{`
        @keyframes carHonk{0%,100%{transform:translateY(0)}20%{transform:translateY(-4px) rotate(-3deg)}40%{transform:translateY(0)}60%{transform:translateY(-3px) rotate(2deg)}80%{transform:translateY(0)}}
        .car-honk{animation:carHonk .7s ease-in-out 2}
        @media(prefers-reduced-motion:reduce){.car-honk{animation:none}}
        html[data-reduce-motion="on"] .car-honk{animation:none}
      `}</style>
      <span className={`absolute inset-0 ${bouncing ? 'car-honk' : ''}`}>
        {/* The driver, sitting in an open cockpit: the body covers below the shoulders. */}
        <span className="absolute flex justify-center" style={{ left: size * 0.28, top: -h * 0.12, width: size * 0.4 }}>
          {character}
        </span>
        <svg viewBox="0 0 64 40" width={size} height={h} className="absolute inset-0" aria-hidden="true">
          <path
            d="M4 27 C4 23 8 21 12 21 L20 21 L24 17 L42 17 L46 21 L54 21 C58 21 61 24 61 28 L61 31 C61 33 60 34 58 34 L6 34 C4.6 34 4 33 4 31 Z"
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Windshield, a stripe and a headlight. */}
          <path d="M42 17 L45 11" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M8 26 L56 26" stroke="#fecaca" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="58" cy="28" r="1.6" fill="#fde68a" />
          <circle cx="15" cy="34" r="6" fill="#1f2937" />
          <circle cx="15" cy="34" r="2.4" fill="#cbd5e1" />
          <circle cx="49" cy="34" r="6" fill="#1f2937" />
          <circle cx="49" cy="34" r="2.4" fill="#cbd5e1" />
        </svg>
      </span>
      {bouncing && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-2 py-0.5 text-[0.625rem] font-black text-slate-900 shadow" aria-hidden="true">
          Beep beep!
        </span>
      )}
    </span>
  )
}
