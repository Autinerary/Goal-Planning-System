'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, BookOpen, Star, ChevronRight, Wrench, MessageSquare, Package, Lightbulb } from 'lucide-react'

// Mock milestone data for demonstration
const mockMilestones: Record<string, any> = {
  'current': {
    id: 'current',
    name: 'Request Accommodations',
    description: 'Connect with your school\'s disability office to request accommodations that will help you succeed.',
    status: 'in_progress',
    race: 'Graduate University',
    progress: 45,
    nextSteps: [
      'Find disability office contact info',
      'Prepare documentation',
      'Schedule initial meeting',
      'Submit formal request'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'University Disability Office', description: 'Free support and accommodations for students with disabilities', rating: 4.5, progress: 65, status: 'in_progress' },
      { id: 't2', type: 'service', name: 'CADDAC Support Line', description: 'Guidance on accommodation requests for ADHD', url: 'https://caddac.ca', rating: 4.7, progress: 30, status: 'in_progress' },
      { id: 't3', type: 'commentary', name: 'How to Request Accommodations (Video)', description: 'Step-by-step guide from an autistic student who succeeded', url: '#', rating: 4.9 },
      { id: 't4', type: 'commentary', name: 'Accommodation Letter Template', description: 'Sample letter format that has worked for others', rating: 4.6 },
      { id: 't5', type: 'product', name: 'Tiimo App', description: 'Visual planner to track your accommodation request steps', url: 'https://tiimo.dk', rating: 4.8 },
      { id: 't6', type: 'other', name: 'r/disability_support', description: 'Reddit community for advice on accommodation requests', url: 'https://reddit.com', rating: 4.4 },
    ]
  },
  'choice_1': {
    id: 'choice_1',
    name: 'Early Accommodation Request',
    description: 'Request accommodations at the start of your program for best results.',
    status: 'recommended',
    successRate: 90,
    attempts: 1000,
    tools: [
      { id: 't1', type: 'service', name: 'Academic Advisor', description: 'Help navigating the accommodation process', rating: 4.3 },
      { id: 't2', type: 'commentary', name: 'First-Week Accommodation Tips', description: 'What to do in your first week', rating: 4.7 },
    ]
  },
  'choice_2': {
    id: 'choice_2',
    name: 'Join Study Group',
    description: 'Find a supportive study group with peers who understand neurodivergent needs.',
    status: 'recommended',
    successRate: 89,
    attempts: 101,
    tools: [
      { id: 't1', type: 'service', name: 'Focusmate', description: 'Virtual coworking with accountability partners', url: 'https://focusmate.com', rating: 4.6 },
      { id: 't2', type: 'other', name: 'Discord Study Servers', description: 'ND-friendly study communities', rating: 4.5 },
    ]
  },
  // Race 1 Choices (Autism + Parent + Black + Canadian)
  'r1c1': {
    id: 'r1c1',
    name: 'Early Accommodation Request',
    description: 'Request accommodations at the start of your program. Works especially well for autistic individuals who benefit from clear structures early on.',
    status: 'recommended',
    race: 'Race 1',
    successRate: 90,
    attempts: 1000,
    nextSteps: [
      'Contact disability services before classes start',
      'Gather diagnostic documentation',
      'Request quiet testing environment',
      'Set up regular check-ins'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Autism Canada Support', description: 'National resources for autistic adults in education', url: 'https://autismcanada.org', rating: 4.8 },
      { id: 't2', type: 'service', name: 'University Disability Office', description: 'Free support and accommodations', rating: 4.5 },
      { id: 't3', type: 'commentary', name: 'Autism & University Success Stories', description: 'Video series from autistic graduates', url: '#', rating: 4.9 },
      { id: 't4', type: 'product', name: 'Tiimo App', description: 'Visual daily planner designed for neurodivergent minds', url: 'https://tiimo.dk', rating: 4.8 },
      { id: 't5', type: 'other', name: 'r/AutisticAdults', description: 'Community support and advice', url: 'https://reddit.com/r/AutisticAdults', rating: 4.6 },
    ]
  },
  'r1c2': {
    id: 'r1c2',
    name: 'Find Autism-Friendly Study Environment',
    description: 'Identify sensory-friendly spaces on campus that support your learning style.',
    status: 'recommended',
    race: 'Race 1',
    successRate: 89,
    attempts: 101,
    nextSteps: [
      'Map out quiet study spaces on campus',
      'Request access to low-stimulation rooms',
      'Set up consistent study schedule',
      'Create sensory toolkit'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Campus Library Quiet Rooms', description: 'Book private study rooms for focused work', rating: 4.4 },
      { id: 't2', type: 'product', name: 'Loop Earplugs', description: 'Reduce noise without blocking it completely', url: 'https://loopearplugs.com', rating: 4.7 },
      { id: 't3', type: 'product', name: 'Fidget Cube', description: 'Discrete stimming tool for focus', rating: 4.3 },
      { id: 't4', type: 'commentary', name: 'Creating Your Sensory Toolkit', description: 'Guide to managing sensory needs in public', rating: 4.6 },
    ]
  },
  'r1last': {
    id: 'r1last',
    name: 'Alternative: Self-Paced Online Course',
    description: 'Switch to online/hybrid format if traditional classroom isn\'t working. Lower success rate but valuable for some.',
    status: 'recommended',
    race: 'Race 1',
    successRate: 10,
    attempts: 102,
    nextSteps: [
      'Research online course options',
      'Check if credits transfer',
      'Set up dedicated home study space',
      'Create accountability system'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Coursera', description: 'University courses you can take at your own pace', url: 'https://coursera.org', rating: 4.5 },
      { id: 't2', type: 'service', name: 'Athabasca University', description: 'Canada\'s online university', url: 'https://athabascau.ca', rating: 4.3 },
      { id: 't3', type: 'product', name: 'Forest App', description: 'Stay focused by growing virtual trees', url: 'https://forestapp.cc', rating: 4.6 },
    ]
  },
  // Race 2 Choices (ADHD + Adult + Black + Canadian)
  'r2c1': {
    id: 'r2c1',
    name: 'ADHD Coaching + Medication Review',
    description: 'Combine professional ADHD coaching with medication optimization for maximum focus.',
    status: 'recommended',
    race: 'Race 2',
    successRate: 90,
    attempts: 1000,
    nextSteps: [
      'Find ADHD-specialized coach',
      'Schedule medication review with doctor',
      'Set up accountability system',
      'Track medication effectiveness'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'CADDAC Coaching Directory', description: 'Find certified ADHD coaches in Canada', url: 'https://caddac.ca', rating: 4.8 },
      { id: 't2', type: 'service', name: 'Rocket Health', description: 'Online ADHD assessment and prescription in Canada', url: 'https://rocketdoctor.ca', rating: 4.4 },
      { id: 't3', type: 'product', name: 'Focusmate', description: 'Virtual coworking for accountability', url: 'https://focusmate.com', rating: 4.7 },
      { id: 't4', type: 'commentary', name: 'How to Work with an ADHD Coach', description: 'Getting the most from coaching sessions', rating: 4.6 },
      { id: 't5', type: 'other', name: 'r/ADHD', description: 'Supportive community with practical tips', url: 'https://reddit.com/r/ADHD', rating: 4.5 },
    ]
  },
  'r2c2': {
    id: 'r2c2',
    name: 'Body Doubling & Co-Working',
    description: 'Use body doubling techniques and virtual co-working to maintain focus and motivation.',
    status: 'recommended',
    race: 'Race 2',
    successRate: 88,
    attempts: 101,
    nextSteps: [
      'Join Focusmate or similar service',
      'Find local study buddy',
      'Set up regular work sessions',
      'Track productivity patterns'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Focusmate', description: 'Virtual coworking with accountability partners', url: 'https://focusmate.com', rating: 4.7 },
      { id: 't2', type: 'service', name: 'Flow Club', description: 'Hosted co-working sessions', url: 'https://flowclub.com', rating: 4.5 },
      { id: 't3', type: 'other', name: 'ADHD Discord Servers', description: 'Real-time study sessions with others', rating: 4.4 },
      { id: 't4', type: 'commentary', name: 'Body Doubling Explained', description: 'Why it works for ADHD brains', rating: 4.8 },
    ]
  },
  'r2last': {
    id: 'r2last',
    name: 'Alternative: Career Pivot to ADHD-Friendly Role',
    description: 'Consider roles that align with ADHD strengths like variety, urgency, and creativity.',
    status: 'recommended',
    race: 'Race 2',
    successRate: 10,
    attempts: 102,
    nextSteps: [
      'Identify ADHD-friendly careers',
      'Research required skills',
      'Find mentors in target field',
      'Start building relevant experience'
    ],
    tools: [
      { id: 't1', type: 'commentary', name: 'ADHD-Friendly Careers Guide', description: 'Jobs that leverage ADHD traits', rating: 4.7 },
      { id: 't2', type: 'service', name: 'Black Professionals Network Canada', description: 'Career support and mentorship', rating: 4.6 },
      { id: 't3', type: 'other', name: 'LinkedIn ADHD Professionals', description: 'Networking group for ADHD adults', rating: 4.3 },
    ]
  },
  // Comparison View Milestones (Their vs Yours)
  'their_current': {
    id: 'their_current',
    name: 'Their Current Milestone',
    description: 'This is where your comparison partner (Role Model, Friend, or Mentor) is currently at in their journey.',
    status: 'in_progress',
    race: 'Comparison View',
    progress: 65,
    theirStats: {
      mentality: 7,
      happiness: 9,
      focus: 8
    },
    nextSteps: [
      'They are working on advanced networking',
      'Building industry connections',
      'Preparing for leadership role',
      'Mentoring others along the way'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Professional Network Groups', description: 'Industry-specific networking events', rating: 4.7 },
      { id: 't2', type: 'commentary', name: 'Leadership Development Path', description: 'How they approached leadership', rating: 4.8 },
      { id: 't3', type: 'product', name: 'Notion Workspace', description: 'Their productivity setup', rating: 4.6 },
    ]
  },
  'next_step': {
    id: 'next_step',
    name: 'At Your Next Step',
    description: 'This milestone shows what you should be working on next based on your current progress and comparison with others.',
    status: 'upcoming',
    race: 'Your Journey',
    progress: 0,
    nextSteps: [
      'Review what successful people did at this stage',
      'Identify key skills to develop',
      'Find resources and tools they used',
      'Set timeline based on their experience'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Skill Assessment Tool', description: 'Identify gaps in your current skillset', rating: 4.5 },
      { id: 't2', type: 'commentary', name: 'Roadmap from Peers', description: 'Learn from those who were in your shoes', rating: 4.9 },
      { id: 't3', type: 'product', name: 'Goal Tracker', description: 'Track progress on your next milestone', rating: 4.4 },
    ]
  },
  'your_step': {
    id: 'your_step',
    name: 'Your Current Step',
    description: 'This is your current position in the journey. Compare with others to see different approaches and strategies.',
    status: 'in_progress',
    race: 'Your Journey',
    progress: 45,
    yourStats: {
      mentality: 5,
      happiness: 6,
      focus: 5
    },
    nextSteps: [
      'Continue building foundation skills',
      'Seek mentorship from those ahead',
      'Document your progress',
      'Celebrate small wins'
    ],
    tools: [
      { id: 't1', type: 'service', name: 'Peer Support Group', description: 'Connect with others at similar stage', rating: 4.6 },
      { id: 't2', type: 'commentary', name: 'Progress Journal Template', description: 'Track your journey and learnings', rating: 4.5 },
      { id: 't3', type: 'product', name: 'Accountability Partner App', description: 'Stay on track with peer support', rating: 4.7 },
    ]
  }
}

