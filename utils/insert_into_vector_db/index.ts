import type { Document } from "@langchain/core/documents";
import { customEmbeddings } from "../generate_embeddings/index.js";

import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";

import { pgConfig } from "../vector_db/config.js";
  

  
 
  
  /**
   * Creates a new PGVectorStore instance with the configured settings
   */

  
export async function insertDocuments(documents: Document | Document[]): Promise<void> {
  try {
    const vectorStore = await PGVectorStore.initialize(customEmbeddings, pgConfig);
    
    if (Array.isArray(documents)) {
      await vectorStore.addDocuments(documents);
    } else {
      await vectorStore.addDocuments([documents]);
    }
  } catch (error) {
    console.error('Error inserting documents into vector store:', error);
    throw error;
  }
}