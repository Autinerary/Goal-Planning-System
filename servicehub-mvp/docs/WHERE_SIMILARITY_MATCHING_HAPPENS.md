# Where Similarity Matching Happens

Similarity matching in ServiceHub happens at **multiple levels** - from the database (SQL) to the application (TypeScript). Here's where it all happens:

## 🗄️ Database Level (SQL Functions) - pgvector

**File**: `lib/supabase/vector-functions.sql`

The actual similarity calculation happens in **PostgreSQL using pgvector** (cosine distance operator `<=>`). This is the **fastest and most efficient** method.

### 1. **Find Similar Users**
```sql
CREATE OR REPLACE FUNCTION find_similar_users(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
```
**Line 20**: `1 - (ue.barrier_embedding <=> query_embedding) AS similarity`
- Uses cosine distance (`<=>`) operator from pgvector
- Returns similarity score (0-1, where 1 = identical)
- Compares user barrier embeddings

### 2. **Find Similar Resources**
```sql
CREATE OR REPLACE FUNCTION find_similar_resources(
  query_embedding VECTOR(384),
  match_count INT DEFAULT 10
)
```
**Line 45**: `1 - (re.embedding <=> query_embedding) AS similarity`
- Compares resource embeddings
- Used for "Similar Resources" feature

### 3. **Semantic Search**
```sql
CREATE OR REPLACE FUNCTION search_resources_semantic(
  query_embedding VECTOR(384),
  ...
)
```
**Line 75**: `1 - (re.embedding <=> query_embedding) AS similarity`
- Used for search page semantic search
- Also has description-specific version (line 106)

### 4. **Find Resources for User**
```sql
CREATE OR REPLACE FUNCTION find_resources_for_user(
  user_id_param UUID,
  ...
)
```
**Line 137**: `1 - (re.embedding <=> ue.barrier_embedding) AS similarity`
- Matches user's barrier embedding to resource embeddings
- Direct user-to-resource similarity

---

## 🔧 Application Level (TypeScript Wrappers)

**File**: `lib/supabase/vector-queries.ts`

These functions call the SQL functions above, or provide fallback manual calculations.

### 1. **findSimilarUsers()** - Line 68
```typescript
export async function findSimilarUsers(
  userId: string,
  limit: number = 10,
  threshold: number = 0.7
)
```
- **Calls**: SQL function `find_similar_users` (line 81)
- **Fallback**: `findSimilarUsersManual()` if SQL function doesn't exist (line 90)
- **Used by**: Recommendation Agent, Pattern Agent

### 2. **findSimilarResources()** - Line 255
```typescript
export async function findSimilarResources(
  resourceId: string,
  limit: number = 10,
  threshold: number = 0.7
)
```
- **Calls**: SQL function `find_similar_resources` (line 267)
- **Used by**: Resource detail page ("Similar Resources" section)

### 3. **semanticResourceSearch()** - Line 228
```typescript
export async function semanticResourceSearch(
  query: string,
  limit: number = 20,
  threshold: number = 0.5
)
```
- **Calls**: SQL function `search_resources_semantic` (line 238)
- **Used by**: Search page

### 4. **Manual Fallback Functions**

**findSimilarUsersManual()** - Line 100
- **Calculates**: Cosine similarity manually in TypeScript
- **Used when**: SQL function doesn't exist (fallback)
- **Line 119**: Uses `cosineSimilarity()` function

---

## 📐 Cosine Similarity Calculation (Manual)