interface Tool {
  id: string
  type: 'service' | 'commentary' | 'product' | 'other'
  name: string
  description: string
  url?: string
  rating?: number
  progress?: number // Progress percentage for this service (0-100)
  status?: 'not_started' | 'in_progress' | 'completed'
}

const toolIcons = {
  service: Wrench,
  commentary: MessageSquare,
  product: Package,
  other: Lightbulb
}

const toolColors = {
  service: 'bg-blue-50 border-blue-200 text-blue-700',
  commentary: 'bg-purple-50 border-purple-200 text-purple-700',
  product: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  other: 'bg-amber-50 border-amber-200 text-amber-700'
}

export default function MilestoneDetailView() {
  const params = useParams()
  const router = useRouter()
  const milestoneId = params.id as string
  const [milestone, setMilestone] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Use mock data for demonstration
    const mockData = mockMilestones[milestoneId]
    if (mockData) {
      setMilestone(mockData)
    } else {
      // Create generic milestone if ID not found
      setMilestone({
        id: milestoneId,
        name: `Milestone: ${milestoneId}`,
        description: 'This milestone is part of your personalized path to success.',
        status: 'pending',
        tools: []
      })
    }
    setLoading(false)
  }, [milestoneId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white/30 backdrop-blur-sm">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading milestone...</p>
        </div>
      </div>
    )
  }

  if (!milestone) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white/30 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Milestone not found</p>
          <Link href="/races" className="text-cyan-600 hover:underline">Back to Races</Link>
        </div>
      </div>
    )
  }

  const toolsByType = {
    services: milestone.tools?.filter((t: Tool) => t.type === 'service') || [],
    commentaries: milestone.tools?.filter((t: Tool) => t.type === 'commentary') || [],
    products: milestone.tools?.filter((t: Tool) => t.type === 'product') || [],
    other: milestone.tools?.filter((t: Tool) => t.type === 'other') || []
  }

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-4 md:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      <div className="relative z-10">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/races"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 font-medium mb-6 group"
        >
          <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          Back to Races
        </Link>

        {/* Milestone Header Card */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {milestone.race && (
                  <span className="text-sm px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                    {milestone.race}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  milestone.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  milestone.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  milestone.status === 'recommended' ? 'bg-cyan-100 text-cyan-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {milestone.status === 'in_progress' ? 'In Progress' : 
                   milestone.status === 'recommended' ? 'Recommended' :
                   milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">{milestone.name}</h1>
              <p className="text-slate-600">{milestone.description}</p>
            </div>

            {/* Stats for recommended choices */}
            {milestone.successRate && (
              <div className="bg-emerald-50 rounded-xl p-4 text-center min-w-[140px]">
                <div className="text-3xl font-bold text-emerald-600">{milestone.successRate}%</div>
                <div className="text-sm text-emerald-700">Success Rate</div>
                <div className="text-xs text-slate-500 mt-1">{milestone.attempts?.toLocaleString()} attempts</div>
              </div>
            )}
          </div>

          {/* Progress bar for current milestone */}
          {milestone.progress !== undefined && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Progress</span>
                <span className="font-bold text-slate-900">{milestone.progress}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Next Steps */}
          {milestone.nextSteps && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">Next Steps:</h3>
              <div className="space-y-2">
                {milestone.nextSteps.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className={idx === 0 ? 'font-medium' : 'text-slate-600'}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tools Section */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Recommended Tools</h2>

          {/* Services */}
          {toolsByType.services.length > 0 && (
            <ToolSection 
              title="Services" 
              icon={Wrench}
              tools={toolsByType.services} 
              colorClass="bg-blue-50 border-blue-200"
            />
          )}

          {/* Commentaries */}
          {toolsByType.commentaries.length > 0 && (
            <ToolSection 
              title="Commentaries / Reviews / Videos / Articles" 
              icon={MessageSquare}
              tools={toolsByType.commentaries} 
              colorClass="bg-purple-50 border-purple-200"
            />
          )}

          {/* Products */}
          {toolsByType.products.length > 0 && (
            <ToolSection 
              title="Products" 
              icon={Package}
              tools={toolsByType.products} 
              colorClass="bg-emerald-50 border-emerald-200"
            />
          )}

          {/* Other Tools */}
          {toolsByType.other.length > 0 && (
            <ToolSection 
              title="Other Helpful Tools" 
              icon={Lightbulb}
              tools={toolsByType.other} 
              colorClass="bg-amber-50 border-amber-200"
            />
          )}

          {milestone.tools?.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>No tools recommended for this milestone yet.</p>
              <Link href="/pit-stop" className="text-cyan-600 hover:underline mt-2 inline-block">
                Browse all tools in Pit Stop →
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap gap-4">
            <Link
              href={`/reflection?contextType=milestone&contextId=${milestoneId}`}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors font-medium"
            >
              <BookOpen className="h-5 w-5" />
              Journal / Reflection
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-xl hover:bg-slate-200 transition-colors font-medium"
            >
              Calendar View
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              href="/pit-stop"
              className="inline-flex items-center gap-2 bg-cyan-50 text-cyan-700 px-6 py-3 rounded-xl hover:bg-cyan-100 transition-colors font-medium"
            >
              <Wrench className="h-5 w-5" />
              Pit Stop
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
function ToolSection({ title, icon: Icon, tools, colorClass }: { 
  title: string
  icon: any
  tools: Tool[]
  colorClass: string 
}) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'completed': return 'Completed'
      case 'in_progress': return 'In Progress'
      default: return 'Not Started'
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {tools.map((tool) => {
          const progress = tool.progress || 0
          const status = tool.status || 'not_started'
          
          return (
            <div 
              key={tool.id} 
              className={`border-2 rounded-xl p-4 hover:shadow-md transition-all ${colorClass}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{tool.name}</h4>
                    {status !== 'not_started' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getStatusText(status)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{tool.description}</p>
                  {tool.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium text-slate-700">{tool.rating}/5</span>
                    </div>
                  )}
                </div>
                {tool.url && (
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 p-2 text-slate-600 hover:text-cyan-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                )}
              </div>
              
              {/* Progress Bar for Services */}
              {tool.type === 'service' && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Progress</span>
                    <span className="text-xs font-bold text-slate-700">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStatusColor(status)}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress > 0 && progress < 100 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {progress < 50 ? 'Getting started...' : progress < 90 ? 'Making good progress!' : 'Almost there!'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

