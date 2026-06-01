'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function TaskView() {
  const router = useRouter()
  const params = useParams()
  const [completed, setCompleted] = useState(false)

  const helperTricks = [
    '- Mentality Trick/',
    '  ADHD Trick/',
    '  ... Trick or Quote',
  ]

  const handleDone = () => {
    setCompleted(true)
    setTimeout(() => {
      router.push('/calendar')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-6">5. Task View</h1>

      <div className="border-2 border-black rounded-lg p-6 max-w-2xl">
        {/* Task Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold underline">Task:</h2>
          <div className="h-px bg-black w-32 mx-auto mt-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Fun Animation */}
          <div className="flex flex-col items-center">
            <div className="text-sm italic mb-2">(Fun Animation)</div>
            {/* Stick figure */}
            <svg viewBox="0 0 60 100" className="w-24 h-32">
              <circle cx="30" cy="15" r="12" fill="none" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="27" x2="30" y2="60" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="40" x2="10" y2="55" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="40" x2="50" y2="55" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="60" x2="15" y2="90" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="60" x2="45" y2="90" stroke="black" strokeWidth="2"/>
            </svg>
          </div>

          {/* Right: Helper Screen */}
          <div className="border-l-2 border-black pl-4">
            <h3 className="font-bold underline mb-2">Helper Screen</h3>
            <div className="space-y-1 text-sm mb-4">
              {helperTricks.map((trick, idx) => (
                <div key={idx}>{trick}</div>
              ))}
            </div>
            <button className="border-2 border-black px-3 py-1 rounded text-sm hover:bg-gray-100">
              Generate Another
            </button>
          </div>
        </div>

        {/* Today's Motivation */}
        <div className="mt-6 mb-6">
          <span className="font-bold">Today's Motivation:</span>
          <span className="ml-2">_____________</span>
        </div>

        {/* Done Button */}
        <div className="text-center mb-4">
          <button
            onClick={handleDone}
            disabled={completed}
            className={`border-2 border-black px-6 py-2 rounded font-bold ${
              completed ? 'bg-green-200' : 'hover:bg-gray-100'
            }`}
          >
            {completed ? '✓ Done!' : 'Done?'}
          </button>
        </div>

        {/* Journal Button */}
        <div className="text-center">
          <Link 
            href={`/reflection?contextType=task&contextId=${params.id}`}
            className="inline-block border-2 border-black px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Journal / Reflection Window
          </Link>
        </div>

        {/* Note */}
        <div className="mt-6 text-sm italic text-gray-600 text-center">
          (THIS, and any "Journal / Reflection Window" button)
        </div>
      </div>
    </div>
  )
}
