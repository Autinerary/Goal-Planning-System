-- Vector Search Functions for pgvector
-- Run these in Supabase SQL Editor after enabling the vector extension

-- Function: Find similar users by barrier embedding
-- Uses cosine distance (<=>) operator from pgvector
CREATE OR REPLACE FUNCTION find_similar_users(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    ue.user_id,
    1 - (ue.barrier_embedding <=> query_embedding) AS similarity
  FROM user_embeddings ue
  WHERE ue.barrier_embedding IS NOT NULL
    AND 1 - (ue.barrier_embedding <=> query_embedding) > match_threshold
  ORDER BY ue.barrier_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function: Find similar resources
CREATE OR REPLACE FUNCTION find_similar_resources(
  query_embedding VECTOR(384),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  resource_id UUID,
  similarity FLOAT,
  name TEXT,
  category TEXT,
  description TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    r.id AS resource_id,
    1 - (re.embedding <=> query_embedding) AS similarity,
    r.name,
    r.category,
    r.description
  FROM resource_embeddings re
  JOIN resources r ON r.id = re.resource_id
  WHERE r.status = 'approved'
    AND re.embedding IS NOT NULL
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function: Semantic search for resources
CREATE OR REPLACE FUNCTION search_resources_semantic(
  query_embedding VECTOR(384),
  match_count INT DEFAULT 20,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  resource_id UUID,
  similarity FLOAT,
  name TEXT,
  category TEXT,
  description TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    r.id AS resource_id,
    1 - (re.embedding <=> query_embedding) AS similarity,
    r.name,
    r.category,
    r.description
  FROM resource_embeddings re
  JOIN resources r ON r.id = re.resource_id
  WHERE r.status = 'approved'
    AND re.embedding IS NOT NULL
    AND 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function: Semantic search using description embedding (more detailed)
CREATE OR REPLACE FUNCTION search_resources_description_semantic(
  query_embedding VECTOR(384),
  match_count INT DEFAULT 20,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  resource_id UUID,
  similarity FLOAT,
  name TEXT,
  category TEXT,
  description TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    r.id AS resource_id,
    1 - (re.description_embedding <=> query_embedding) AS similarity,
    r.name,
    r.category,
    r.description
  FROM resource_embeddings re
  JOIN resources r ON r.id = re.resource_id
  WHERE r.status = 'approved'
    AND re.description_embedding IS NOT NULL
    AND 1 - (re.description_embedding <=> query_embedding) > match_threshold
  ORDER BY re.description_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function: Find resources for a user based on their barrier profile
CREATE OR REPLACE FUNCTION find_resources_for_user(
  user_id_param UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  resource_id UUID,
  similarity FLOAT,
  name TEXT,
  category TEXT,
  description TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    r.id AS resource_id,
    1 - (re.embedding <=> ue.barrier_embedding) AS similarity,
    r.name,
    r.category,
    r.description
  FROM user_embeddings ue
  CROSS JOIN resource_embeddings re
  JOIN resources r ON r.id = re.resource_id
  WHERE ue.user_id = user_id_param
    AND ue.barrier_embedding IS NOT NULL
    AND re.embedding IS NOT NULL
    AND r.status = 'approved'
    AND 1 - (re.embedding <=> ue.barrier_embedding) > match_threshold
  ORDER BY re.embedding <=> ue.barrier_embedding
  LIMIT match_count;
$$;
