/**
 * Database Seeding Script
 * 
 * This script populates the ServiceHub database with test data for development and testing.
 * 
 * Usage:
 *   npx tsx lib/supabase/seed.ts
 * 
 * Or import and call from an API route:
 *   import { seedDatabase } from '@/lib/supabase/seed'
 *   await seedDatabase()
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test data constants
const CITIES = [
  { name: 'Toronto', province: 'Ontario', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { name: 'Vancouver', province: 'British Columbia', country: 'Canada', lat: 49.2827, lng: -123.1207 },
  { name: 'Montreal', province: 'Quebec', country: 'Canada', lat: 45.5017, lng: -73.5673 },
]

const CATEGORIES = [
  'Therapist',
  'School',
  'Doctor',
  'Park',
  'Store',
  'Community Center',
  'Support Group',
  'Recreation',
  'Employment',
  'Housing',
]

const BARRIER_TYPES = [
  'autism',
  'adhd',
  'sensory',
  'mobility',
  'communication',
  'cognitive',
  'social',
  'anxiety',
  'depression',
  'visual_impairment',
  'hearing_impairment',
]

const ROLES = ['self_advocate', 'parent', 'caregiver', 'professional']

// Helper function to get random item from array
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Helper function to get random items from array
function randomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// Helper function to generate random number in range
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Helper function to generate random float in range
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

// Generate test user profiles
async function createTestUsers() {
  console.log('Creating test users...')
  const users = []
  
  const testUsers = [
    // DEMO ACCOUNT — easy to remember credentials for presentations
    {
      email: 'demo@resourcehub.com',
      full_name: 'Demo User',
      role: 'self_advocate',
      barriers: ['autism', 'adhd', 'anxiety'],
    },
    {
      email: 'autism_parent@test.com',
      full_name: 'Sarah Johnson',
      role: 'parent',
      barriers: ['autism', 'sensory', 'communication'],
    },
    {
      email: 'adhd_advocate@test.com',
      full_name: 'Michael Chen',
      role: 'self_advocate',
      barriers: ['adhd', 'anxiety', 'cognitive'],
    },
    {
      email: 'mobility_user@test.com',
      full_name: 'Emma Williams',
      role: 'self_advocate',
      barriers: ['mobility', 'sensory'],
    },
    {
      email: 'therapist@test.com',
      full_name: 'Dr. James Brown',
      role: 'professional',
      barriers: [],
    },
    {
      email: 'caregiver@test.com',
      full_name: 'Maria Garcia',
      role: 'caregiver',
      barriers: ['autism', 'adhd', 'sensory', 'social'],
    },
    {
      email: 'multi_barrier@test.com',
      full_name: 'Alex Taylor',
      role: 'self_advocate',
      barriers: ['autism', 'adhd', 'anxiety', 'depression', 'sensory'],
    },
    {
      email: 'hearing_impairment@test.com',
      full_name: 'Jordan Lee',
      role: 'self_advocate',
      barriers: ['hearing_impairment', 'communication'],
    },
    {
      email: 'visual_impairment@test.com',
      full_name: 'Casey Martinez',
      role: 'self_advocate',
      barriers: ['visual_impairment', 'mobility'],
    },
  ]

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', userData.email)
        .single()

      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`)
        users.push({ id: existingUser.id, email: userData.email })
        continue
      }

      // Create auth user (requires service role key for admin.createUser)
      // If service role key is not available, we'll need to create users manually
      // For now, we'll try to use admin API, but fall back to a note that users need to be created manually
      let userId: string | null = null

      try {
        // Try to use admin API if service role key is available
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: 'TestPassword123!',
          email_confirm: true,
        })

        if (authError) {
          throw authError
        }

        if (authData?.user) {
          userId = authData.user.id
        }
      } catch (adminError: any) {
        // If user already exists, try to get the user ID from auth
        if (adminError.message?.includes('already been registered')) {
          try {
            // User exists in auth, get their ID
            const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
            const existingUser = existingAuthUsers?.users.find(u => u.email === userData.email)
            if (existingUser) {
              userId = existingUser.id
              console.log(`User ${userData.email} exists in auth, using existing ID`)
            } else {
              console.warn(`User ${userData.email} exists but couldn't retrieve ID`)
              continue
            }
          } catch (listError) {
            console.warn(`Could not list users to find ${userData.email}:`, listError)
            continue
          }
        } else {
          // Other error - skip this user
          console.warn(
            `Could not create auth user via admin API for ${userData.email}. ` +
            `Error: ${adminError.message}. ` +
            `Note: You may need to set SUPABASE_SERVICE_ROLE_KEY in your .env.local file.`
          )
          continue
        }
      }

      if (!userId) continue

      // Create profile (or get existing one)
      let profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        // Profile already exists, use it
        profile = existingProfile
        console.log(`Profile for ${userData.email} already exists, using existing profile`)
      } else {
        // Create new profile
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userData.email,
            full_name: userData.full_name,
            role: userData.role,
          })
          .select()
          .single()

        if (profileError) {
          console.error(`Error creating profile for ${userData.email}:`, profileError.message)
          continue
        }
        profile = newProfile
      }

      // Create user barriers
      if (userData.barriers.length > 0) {
        const barriers = userData.barriers.map((barrierType, index) => ({
          user_id: userId,
          barrier_type: barrierType,
          barrier_category: index === 0 ? 'neurodivergence' : randomItem(['neurodivergence', 'disability', 'health']),
          severity: randomInt(1, 5),
          notes: `Test barrier for ${userData.full_name}`,
        }))

        const { error: barriersError } = await supabase.from('user_barriers').insert(barriers)

        if (barriersError) {
          console.error(`Error creating barriers for ${userData.email}:`, barriersError.message)
        }
      }

      users.push({ id: userId, email: userData.email })
      console.log(`✓ Created user: ${userData.full_name} (${userData.email})`)
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error)
    }
  }

  return users
}

// Generate test resources
async function createTestResources(userIds: string[]) {
  console.log('Creating test resources...')
  const resources = []

  const resourceTemplates = [
    // Therapists
    { category: 'Therapist', name: 'Autism Support Therapy Center', count: 8 },
    { category: 'Therapist', name: 'Sensory Integration Clinic', count: 6 },
    { category: 'Therapist', name: 'Speech and Language Services', count: 7 },
    
    // Schools
    { category: 'School', name: 'Inclusive Education Academy', count: 10 },
    { category: 'School', name: 'Special Needs Learning Center', count: 8 },
    { category: 'School', name: 'Autism-Friendly Elementary', count: 6 },
    
    // Doctors
    { category: 'Doctor', name: 'Developmental Pediatric Clinic', count: 5 },
    { category: 'Doctor', name: 'Autism Assessment Center', count: 4 },
    
    // Parks
    { category: 'Park', name: 'Sensory-Friendly Playground', count: 12 },
    { category: 'Park', name: 'Accessible Community Park', count: 10 },
    
    // Stores
    { category: 'Store', name: 'Quiet Shopping Hours Grocery', count: 8 },
    { category: 'Store', name: 'Sensory-Friendly Retail Store', count: 6 },
    
    // Community Centers
    { category: 'Community Center', name: 'Autism Support Hub', count: 7 },
    { category: 'Community Center', name: 'Inclusive Recreation Center', count: 6 },
    
    // Support Groups
    { category: 'Support Group', name: 'Parent Support Network', count: 5 },
    { category: 'Support Group', name: 'Adult Autism Meetup', count: 4 },
    
    // Recreation
    { category: 'Recreation', name: 'Adaptive Sports Program', count: 6 },
    { category: 'Recreation', name: 'Sensory-Friendly Movie Theater', count: 4 },
    
    // Employment
    { category: 'Employment', name: 'Autism Employment Services', count: 5 },
    
    // Housing
    { category: 'Housing', name: 'Supported Living Residence', count: 4 },
  ]

  for (const template of resourceTemplates) {
    for (let i = 0; i < template.count; i++) {
      const city = randomItem(CITIES)
      const streetNumber = randomInt(100, 9999)
      const streetName = randomItem(['Main St', 'Oak Ave', 'Maple Dr', 'Park Blvd', 'River Rd'])
      
      const resource = {
        name: i === 0 ? template.name : `${template.name} - ${city.name} ${i + 1}`,
        category: template.category,
        description: `A ${template.category.toLowerCase()} resource that provides support and services for individuals with autism and related barriers. This location offers specialized programs and accommodations.`,
        location: {
          address: `${streetNumber} ${streetName}`,
          city: city.name,
          province: city.province,
          country: city.country,
          postal_code: `${randomInt(100, 999)} ${randomInt(100, 999)}`,
          lat: city.lat + randomFloat(-0.1, 0.1),
          lng: city.lng + randomFloat(-0.1, 0.1),
        },
        contact_info: {
          phone: `+1-${randomInt(200, 999)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
          email: `info@${template.name.toLowerCase().replace(/\s+/g, '')}${i}.com`,
          website: `https://www.${template.name.toLowerCase().replace(/\s+/g, '')}${i}.com`,
        },
        status: randomItem(['approved', 'approved', 'approved', 'pending']), // 75% approved
        submitted_by: randomItem(userIds),
      }

      try {
        const { data, error } = await supabase
          .from('resources')
          .insert(resource)
          .select()
          .single()

        if (error) {
          console.error(`Error creating resource ${resource.name}:`, error.message)
          continue
        }

        resources.push(data)
        console.log(`✓ Created resource: ${resource.name}`)
      } catch (error) {
        console.error(`Error creating resource ${resource.name}:`, error)
      }
    }
  }

  return resources
}

// Generate test ratings
async function createTestRatings(resources: any[], userIds: string[]) {
  console.log('Creating test ratings...')
  let ratingCount = 0

  // Ensure each resource gets at least some ratings, but not all
  const resourcesToRate = randomItems(resources, Math.floor(resources.length * 0.8))

  for (const resource of resourcesToRate) {
    // Each resource gets 2-8 ratings
    const numRatings = randomInt(2, 8)
    const ratingUsers = randomItems(userIds, numRatings)

    for (const userId of ratingUsers) {
      const overallScore = randomInt(1, 5)
      // Bias towards higher ratings (60% chance of 4-5 stars)
      const adjustedScore = Math.random() < 0.6 ? randomInt(4, 5) : overallScore

      // Generate barrier-specific scores (only for users with barriers)
      const { data: userBarriers } = await supabase
        .from('user_barriers')
        .select('barrier_type')
        .eq('user_id', userId)

      const barrierScores: Record<string, number> = {}
      if (userBarriers && userBarriers.length > 0) {
        // Randomly select 1-3 barriers to rate
        const barriersToRate = randomItems(
          userBarriers.map((b) => b.barrier_type),
          randomInt(1, Math.min(3, userBarriers.length))
        )

        for (const barrier of barriersToRate) {
          barrierScores[barrier] = randomInt(adjustedScore - 1, adjustedScore + 1)
          // Clamp between 1-5
          barrierScores[barrier] = Math.max(1, Math.min(5, barrierScores[barrier]))
        }
      }

      const rating = {
        resource_id: resource.id,
        user_id: userId,
        overall_score: adjustedScore,
        barrier_scores: Object.keys(barrierScores).length > 0 ? barrierScores : null,
        comment: randomItem([
          null,
          null, // 50% chance of no comment
          'Great resource, highly recommend!',
          'Very helpful and accommodating staff.',
          'Sensory-friendly environment, perfect for my needs.',
          'Could use some improvements but overall good.',
          'Not quite what I was looking for.',
          'Excellent support and understanding.',
          'Accessible and inclusive, love it!',
          'Good resource but limited availability.',
        ]),
        helpful_count: randomInt(0, 15),
      }

      try {
        const { error } = await supabase.from('ratings').insert(rating)

        if (error) {
          console.error(`Error creating rating:`, error.message)
          continue
        }

        ratingCount++
        if (ratingCount % 50 === 0) {
          console.log(`  Created ${ratingCount} ratings...`)
        }
      } catch (error) {
        console.error(`Error creating rating:`, error)
      }
    }
  }

  console.log(`✓ Created ${ratingCount} ratings`)
  return ratingCount
}

// Create saved resource "groups" for the demo user
async function createDemoSavedResources(demoUserId: string, resources: any[]) {
  console.log('Creating demo saved resources (groups)...')
  let savedCount = 0

  // Group resources into collections by status
  const wishlistResources = resources.filter(r => 
    r.category === 'Therapist' || r.category === 'Support Group'
  ).slice(0, 5)

  const currentResources = resources.filter(r => 
    r.category === 'Community Center' || r.category === 'Recreation'
  ).slice(0, 4)

  const pastResources = resources.filter(r => 
    r.category === 'School' || r.category === 'Doctor'
  ).slice(0, 3)

  const groups: Array<{ resources: any[]; status: 'wishlist' | 'current' | 'past'; notes: string }> = [
    { resources: wishlistResources, status: 'wishlist', notes: 'Want to check out' },
    { resources: currentResources, status: 'current', notes: 'Currently using' },
    { resources: pastResources, status: 'past', notes: 'Used previously' },
  ]

  for (const group of groups) {
    for (const resource of group.resources) {
      try {
        // Check if already saved
        const { data: existing } = await supabase
          .from('saved_resources')
          .select('id')
          .eq('user_id', demoUserId)
          .eq('resource_id', resource.id)
          .single()

        if (existing) continue

        const { error } = await supabase.from('saved_resources').insert({
          user_id: demoUserId,
          resource_id: resource.id,
          status: group.status,
          notes: group.notes,
        })

        if (error) {
          console.error(`Error saving resource for demo:`, error.message)
          continue
        }
        savedCount++
      } catch (error) {
        // Ignore — likely doesn't exist yet
      }
    }
  }

  console.log(`✓ Created ${savedCount} saved resources for demo user`)
  return savedCount
}

// Main seeding function
export async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n')

  try {
    // Step 1: Create test users (or get existing ones)
    let users = await createTestUsers()
    
    // If no users were created, try to find existing test users
    if (users.length === 0) {
      console.log('No new users created. Checking for existing test users...')
      const { data: existingProfiles, error: queryError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .like('email', '%@test.com')
      
      if (queryError) {
        console.error('Error querying for existing users:', queryError)
        throw new Error(
          `Cannot query for existing users: ${queryError.message}. ` +
          'Please check your SUPABASE_SERVICE_ROLE_KEY is set correctly.'
        )
      }
      
      if (existingProfiles && existingProfiles.length > 0) {
        console.log(`✓ Found ${existingProfiles.length} existing test users`)
        users = existingProfiles as typeof users
      } else {
        console.warn('⚠️  No test users found. This may be because:')
        console.warn('   1. Users exist in auth but not in profiles table')
        console.warn('   2. SUPABASE_SERVICE_ROLE_KEY is not set (required for creating users)')
        console.warn('   3. You may need to create users manually in Supabase Auth dashboard')
        throw new Error(
          'Cannot seed resources/ratings without users. ' +
          'Please set SUPABASE_SERVICE_ROLE_KEY or create test users manually.'
        )
      }
    }
    
    const userIds = users.map((u) => u.id)
    
    console.log(`\n✓ Using ${users.length} test users\n`)

    // Step 2: Create test resources
    const resources = await createTestResources(userIds)
    if (resources.length === 0) {
      throw new Error('Failed to create any test resources')
    }
    console.log(`\n✓ Created ${resources.length} test resources\n`)

    // Step 3: Create test ratings
    const ratingCount = await createTestRatings(resources, userIds)
    console.log(`\n✓ Created ${ratingCount} test ratings\n`)

    // Step 4: Create saved resources for demo user
    const demoUser = users.find(u => u.email === 'demo@resourcehub.com')
    let savedCount = 0
    if (demoUser) {
      savedCount = await createDemoSavedResources(demoUser.id, resources)
    }

    console.log('✅ Database seeding completed successfully!')
    console.log(`\nSummary:`)
    console.log(`  - Users: ${users.length}`)
    console.log(`  - Resources: ${resources.length}`)
    console.log(`  - Ratings: ${ratingCount}`)
    console.log(`  - Demo saved resources: ${savedCount}`)

    return {
      success: true,
      users: users.length,
      resources: resources.length,
      ratings: ratingCount,
      savedResources: savedCount,
    }
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}

// Clear all test data
export async function clearTestData() {
  console.log('🗑️  Clearing test data...\n')

  try {
    // Delete in order to respect foreign key constraints
    // First, get all test user IDs
    const { data: testProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .like('email', '%@test.com')

    const testUserIds = testProfiles?.map((p) => p.id) || []

    if (testUserIds.length > 0) {
      // Delete ratings by test users
      const { error: ratingsError } = await supabase
        .from('ratings')
        .delete()
        .in('user_id', testUserIds)
      if (ratingsError) console.error('Error deleting ratings:', ratingsError.message)
      else console.log('✓ Deleted ratings from test users')

      // Delete saved resources by test users
      const { error: savedError } = await supabase
        .from('saved_resources')
        .delete()
        .in('user_id', testUserIds)
      if (savedError) console.error('Error deleting saved resources:', savedError.message)
      else console.log('✓ Deleted saved resources from test users')

      // Delete resources submitted by test users
      const { error: resourcesError } = await supabase
        .from('resources')
        .delete()
        .in('submitted_by', testUserIds)
      if (resourcesError) console.error('Error deleting resources:', resourcesError.message)
      else console.log('✓ Deleted resources submitted by test users')

      // Delete user barriers
      const { error: barriersError } = await supabase
        .from('user_barriers')
        .delete()
        .in('user_id', testUserIds)
      if (barriersError) console.error('Error deleting user barriers:', barriersError.message)
      else console.log('✓ Deleted user barriers')

      // Delete test user profiles and auth users
      for (const profile of testProfiles) {
        try {
          // Try to delete auth user via admin API
          await supabase.auth.admin.deleteUser(profile.id)
        } catch (error) {
          // If admin API fails, just log and continue
          console.warn(`Could not delete auth user ${profile.id} via admin API`)
        }
        // Delete profile (cascade should handle related data)
        await supabase.from('profiles').delete().eq('id', profile.id)
      }
      console.log(`✓ Deleted ${testProfiles.length} test user profiles`)
    } else {
      console.log('No test users found to delete')
    }

    console.log('\n✅ Test data cleared successfully!')
    return { success: true }
  } catch (error) {
    console.error('❌ Error clearing test data:', error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  const command = process.argv[2]

  if (command === 'clear') {
    clearTestData()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  } else {
    seedDatabase()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  }
}