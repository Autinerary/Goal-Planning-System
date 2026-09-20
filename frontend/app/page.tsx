'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Target, Calendar, Brain, Users, Shield, TrendingUp, Trophy, Zap } from 'lucide-react'

const sunsetStyles = `
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
      <div className="fixed inset-0 z-0 surface-chrome">
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

      {/* Hero Section */}
      <div className="relative z-10">

        {/* Hero Content */}
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center">
            {/*
              Removed the pill that sat above this headline reading "Powered
              by Multi-Agent AI". A rounded badge over the hero is one of the
              most recognisable signs of a template, and the sentence inside
              it was about our architecture rather than about the reader.
              Nobody arrives here wanting a multi-agent system; they arrive
              wanting a plan that fits them.

              The second line also used bg-clip-text over a three-stop
              gradient. Against a photographic background that costs
              legibility for the exact contrast the headline needs, and it is
              the single most copied hero treatment there is. Solid white
              with a shadow reads better and looks chosen.
            */}

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight drop-shadow-lg">
              Your Path to Success,
              <br />
              <span className="text-white">Designed for You</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8 drop-shadow-md">
              Life planning that actually works for people facing systematic barriers. 
              Not generic advice. Personalized paths based on what worked for people like you.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:from-blue-600 hover:via-pink-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60"
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 hover:bg-white/30 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all border border-white/30 shadow-lg surface-veil"
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
      <div className="relative z-10 py-20 border-t border-white/20 surface-veil-dark">
        <div className="max-w-6xl mx-auto px-4">
          {/*
            This was three identical gradient boxes in a row, each with an
            icon tile and a number: 12 Active Races, 48 Milestones, 7 Day
            Streak, under lines like "You're making great progress!".

            Two problems. The triplet of icon boxes is the most copied
            section on the web and says nothing that the words beneath it
            do not. Worse, the numbers were invented and addressed to a
            visitor who does not have an account yet, so the page opened by
            congratulating a stranger on progress they had not made. A
            product whose whole pitch is that it will not hand you generic
            advice should not fabricate your statistics on the way in.

            One panel, no figures, describing what the app actually keeps
            track of.
          */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 drop-shadow-lg">
              What Autinerary keeps track of
            </h2>
            <p className="text-white/80 mb-8">
              Everything here is built from what you do, and nothing is filled in on your behalf.
            </p>

            <div className="surface-veil-dark rounded-2xl p-6 divide-y divide-white/15">
              <div className="flex items-start gap-4 pb-4">
                <Trophy className="w-6 h-6 shrink-0 text-white/80 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-white">Your goals, as races</h3>
                  <p className="text-white/75 text-sm">
                    Each goal becomes a route with its own milestones, so progress is something you
                    can see rather than something you have to remember.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 py-4">
                <Target className="w-6 h-6 shrink-0 text-white/80 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-white">Milestones you have actually finished</h3>
                  <p className="text-white/75 text-sm">
                    Counted from what you tick off. If you have not done anything yet, it says so
                    instead of showing you a number.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 pt-4">
                <Zap className="w-6 h-6 shrink-0 text-white/80 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-white">Streaks that survive a bad week</h3>
                  <p className="text-white/75 text-sm">
                    Turning up counts. Streak freezes mean missing a day does not wipe out the
                    weeks behind it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-20 border-t border-white/20 surface-veil-dark">
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
      <div className="relative z-10 py-20 border-t border-white/20 surface-veil-dark">
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
                className="px-4 py-2 border border-white/30 rounded-full text-sm text-white hover:bg-white/30 transition-colors shadow-lg surface-veil"
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
      <div className="relative z-10 py-20 border-t border-white/20 surface-veil-dark">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 drop-shadow-lg text-white">
            Ready to Find Your Path?
          </h2>
          <p className="text-white/80 mb-8">
            It takes just 5 minutes to get started. We'll create a personalized plan based on your goals and the barriers you face.
          </p>
          <button
            onClick={() => router.push('/signup')}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:from-blue-600 hover:via-pink-600 hover:to-purple-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-all shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 py-8 surface-veil-dark">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded flex items-center justify-center">
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
