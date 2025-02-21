import { PGVectorStore, DistanceStrategy } from "@langchain/community/vectorstores/pgvector";
import { PoolConfig } from "pg";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

/**
 * Configuration for PostgreSQL vector store
 * This includes connection details and table structure
 */
export const pgConfig = {
  postgresConnectionOptions: {
    type: "postgres",
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  } as PoolConfig,
  tableName: "documents", // Name of the table to store documents
  columns: {
    idColumnName: "id", // Primary key column
    vectorColumnName: "embedding", // Column to store embeddings
    contentColumnName: "content", // Column to store document content
    metadataColumnName: "metadata", // Column to store metadata
  },
  distanceStrategy: "cosine" as DistanceStrategy, // Distance strategy for similarity search
  
};
