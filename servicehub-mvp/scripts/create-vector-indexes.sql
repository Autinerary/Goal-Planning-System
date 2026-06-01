-- Create Vector Indexes for pgvector
-- Run this AFTER you have data in your embedding tables
-- This script creates IVFFlat indexes for optimal performance with cosine similarity

-- For user embeddings
CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx 
  ON public.user_embeddings 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS user_embeddings_barrier_embedding_idx 
  ON public.user_embeddings 
  USING ivfflat (barrier_embedding vector_cosine_ops) 
  WITH (lists = 100);

-- For resource embeddings
CREATE INDEX IF NOT EXISTS resource_embeddings_embedding_idx 
  ON public.resource_embeddings 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS resource_embeddings_description_embedding_idx 
  ON public.resource_embeddings 
  USING ivfflat (description_embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Note: If you get an error "cannot create index on empty table",
-- you can use GIST indexes instead (slower but work on empty tables):
--
-- CREATE INDEX user_embeddings_embedding_idx 
--   ON public.user_embeddings 
--   USING GIST (embedding vector_l2_ops);
--
-- Then recreate as IVFFlat later for better performance.
