'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Sparkles, Target, Calendar, Brain, Users, Shield } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-8 border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">Powered by Multi-Agent AI</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Your Path to Success,
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Designed for You
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
              Life planning that actually works for people facing systematic barriers. 
              Not generic advice — personalized paths based on what worked for people like you.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-white/20"
              >
                Sign In
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex items-center justify-center gap-6 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Privacy-first</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
              <div>No credit card required</div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
              <div>Free to start</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative py-20 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Neurodivergent Minds
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Six specialized AI agents work together to create plans that actually work for your unique brain.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div 
                  key={idx}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Who It's For Section */}
      <div className="relative py-20 border-t border-white/10 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Made for People Like You
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
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
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300 hover:bg-white/10 transition-colors"
              >
                {barrier}
              </span>
            ))}
          </div>

          <p className="text-center text-slate-500 mt-8 text-sm">
            ...and any combination of barriers. We understand intersectionality.
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative py-20 border-t border-white/10">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Find Your Path?
          </h2>
          <p className="text-slate-400 mb-8">
            It takes just 5 minutes to get started. We'll create a personalized plan based on your goals and the barriers you face.
          </p>
          <button
            onClick={() => router.push('/signup')}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded flex items-center justify-center">
                <span className="font-bold text-xs">A</span>
              </div>
              <span className="font-semibold">Autinerary</span>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 Autinerary Corp. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
