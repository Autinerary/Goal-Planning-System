# Free Vector Embeddings System

This directory contains the free, local embedding generation system using `@xenova/transformers`. **No API costs, runs entirely locally!**

## Overview

The embedding system uses the `Xenova/all-MiniLM-L6-v2` model, which:
- Generates 384-dimensional embeddings
- Runs entirely in the browser or Node.js (no external API calls)
- Model is ~80MB and cached after first download
- Completely free - no API costs!

## Files

- `generator.ts` - Core embedding generation functions
- `background-jobs.ts` - Helper functions for generating embeddings in background jobs
- `README.md` - This file

## Usage

### Basic Embedding Generation

```typescript
import { generateEmbedding } from '@/lib/embeddings/generator'

// Generate embedding for any text
const embedding = await generateEmbedding("autism support therapist")
// Returns: number[] (384 dimensions)
```

### User Barrier Embeddings

```typescript
import { generateBarrierEmbedding } from '@/lib/embeddings/generator'
import { getUserBarriers } from '@/lib/supabase/queries'

const barriers = await getUserBarriers(userId)
const embedding = await generateBarrierEmbedding(barriers)
```

### Resource Embeddings

```typescript
import { generateResourceEmbedding } from '@/lib/embeddings/generator'

const embedding = await generateResourceEmbedding(resource)
```

### Semantic Search

```typescript
import { semanticResourceSearch } from '@/lib/supabase/vector-queries'

// Search resources by natural language query
const results = await semanticResourceSearch(
  "therapist for autism support in Toronto",
  10 // limit
)
```

## Automatic Embedding Generation

### After User Onboarding

When a user completes onboarding, automatically generate their embedding:

```typescript
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'

// After user completes onboarding
await generateUserEmbeddingJob(userId)
```

### After Resource Creation

When a resource is created, automatically generate its embedding:

```typescript
import { generateResourceEmbeddingJob } from '@/lib/embeddings/background-jobs'

// After resource is created
await generateResourceEmbeddingJob(resourceId)
```

### Using API Route

You can also trigger embedding generation via API:

```typescript
// Generate user embedding
fetch('/api/embeddings/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'user',
    id: userId,
    force: false // Set to true to regenerate
  })
})

// Generate resource embedding
fetch('/api/embeddings/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'resource',
    id: resourceId,
    force: false
  })
})
```

## Database Setup

1. Run the SQL functions in `lib/supabase/vector-functions.sql` in your Supabase SQL Editor
2. These functions enable efficient vector similarity search using pgvector

## Model Information

- **Model**: `Xenova/all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Size**: ~80MB (downloaded once, then cached)
- **Speed**: ~50-100ms per embedding on modern hardware
- **License**: Apache 2.0 (free for commercial use)

## Performance Tips

1. **Cache embeddings**: Once generated, embeddings are stored in the database
2. **Generate asynchronously**: Use background jobs for non-critical embedding generation
3. **Batch operations**: For bulk operations, process embeddings in batches
4. **Model caching**: The model is loaded once and cached in memory

## Maintenance

### Regenerate All Embeddings

If you need to regenerate all embeddings (e.g., after model update):

```typescript
import {
  regenerateAllUserEmbeddings,
  regenerateAllResourceEmbeddings
} from '@/lib/embeddings/background-jobs'

// Regenerate all user embeddings
const result = await regenerateAllUserEmbeddings()
console.log(`Success: ${result.success}, Failed: ${result.failed}`)

// Regenerate all resource embeddings
const result = await regenerateAllResourceEmbeddings()
console.log(`Success: ${result.success}, Failed: ${result.failed}`)
```

## Troubleshooting

### Model Download Issues

If the model fails to download:
- Check your internet connection
- The model is downloaded to `~/.cache/huggingface/hub/` (or browser cache)
- First download may take a few minutes (~80MB)

### Memory Issues

If you encounter memory issues:
- The model uses ~200-300MB RAM when loaded
- For serverless environments, consider using a smaller model
- Clear cache with `clearEmbeddingCache()` if needed

### Performance

- First embedding takes longer (model loading)
- Subsequent embeddings are fast (~50-100ms)
- Consider using edge functions or background workers for production
