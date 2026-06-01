import { pipeline, Pipeline, env } from '@xenova/transformers'
import type { UserBarrier, Resource } from '@/types/database'

// Configure transformers to use web backend (avoids native Node.js bindings)
// This ensures it works in Next.js without bundling native modules
if (typeof window === 'undefined') {
  // Server-side: use local file system for cache
  env.useBrowserCache = false
  env.useCustomCache = true
}

// Use free, open-source sentence-transformer model
// Runs in browser or Node.js - NO API COSTS!
let embeddingPipeline: Pipeline | null = null

/**
 * Initialize the embedding pipeline (loads model once, cached after first load)
 */
async function initEmbeddings(): Promise<Pipeline> {
  if (!embeddingPipeline) {
    // Load model once (cached after first load)
    // This model is ~80MB and will be downloaded on first use
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2', // Free, 384-dimensional embeddings
      {
        quantized: true, // Use quantized model for faster loading
      }
    )
  }
  return embeddingPipeline
}

/**
 * Generate embedding for text (user barriers, resource descriptions)
 * @param text - Text to generate embedding for
 * @returns 384-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty')
  }

  const pipe = await initEmbeddings()

  // Generate embedding
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true,
  })

  // Convert tensor to array of numbers
  const embedding = Array.from(output.data as Float32Array)

  // Ensure we have exactly 384 dimensions
  if (embedding.length !== 384) {
    throw new Error(`Expected 384-dimensional embedding, got ${embedding.length}`)
  }

  return embedding
}

/**
 * Generate barrier profile embedding from user barriers
 * Creates a text representation of barriers and generates embedding
 */
export async function generateBarrierEmbedding(barriers: UserBarrier[]): Promise<number[]> {
  if (!barriers || barriers.length === 0) {
    // Return zero vector if no barriers
    return new Array(384).fill(0)
  }

  // Create text representation of barriers
  const barrierText = barriers
    .map((b) => {
      const severity = b.severity ? ` severity ${b.severity}` : ''
      const notes = b.notes ? ` (${b.notes})` : ''
      return `${b.barrier_category} ${b.barrier_type}${severity}${notes}`
    })
    .join('. ')

  return generateEmbedding(barrierText)
}

/**
 * Generate resource embedding from resource data
 * Combines all resource info into searchable text
 */
export async function generateResourceEmbedding(resource: Resource): Promise<number[]> {
  const parts: string[] = [resource.name]

  if (resource.category) {
    parts.push(resource.category)
  }

  if (resource.description) {
    parts.push(resource.description)
  }

  const resourceText = parts.join('. ').trim()

  if (!resourceText) {
    throw new Error('Resource must have at least a name')
  }

  return generateEmbedding(resourceText)
}

/**
 * Generate resource description embedding (separate from full embedding)
 * Used for more detailed semantic matching
 */
export async function generateResourceDescriptionEmbedding(
  description: string
): Promise<number[]> {
  if (!description || description.trim().length === 0) {
    // Return zero vector if no description
    return new Array(384).fill(0)
  }

  return generateEmbedding(description)
}

/**
 * Generate embedding for multiple texts and average them
 * Useful for creating embeddings from multiple fields
 */
export async function generateAverageEmbedding(texts: string[]): Promise<number[]> {
  if (!texts || texts.length === 0) {
    return new Array(384).fill(0)
  }

  const validTexts = texts.filter((text) => text && text.trim().length > 0)

  if (validTexts.length === 0) {
    return new Array(384).fill(0)
  }

  // Generate embeddings for all texts
  const embeddings = await Promise.all(validTexts.map((text) => generateEmbedding(text)))

  // Average the embeddings
  const dimension = 384
  const averaged = new Array(dimension).fill(0)

  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      averaged[i] += embedding[i]
    }
  }

  // Divide by number of embeddings to get average
  for (let i = 0; i < dimension; i++) {
    averaged[i] /= embeddings.length
  }

  // Normalize the averaged vector
  const magnitude = Math.sqrt(averaged.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      averaged[i] /= magnitude
    }
  }

  return averaged
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1, where 1 is most similar
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have the same length: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Clear the embedding pipeline cache (useful for testing or memory management)
 */
export function clearEmbeddingCache(): void {
  embeddingPipeline = null
}
