drop table documents;

create table documents (
    id bigint primary key generated always as identity,
    content text,
    metadata jsonb,
    embedding vector(384),
    state text
);

-- Create HNSW index on the embedding column
CREATE INDEX hnsw_embedding_idx
ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,        -- Number of connections per layer (default: 16)
    ef_construction = 64  -- Size of the dynamic candidate list (default: 64)
);
