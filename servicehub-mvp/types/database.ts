export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: 'user' | 'admin' | 'self_advocate' | 'parent' | 'caregiver' | 'banned'
          location: Json | null
          is_rater: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: 'user' | 'admin' | 'self_advocate' | 'parent' | 'caregiver'
          location?: Json | null
          is_rater?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: 'user' | 'admin' | 'self_advocate' | 'parent' | 'caregiver'
          location?: Json | null
          is_rater?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_barriers: {
        Row: {
          id: string
          user_id: string
          barrier_category: string
          barrier_type: string
          severity: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          barrier_category: string
          barrier_type: string
          severity?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          barrier_category?: string
          barrier_type?: string
          severity?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      resources: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          location: Json | null
          contact_info: Json | null
          image_url: string | null
          price: number | null
          submitted_by: string | null
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          location?: Json | null
          contact_info?: Json | null
          image_url?: string | null
          price?: number | null
          submitted_by?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          location?: Json | null
          contact_info?: Json | null
          image_url?: string | null
          price?: number | null
          submitted_by?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          resource_id: string
          user_id: string
          overall_score: number
          barrier_scores: Json | null
          comment: string | null
          helpful_count: number
          created_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          user_id: string
          overall_score: number
          barrier_scores?: Json | null
          comment?: string | null
          helpful_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          user_id?: string
          overall_score?: number
          barrier_scores?: Json | null
          comment?: string | null
          helpful_count?: number
          created_at?: string
        }
      }
      saved_resources: {
        Row: {
          id: string
          user_id: string
          resource_id: string
          notes: string | null
          status: 'wishlist' | 'current' | 'past'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resource_id: string
          notes?: string | null
          status?: 'wishlist' | 'current' | 'past'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resource_id?: string
          notes?: string | null
          status?: 'wishlist' | 'current' | 'past'
          created_at?: string
        }
      }
      moderation_queue: {
        Row: {
          id: string
          item_type: 'resource' | 'rating'
          item_id: string
          status: 'pending' | 'approved' | 'rejected'
          reason: string | null
          reviewed_by: string | null
          created_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          item_type: 'resource' | 'rating'
          item_id: string
          status?: 'pending' | 'approved' | 'rejected'
          reason?: string | null
          reviewed_by?: string | null
          created_at?: string
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          item_type?: 'resource' | 'rating'
          item_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          reason?: string | null
          reviewed_by?: string | null
          created_at?: string
          reviewed_at?: string | null
        }
      }
      user_embeddings: {
        Row: {
          id: string
          user_id: string
          embedding: number[] | null
          barrier_embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          embedding?: number[] | null
          barrier_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          embedding?: number[] | null
          barrier_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
      }
      resource_embeddings: {
        Row: {
          id: string
          resource_id: string
          embedding: number[] | null
          description_embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          embedding?: number[] | null
          description_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resource_id?: string
          embedding?: number[] | null
          description_embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
      }
      pattern_discoveries: {
        Row: {
          id: string
          type: string
          pattern: Json
          frequency: number
          confidence: number
          insight: string
          scope: string
          category: string | null
          location: string | null
          metadata: Json | null
          discovered_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          pattern: Json
          frequency: number
          confidence: number
          insight: string
          scope?: string
          category?: string | null
          location?: string | null
          metadata?: Json | null
          discovered_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          pattern?: Json
          frequency?: number
          confidence?: number
          insight?: string
          scope?: string
          category?: string | null
          location?: string | null
          metadata?: Json | null
          discovered_at?: string
          expires_at?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          link?: string | null
          read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row']
export type UserBarrier = Database['public']['Tables']['user_barriers']['Row']
export type Resource = Database['public']['Tables']['resources']['Row']
export type Rating = Database['public']['Tables']['ratings']['Row']
export type SavedResource = Database['public']['Tables']['saved_resources']['Row']
export type ModerationQueue = Database['public']['Tables']['moderation_queue']['Row']
export type UserEmbedding = Database['public']['Tables']['user_embeddings']['Row']
export type ResourceEmbedding = Database['public']['Tables']['resource_embeddings']['Row']
export type PatternDiscovery = Database['public']['Tables']['pattern_discoveries']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

// Location type helper
export interface Location {
  address?: string
  city?: string
  province?: string
  postal_code?: string
  lat?: number
  lng?: number
}

// Contact info type helper
export interface ContactInfo {
  phone?: string
  email?: string
  website?: string
}

// Barrier scores type helper
export interface BarrierScores {
  sensory?: number
  mobility?: number
  communication?: number
  cognitive?: number
  social?: number
  [key: string]: number | undefined
}
