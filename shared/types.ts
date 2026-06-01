// Shared TypeScript types for frontend and backend communication

export type BarrierType = 
  | 'autism'
  | 'adhd'
  | 'ocd'
  | 'bipolar'
  | 'sensory_impairment'
  | 'physical_impairment'
  | 'intellectual_impairment'
  | 'visible_minority'
  | 'ethnicity'
  | 'language'
  | 'gender'
  | 'lgbtq'
  | 'wealth'
  | 'physical_health';

export type MotivationType = 
  | 'intrinsic'
  | 'extrinsic'
  | 'achievement'
  | 'social'
  | 'fear_based'
  | 'reward_based';

export interface UserProfile {
  id: string;
  demographics: {
    age?: number;
    location?: string;
    education?: string;
    occupation?: string;
  };
  barrierTypes: BarrierType[];
  motivationType: MotivationType;
  goals: string[];
  dreams: string[];
  currentChallenges: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Stat {
  name: string;
  value: number;
  maxValue: number;
  color?: string;
}

export interface MotivationWheel {
  id: string;
  options: string[];
  currentMotivation?: string;
}

export interface Race {
  id: string;
  name: string;
  goal: string;
  progress: number; // 0-100
  models: string[]; // Model identifiers
  milestones: Milestone[];
  stats: Stat[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  raceId: string;
  name: string;
  description: string;
  order: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  recommendedChoices: RecommendedChoice[];
  tools: Tool[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendedChoice {
  id: string;
  name: string;
  description: string;
  successPercentage: number;
  attempts: number;
  estimatedTime?: number;
}

export interface Tool {
  id: string;
  type: 'service' | 'commentary' | 'product' | 'other';
  name: string;
  description: string;
  url?: string;
  rating?: number;
  relevanceScore?: number;
}

export interface Task {
  id: string;
  milestoneId: string;
  name: string;
  description: string;
  scheduledDate: Date;
  estimatedDuration: number; // in minutes
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  difficulty?: 'easy' | 'medium' | 'hard';
  priority?: 'low' | 'medium' | 'high';
  helperTricks?: string[];
  motivation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarDay {
  date: Date;
  theme?: string;
  type?: string; // e.g., 'high_energy', 'low_energy', 'recovery'
  tasks: Task[];
  reflection?: string;
  worstCaseTasks: Task[];
  averageCaseTasks: Task[];
  bestCaseTasks: Task[];
}

export interface Reflection {
  id: string;
  userId: string;
  contextType: 'path' | 'race' | 'milestone' | 'calendar' | 'task';
  contextId: string;
  questions: ReflectionQuestion[];
  freeFormText?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  createdAt: Date;
}

export interface ReflectionQuestion {
  id: string;
  question: string;
  answer?: string;
}

export interface Path {
  id: string;
  userId: string;
  name: string;
  description: string;
  races: Race[];
  stats: Stat[];
  motivationWheel: MotivationWheel;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  result: any;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface OrchestratorResponse {
  path?: Path;
  races?: Race[];
  recommendations?: Tool[];
  schedule?: CalendarDay[];
  explanations: string[];
  agentResponses: AgentResponse[];
}
