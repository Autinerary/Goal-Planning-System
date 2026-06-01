'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Type, Eye, Maximize2, Volume2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

interface AccessibilitySettingsClientProps {
  userId: string
}

type FontSize = 'small' | 'medium' | 'large'
type ContrastMode = 'normal' | 'high'
type MotionPreference = 'normal' | 'reduced'

export default function AccessibilitySettingsClient({ userId }: AccessibilitySettingsClientProps) {
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [contrastMode, setContrastMode] = useState<ContrastMode>('normal')
  const [reducedMotion, setReducedMotion] = useState<MotionPreference>('normal')
  const [screenReaderMode, setScreenReaderMode] = useState(false)

  useEffect(() => {
    // Load saved preferences from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      const savedFontSize = localStorage.getItem('accessibility-font-size') as FontSize
      const savedContrast = localStorage.getItem('accessibility-contrast') as ContrastMode
      const savedMotion = localStorage.getItem('accessibility-motion') as MotionPreference
      const savedScreenReader = localStorage.getItem('accessibility-screen-reader') === 'true'

      if (savedFontSize) setFontSize(savedFontSize)
      if (savedContrast) setContrastMode(savedContrast)
      if (savedMotion) setReducedMotion(savedMotion)
      if (savedScreenReader) setScreenReaderMode(savedScreenReader)

      // Check for system preferences
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion && !savedMotion) {
        setReducedMotion('reduced')
      }
    }
  }, [])

  useEffect(() => {
    // Apply font size
    const root = document.documentElement
    switch (fontSize) {
      case 'small':
        root.style.fontSize = '14px'
        break
      case 'medium':
        root.style.fontSize = '16px'
        break
      case 'large':
        root.style.fontSize = '18px'
        break
    }
    localStorage.setItem('accessibility-font-size', fontSize)
  }, [fontSize])

  useEffect(() => {
    // Apply contrast mode
    const root = document.documentElement
    if (contrastMode === 'high') {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
    localStorage.setItem('accessibility-contrast', contrastMode)
  }, [contrastMode])

  useEffect(() => {
    // Apply reduced motion
    const root = document.documentElement
    if (reducedMotion === 'reduced') {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }
    localStorage.setItem('accessibility-motion', reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    // Apply screen reader mode
    const root = document.documentElement
    if (screenReaderMode) {
      root.classList.add('screen-reader-optimized')
    } else {
      root.classList.remove('screen-reader-optimized')
    }
    localStorage.setItem('accessibility-screen-reader', screenReaderMode.toString())
  }, [screenReaderMode])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to home
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <Maximize2 className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">Accessibility Settings</h1>
            </div>
            <p className="text-gray-600">
              Customize your experience to make ServiceHub more accessible
            </p>
          </div>

          {/* Settings Cards */}
          <div className="space-y-6">
            {/* Font Size */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Type className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Font Size</h2>
                  <p className="text-sm text-gray-600">Adjust the text size throughout the app</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="fontSize"
                    value="small"
                    checked={fontSize === 'small'}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                    className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Small font size"
                  />
                  <span className="text-base">Small (14px)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="fontSize"
                    value="medium"
                    checked={fontSize === 'medium'}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                    className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Medium font size (default)"
                  />
                  <span className="text-base">Medium (16px) - Default</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="fontSize"
                    value="large"
                    checked={fontSize === 'large'}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                    className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Large font size"
                  />
                  <span className="text-base">Large (18px)</span>
                </label>
              </div>
            </div>

            {/* High Contrast */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">High Contrast Mode</h2>
                  <p className="text-sm text-gray-600">
                    Increase color contrast for better visibility
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contrastMode === 'high'}
                  onChange={(e) => setContrastMode(e.target.checked ? 'high' : 'normal')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[44px] min-h-[44px]"
                  aria-label="Enable high contrast mode"
                />
                <span className="text-base">Enable high contrast mode</span>
              </label>
            </div>

            {/* Reduced Motion */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Maximize2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Reduced Motion</h2>
                  <p className="text-sm text-gray-600">
                    Reduce or disable animations and transitions
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reducedMotion === 'reduced'}
                  onChange={(e) => setReducedMotion(e.target.checked ? 'reduced' : 'normal')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[44px] min-h-[44px]"
                  aria-label="Enable reduced motion"
                />
                <span className="text-base">Enable reduced motion</span>
              </label>
              {typeof window !== 'undefined' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches && (
                  <p className="text-sm text-gray-500 mt-2">
                    Your system preference for reduced motion is enabled
                  </p>
                )}
            </div>

            {/* Screen Reader Optimization */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Volume2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Screen Reader Optimization
                  </h2>
                  <p className="text-sm text-gray-600">
                    Optimize the interface for screen readers
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={screenReaderMode}
                  onChange={(e) => setScreenReaderMode(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[44px] min-h-[44px]"
                  aria-label="Enable screen reader optimization"
                />
                <span className="text-base">Enable screen reader optimization</span>
              </label>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Accessibility Features</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Keyboard navigation support throughout the app</li>
              <li>• ARIA labels on all interactive elements</li>
              <li>• Focus indicators for keyboard navigation</li>
              <li>• WCAG AA color contrast standards</li>
              <li>• Alt text on all images</li>
              <li>• Error messages are announced to screen readers</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}