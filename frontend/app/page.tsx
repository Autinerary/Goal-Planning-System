'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, Sparkles, Target, Calendar, Brain, Users, Shield, TrendingUp, Trophy, Zap } from 'lucide-react'

const sunsetStyles = `
  @keyframes walk {
    0%, 100% { transform: translateX(0) translateY(0); }
    25% { transform: translateX(10px) translateY(-5px); }
    50% { transform: translateX(20px) translateY(0); }
    75% { transform: translateX(10px) translateY(-5px); }
  }
  @keyframes jump {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) translateX(0); }
    33% { transform: translateY(-10px) translateX(5px); }
    66% { transform: translateY(-5px) translateX(-5px); }
  }
  @keyframes cloudMove {
    0% { transform: translateX(0); }
    100% { transform: translateX(100vw); }
  }
  @keyframes cloudMoveSlow {
    0% { transform: translateX(0); }
    100% { transform: translateX(100vw); }
  }
  .animal-walk {
    animation: walk 1s ease-in-out infinite;
  }
  .animal-jump {
    animation: jump 0.8s ease-in-out infinite;
  }
  .cloud-float {
    animation: float 6s ease-in-out infinite;
  }
  .cloud-move-1 {
    animation: cloudMove 30s linear infinite;
  }
  .cloud-move-2 {
    animation: cloudMoveSlow 40s linear infinite;
  }
  .cloud-move-3 {
    animation: cloudMove 35s linear infinite;
  }
`

