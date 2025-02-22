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

-- Create the jobs table for tracking crawler jobs
CREATE TABLE IF NOT EXISTS crawler_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(2) NOT NULL,
    urls JSONB NOT NULL,
    max_urls INTEGER DEFAULT 1000,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    web_urls_found INTEGER DEFAULT 0,
    pdf_urls_found INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_state CHECK (state IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS crawler_jobs_status_idx ON crawler_jobs(status);
CREATE INDEX IF NOT EXISTS crawler_jobs_state_idx ON crawler_jobs(state);
CREATE INDEX IF NOT EXISTS crawler_jobs_created_at_idx ON crawler_jobs(created_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_crawler_jobs_updated_at ON crawler_jobs;
CREATE TRIGGER update_crawler_jobs_updated_at
    BEFORE UPDATE ON crawler_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