**File**: `lib/embeddings/generator.ts` - Line 172

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  // Calculates: dot(a, b) / (||a|| * ||b||)
}
```

**Used by**: 
- Manual similarity calculations (fallback)
- When SQL functions aren't available

---

## 🎯 Where Similarity Matching is Used

### 1. **Home Page - Recommendations**
**File**: `app/page.tsx` → `RecommendedSection()` → `orchestrator.handleRequest()`

**Flow**:
1. Recommendation Agent calls `findSimilarUsersByBarriers()` 
2. Which calls `findSimilarUsers()` from `vector-queries.ts`
3. Which calls SQL function `find_similar_users`
4. **Database calculates similarity** using pgvector

### 2. **Search Page - Semantic Search**
**File**: `app/api/search/route.ts` - Line 71

**Flow**:
1. User enters search query
2. Query converted to embedding
3. Calls `semanticResourceSearch()`
4. Which calls SQL function `search_resources_semantic`
5. **Database calculates similarity** between query embedding and resource embeddings

### 3. **Resource Detail Page - Similar Resources**
**File**: `app/resources/[id]/page.tsx` - Line 72

**Flow**:
1. Gets current resource's embedding
2. Calls `findSimilarResources()`
3. Which calls SQL function `find_similar_resources`
4. **Database calculates similarity** between resource embeddings

### 4. **Recommendation Agent**
**File**: `lib/agents/recommendation-agent/similarity.ts` - Line 13

**Flow**:
1. `findSimilarUsersByBarriers()` called
2. Calls `findSimilarUsers()` from `vector-queries.ts`
3. Which calls SQL function `find_similar_users`
4. **Database calculates similarity** using pgvector

### 5. **Pattern Agent - User Clustering**
**File**: `lib/agents/pattern-agent/clustering.ts`

**Flow**:
1. Uses user embeddings to cluster users
2. Calls `findSimilarUsers()` to find user clusters
3. **Database calculates similarity** between user embeddings

---

## 🔍 Similarity Calculation Methods

### Method 1: **pgvector SQL Functions (Primary - Fastest)** ⚡
- **Location**: Database (PostgreSQL)
- **Operator**: `<=>` (cosine distance)
- **Formula**: `1 - (embedding1 <=> embedding2)`
- **Performance**: Very fast (uses indexes, optimized by pgvector)
- **Used**: 90% of the time (preferred method)

### Method 2: **Manual Cosine Similarity (Fallback)** 🔄
- **Location**: TypeScript (`lib/embeddings/generator.ts`)
- **Function**: `cosineSimilarity(a: number[], b: number[])`
- **Formula**: `dot(a, b) / (||a|| * ||b||)`
- **Performance**: Slower (calculates in application)
- **Used**: When SQL functions don't exist (development/fallback)

---

## 📊 Similarity Score Ranges

- **1.0** = Identical embeddings (perfect match)
- **0.8-0.9** = Very similar
- **0.7-0.8** = Similar (default threshold)
- **0.6-0.7** = Somewhat similar
- **< 0.6** = Not similar (below threshold)

---

## 🔄 Complete Flow Example

**User visits home page → Gets recommendations:**

```
1. User's barrier embedding (from user_embeddings table)
   ↓
2. Recommendation Agent calls findSimilarUsers(userId)
   ↓
3. vector-queries.ts calls supabase.rpc('find_similar_users', {...})
   ↓
4. PostgreSQL SQL function executes:
   - Uses pgvector cosine distance: barrier_embedding <=> query_embedding
   - Returns users with similarity > 0.7
   ↓
5. Application gets similar users with similarity scores
   ↓
6. Gets resources those users rated highly
   ↓
7. Returns personalized recommendations
```

---

## 🎯 Key Files Summary

| File | Purpose | Similarity Method |
|------|---------|-------------------|
| `lib/supabase/vector-functions.sql` | SQL functions (database-level) | pgvector `<=>` operator |
| `lib/supabase/vector-queries.ts` | TypeScript wrappers | Calls SQL functions (primary) or manual (fallback) |
| `lib/embeddings/generator.ts` | Cosine similarity function | Manual calculation (fallback) |
| `lib/agents/recommendation-agent/similarity.ts` | Recommendation Agent | Uses `findSimilarUsers()` |
| `lib/resources/recommendations.ts` | Simple recommendations | Uses `findSimilarUsers()` |
| `app/api/search/route.ts` | Search page | Uses `semanticResourceSearch()` |
| `app/resources/[id]/page.tsx` | Resource detail | Uses `findSimilarResources()` |
| `app/page.tsx` | Home page | Uses Orchestrator → Recommendation Agent → similarity |

---

## 💡 Why Multiple Levels?

1. **Database (SQL)**: Fastest, uses indexes, optimized by pgvector
2. **Application (TypeScript)**: Fallback when SQL functions don't exist, development/testing
3. **Both methods use cosine similarity**: Ensures consistency

**Best Practice**: Always use SQL functions when available (they're faster and scale better).
