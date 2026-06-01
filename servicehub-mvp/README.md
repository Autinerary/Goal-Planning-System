# ServiceHub MVP

A resource rating platform for the autism community with AI-powered recommendations using Supabase and vector embeddings.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **Vector Search**: pgvector extension for semantic similarity
- **Authentication**: Supabase Auth

## Project Structure

```
servicehub-mvp/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
├── lib/                   # Utilities and helpers
│   └── supabase/         # Supabase configuration and queries
│       ├── client.ts     # Browser client
│       ├── server.ts     # Server-side client
│       ├── schema.sql    # Database schema with pgvector
│       ├── queries.ts    # Common database queries
│       └── vector-queries.ts  # Vector similarity queries
├── types/                 # TypeScript type definitions
│   └── database.ts       # Database types
├── hooks/                 # Custom React hooks
└── .env.local.example    # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account (free tier available)

### Setup Steps

1. **Clone and install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Set up Supabase:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Create a new project (free tier is fine)
   - Go to Project Settings → API
   - Copy your project URL and anon key

3. **Configure environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up the database:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy the contents of `lib/supabase/schema.sql`
   - Run the SQL script to create all tables, enable pgvector, and set up RLS policies

5. **Enable pgvector extension:**
   - Go to Supabase Dashboard → Database → Extensions
   - Search for "vector" and enable it
   - Or run: `CREATE EXTENSION IF NOT EXISTS vector;` in SQL Editor

6. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

7. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## Database Schema

The database includes:

- **profiles**: User profiles extending Supabase auth
- **user_barriers**: User barriers/challenges (neurodivergence, disabilities, etc.)
- **resources**: Services, places, products that users can rate
- **ratings**: Community reviews with barrier-specific scores
- **saved_resources**: User wishlists
- **moderation_queue**: Content moderation workflow
- **user_embeddings**: Vector embeddings for user similarity matching
- **resource_embeddings**: Vector embeddings for semantic search

All tables use Row Level Security (RLS) for data protection.

## Vector Embeddings

This project uses pgvector for semantic similarity search:

- **User embeddings**: Match users with similar barrier profiles for better recommendations
- **Resource embeddings**: Enable semantic search of resources by meaning, not just keywords
- **384-dimensional vectors**: Using free sentence-transformers models

### Generating Embeddings

You'll need to implement embedding generation in `lib/supabase/vector-queries.ts`. Options:

1. **HuggingFace Inference API** (free tier available)
   - Model: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
   
2. **OpenAI Embeddings** (paid)
   - Model: `text-embedding-3-small` (1536 dimensions - adjust schema if using)

3. **Local model** (using transformers.js or similar)

## Development

### Creating Database Types

After updating the schema, regenerate TypeScript types:

```bash
# Using Supabase CLI (if installed)
supabase gen types typescript --project-id your-project-id > types/database.ts
```

### Common Tasks

- **Add a new query**: Add functions to `lib/supabase/queries.ts`
- **Add vector search**: Add functions to `lib/supabase/vector-queries.ts`
- **Create components**: Add to `components/` directory
- **Add pages**: Create new routes in `app/` directory

## Key Features

- ✅ PostgreSQL database with Supabase
- ✅ pgvector extension for free vector search
- ✅ Row Level Security for data protection
- ✅ TypeScript types for type-safe database queries
- ✅ Semantic search capabilities
- ✅ User similarity matching
- ✅ Moderation queue system
- ✅ Rating system with barrier-specific scores

## Next Steps

1. Implement authentication flows
2. Build UI components for resources and ratings
3. Set up embedding generation pipeline
4. Create AI recommendation engine
5. Build search and discovery features
6. Implement moderation dashboard

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