export default function HomePage() {
  const router = useRouter()
  const [animalPositions, setAnimalPositions] = useState([
    { id: 1, x: 5, emoji: '🐰', animation: 'jump' },
    { id: 2, x: 15, emoji: '🐔', animation: 'walk' },
    { id: 3, x: 25, emoji: '🐴', animation: 'walk' },
    { id: 4, x: 35, emoji: '🐶', animation: 'jump' },
    { id: 5, x: 45, emoji: '🐱', animation: 'walk' },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimalPositions(prev => 
        prev.map(animal => ({
          ...animal,
          x: animal.x >= 85 ? 5 : animal.x + 0.5
        }))
      )
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const features = [
    {
      icon: Brain,
      title: 'Barrier-Aware Planning',
      description: 'AI that understands autism, ADHD, OCD, and other systematic barriers'
    },
    {
      icon: Target,
      title: 'Personalized Paths',
      description: 'Custom roadmaps based on what worked for people like you'
    },
    {
      icon: Calendar,
      title: 'Adaptive Scheduling',
      description: 'Schedules that adjust to your energy levels and good/bad days'
    },
    {
      icon: Users,
      title: 'Community Insights',
      description: 'Learn from thousands of journeys from people who faced similar challenges'
    },
  ]

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: sunsetStyles }} />
      
      {/* Sunset Background with Clouds - semi-transparent so global cloud bg shows through */}
      <div className="fixed inset-0 bg-white/20 backdrop-blur-sm z-0">
        {/* Clouds */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="cloud-move-1 absolute top-20 left-0 w-64 h-32 bg-white/30 rounded-full blur-xl cloud-float" />
          <div className="cloud-move-2 absolute top-40 left-0 w-80 h-40 bg-white/25 rounded-full blur-2xl cloud-float" style={{ animationDelay: '2s' }} />
          <div className="cloud-move-3 absolute top-60 left-0 w-72 h-36 bg-white/35 rounded-full blur-xl cloud-float" style={{ animationDelay: '4s' }} />
          <div className="cloud-move-1 absolute top-80 left-0 w-56 h-28 bg-white/30 rounded-full blur-xl cloud-float" style={{ animationDelay: '1s' }} />
          <div className="cloud-move-2 absolute top-32 left-0 w-96 h-48 bg-white/20 rounded-full blur-3xl cloud-float" style={{ animationDelay: '3s' }} />
        </div>
        
        {/* Sun */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-300 rounded-full blur-2xl opacity-80" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-orange-400 rounded-full blur-xl opacity-90" />
      </div>

      {/* Hero Section with Animals Walking to Sunset */}
      <div className="relative z-10">
        {/* Ground/Path */}
        <div className="relative h-64 md:h-80 mt-32 md:mt-40">
          {/* Path */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-r from-green-400 via-green-500 to-green-600 opacity-80" />
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-yellow-300 opacity-60" style={{ bottom: '24px' }} />
          
          {/* Animals Walking */}
          <div className="absolute bottom-20 left-0 right-0" style={{ height: '80px' }}>
            {animalPositions.map(animal => (
              <div
                key={animal.id}
                className={`absolute text-6xl md:text-7xl ${animal.animation === 'jump' ? 'animal-jump' : 'animal-walk'}`}
                style={{ 
                  left: `${animal.x}%`,
                  bottom: '0',
                  transform: 'translateX(-50%)'
                }}
              >
                {animal.emoji}
              </div>
            ))}
          </div>

          {/* Gate at the End */}
          <div className="absolute bottom-0 right-10 md:right-20" style={{ bottom: '24px' }}>
            <div className="text-6xl md:text-8xl">🚪</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-gray-700 rounded" />
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-8 border border-white/30 shadow-lg">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-semibold">Powered by Multi-Agent AI</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight drop-shadow-lg">
              Your Path to Success,
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Designed for You
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 drop-shadow-md">
              Life planning that actually works for people facing systematic barriers. 
              Not generic advice — personalized paths based on what worked for people like you.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 via-pink-500 to-purple-500 hover:from-blue-600 hover:via-pink-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60"
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-white/30 shadow-lg"
              >
                Sign In
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex items-center justify-center gap-6 text-white/80 text-sm drop-shadow-md">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Privacy-first</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-white/60" />
              <div>No credit card required</div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-white/60" />
              <div>Free to start</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats/Races Section with Gradient */}
      <div className="relative z-10 py-20 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">
              Track Your Progress
            </h2>
            <p className="text-white/80 max-w-xl mx-auto">
              See how you're doing across all your races and goals
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Active Races - Blue Gradient */}
            <div className="bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-blue-600/30 backdrop-blur-lg border-2 border-blue-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-500/50 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-blue-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">12</h3>
                  <p className="text-blue-200 text-sm">Active Races</p>
                </div>
              </div>
              <div className="text-blue-100 text-sm">Keep pushing forward!</div>
            </div>

            {/* Completed Milestones - Pink Gradient */}
            <div className="bg-gradient-to-br from-pink-500/30 via-pink-400/20 to-pink-600/30 backdrop-blur-lg border-2 border-pink-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-pink-500/50 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-pink-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">48</h3>
                  <p className="text-pink-200 text-sm">Milestones</p>
                </div>
              </div>
              <div className="text-pink-100 text-sm">You're making great progress!</div>
            </div>

            {/* Current Streak - Purple Gradient */}
            <div className="bg-gradient-to-br from-purple-500/30 via-purple-400/20 to-purple-600/30 backdrop-blur-lg border-2 border-purple-400/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500/50 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">7</h3>
                  <p className="text-purple-200 text-sm">Day Streak</p>
                </div>
              </div>
              <div className="text-purple-100 text-sm">Stay consistent!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-20 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg text-white">
              Built for Neurodivergent Minds
            </h2>
            <p className="text-white/80 max-w-xl mx-auto">
              Six specialized AI agents work together to create plans that actually work for your unique brain.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              const gradients = [
                'from-blue-500/20 to-blue-600/20 border-blue-400/30',
                'from-pink-500/20 to-pink-600/20 border-pink-400/30',
                'from-purple-500/20 to-purple-600/20 border-purple-400/30',
                'from-blue-500/20 via-pink-500/20 to-purple-500/20 border-purple-400/30',
              ]
              const iconColors = [
                'text-blue-300',
                'text-pink-300',
                'text-purple-300',
                'text-purple-300',
              ]
              return (
                <div 
                  key={idx}
                  className={`bg-gradient-to-br ${gradients[idx % gradients.length]} backdrop-blur-lg border-2 rounded-2xl p-6 hover:scale-105 transition-all group shadow-xl`}
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${gradients[idx % gradients.length]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${iconColors[idx % iconColors.length]}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                  <p className="text-white/70 text-sm">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Who It's For Section */}
      <div className="relative z-10 py-20 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg text-white">
              Made for People Like You
            </h2>
            <p className="text-white/80 max-w-xl mx-auto">
              Everyone deserves a path designed for them.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              'Autism', 'ADHD', 'OCD', 'Bipolar', 'Anxiety',
              'Visible Minority', 'First-Generation', 'LGBTQ+',
              'Physical Disability', 'Learning Differences',
              'English as Second Language', 'Chronic Illness'
            ].map((barrier) => (
              <span
                key={barrier}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm text-white hover:bg-white/30 transition-colors shadow-lg"
              >
                {barrier}
              </span>
            ))}
          </div>

          <p className="text-center text-white/70 mt-8 text-sm">
            ...and any combination of barriers. We understand intersectionality.
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative z-10 py-20 border-t border-white/20 bg-white/5 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 drop-shadow-lg text-white">
            Ready to Find Your Path?
          </h2>
          <p className="text-white/80 mb-8">
            It takes just 5 minutes to get started. We'll create a personalized plan based on your goals and the barriers you face.
          </p>
          <button
            onClick={() => router.push('/signup')}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 via-pink-500 to-purple-500 hover:from-blue-600 hover:via-pink-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 py-8 bg-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-400 via-pink-400 to-purple-500 rounded flex items-center justify-center">
                <span className="font-bold text-xs text-white">A</span>
              </div>
              <span className="font-semibold text-white">Autinerary</span>
            </div>
            <div className="text-sm text-white/70">
              © 2026 Autinerary Corp. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
