# Pattern Recognition Agent - Setup & Background Jobs

## Overview

The Pattern Recognition Agent autonomously discovers hidden connections and patterns in the data. This agent runs as a background job to continuously discover new patterns.

## Database Setup

1. **Run the schema update** to create the `pattern_discoveries` table:
   - Go to Supabase Dashboard → SQL Editor
   - Run the updated `lib/supabase/schema.sql` (or just the pattern_discoveries table definition)

2. **Verify the table was created**:
   ```sql
   SELECT * FROM pattern_discoveries LIMIT 5;
   ```

## Background Job Setup (Supabase Edge Functions)

The Pattern Recognition Agent should run weekly to discover new patterns. You can set this up using Supabase Edge Functions with cron scheduling.

### Option 1: Supabase Edge Function (Recommended)

1. **Create Edge Function**:
   ```bash
   npx supabase functions new pattern-discovery
   ```

2. **Function Code** (`supabase/functions/pattern-discovery/index.ts`):
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   serve(async (req) => {
     try {
       // Initialize Supabase client
       const supabaseUrl = Deno.env.get('SUPABASE_URL')!
       const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
       const supabase = createClient(supabaseUrl, supabaseServiceKey)

       // Call your pattern discovery API
       const response = await fetch(`${supabaseUrl}/functions/v1/pattern-discovery/internal`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${supabaseServiceKey}`,
         },
         body: JSON.stringify({
           scope: 'global',
           minimumSupport: 5,
         }),
       })

       if (!response.ok) {
         throw new Error('Failed to discover patterns')
       }

       const data = await response.json()

       return new Response(
         JSON.stringify({
           success: true,
           patternsDiscovered: data.patternsDiscovered,
         }),
         {
           headers: { 'Content-Type': 'application/json' },
           status: 200,
        }
       )
     } catch (error) {
       return new Response(
         JSON.stringify({ error: error.message }),
         {
           headers: { 'Content-Type': 'application/json' },
           status: 500,
         }
       )
     }
   })
   ```

3. **Deploy Function**:
   ```bash
   npx supabase functions deploy pattern-discovery
   ```

4. **Set up Cron Schedule**:
   - Go to Supabase Dashboard → Database → Cron Jobs
   - Create new cron job:
     - **Name**: `pattern-discovery-weekly`
     - **Schedule**: `0 2 * * 0` (Every Sunday at 2 AM)
     - **SQL**: 
       ```sql
       SELECT cron.schedule(
         'pattern-discovery-weekly',
         '0 2 * * 0',
         $$
         SELECT net.http_post(
           url := 'https://your-project.supabase.co/functions/v1/pattern-discovery',
           headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
           body := '{"scope": "global", "minimumSupport": 5}'::jsonb
         ) AS request_id;
         $$
       );
       ```

### Option 2: Next.js API Route + External Cron (Alternative)

1. **Create API Route** (`/app/api/agents/patterns/discover/route.ts`):
   - Use your existing POST endpoint at `/api/agents/patterns`
   - Secure with API key or admin authentication

2. **Use External Cron Service** (e.g., cron-job.org, EasyCron):
   - Set up weekly HTTP request to: `https://your-domain.com/api/agents/patterns?refresh=true`
   - Include API key in headers

### Option 3: Manual Trigger (For Testing)

You can manually trigger pattern discovery:

```bash
curl -X POST https://your-domain.com/api/agents/patterns \
  -H "Content-Type: application/json" \
  -d '{"scope": "global", "minimumSupport": 5}'
```

Or use the Supabase dashboard to call the API route directly.

## Pattern Types Discovered

The agent discovers four types of patterns:

1. **Barrier Combinations**: Common barrier combinations (e.g., "autism + ADHD + sensory sensitivity")
2. **Resource Affinity**: Resources that users rate together ("users who like X also like Y")
3. **Intersectionality**: Multi-dimensional patterns (barriers + demographics + location)
4. **Non-Obvious**: Surprising connections not immediately expected

## Pattern Confidence Levels

- **80-100%**: High confidence - Strong statistical significance
- **60-79%**: Moderate confidence - Reliable pattern
- **50-59%**: Low confidence - Emerging pattern (may need more data)
- **< 50%**: Excluded from results

## Pattern Expiration

Patterns can be set to expire after a certain time if they become stale. The agent will automatically refresh patterns weekly.

## Monitoring

Check pattern discoveries in Supabase Dashboard:
```sql
-- View recent discoveries
SELECT type, insight, confidence, frequency, discovered_at 
FROM pattern_discoveries 
ORDER BY discovered_at DESC 
LIMIT 10;

-- Count patterns by type
SELECT type, COUNT(*) as count 
FROM pattern_discoveries 
GROUP BY type;

-- View high-confidence patterns
SELECT * FROM pattern_discoveries 
WHERE confidence >= 80 
ORDER BY confidence DESC;
```

## Migration Path

When upgrading to ML-powered agent:
1. Replace statistical analysis with k-means/DBSCAN clustering
2. Use LLM (Claude API) for insight generation
3. Add more sophisticated pattern detection algorithms
4. Keep same interface and data structures