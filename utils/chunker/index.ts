/**
 * We will build a semantic chunker from scratch in the @semantic_chunker.ts We want to create chunks that are made up sentences that talk about the same theme or topic. We want control over the maximum size of the chunks. 

Here are the steps that make semantic chunking work:

1. Break up the document into sentences.
2. Create sentence groups: for each sentence, create a group containing some sentences before and after the given sentence. The group is essentially “anchored” by the sentence use to create it. You can decide the specific numbers before or after to include in each group - but all sentences in a group will be associated with one “anchor” sentence.
3. Generate embeddings for each sentence group and associate them with their “anchor” sentence.
4. Compare distances between each group sequentially: When you look at the sentences in the document sequentially, as long as the topic or theme is the same - the distance between the sentence group embedding for a given sentence and the sentence group preceding it will be low. On the other hand, higher semantic distance indicates that the theme or topic has changed. This can effectively delineate one chunk from the next.

Here are the features we need to focus on:

Semantic chunking based on sentence similarity
Dynamic similarity thresholds
Configurable chunk sizes

How it should work in order:

Sentence Splitting: The input text is split into an array of sentences.
Embedding Generation: A vector is created for each sentence using Xenova/all-MiniLM-L6-v2. Reference @index.ts for an example. 
Similarity Calculation: Cosine similarity scores are calculated for each sentence pair.
Chunk Formation: Sentences are grouped into chunks based on the similarity threshold and max token size.
 */

import { generateEmbeddings } from "../generate_embeddings/index.js";

/**
 * Computes the cosine similarity between two vectors.
 */
const cosineSimilarity = (vecA: Float32Array, vecB: Float32Array): number => {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
};

/**
 * Splits text into sentences while preserving Markdown structure.
 * Handles headers, code blocks, and list items appropriately.
 */
const splitIntoSentences = (text: string): string[] => {
  // Split the text into lines first to handle Markdown structure
  const lines = text.split('\n');
  const sentences: string[] = [];
  let codeBlock = false;
  let currentSection: string[] = [];

  for (let line of lines) {
    line = line.trim();
    
    // Skip empty lines but use them as potential section breaks
    if (!line) {
      if (currentSection.length > 0) {
        sentences.push(currentSection.join('\n'));
        currentSection = [];
      }
      continue;
    }

    // Handle code blocks
    if (line.startsWith('```')) {
      codeBlock = !codeBlock;
      currentSection.push(line);
      continue;
    }

    // If we're in a code block, keep lines together
    if (codeBlock) {
      currentSection.push(line);
      continue;
    }

    // Headers should be their own sections
    if (line.startsWith('#')) {
      if (currentSection.length > 0) {
        sentences.push(currentSection.join('\n'));
        currentSection = [];
      }
      sentences.push(line);
      continue;
    }

    // List items should be their own sections
    if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) {
      if (currentSection.length > 0) {
        sentences.push(currentSection.join('\n'));
        currentSection = [];
      }
      sentences.push(line);
      continue;
    }

    // For regular text, split by sentence boundaries but preserve structure
    const lineSentences = line.match(/[^.!?]+[.!?]+/g) || [line];
    currentSection.push(...lineSentences);
  }

  // Add any remaining content
  if (currentSection.length > 0) {
    sentences.push(currentSection.join('\n'));
  }

  // Filter out empty sentences and trim each one
  return sentences
    .filter(sentence => sentence.trim())
    .map(sentence => sentence.trim());
};

/**
 * Creates sentence groups centered around an anchor sentence.
 */
const createSentenceGroups = (sentences: string[], windowSize: number): string[][] => {
  return sentences.map((_, i) =>
    sentences.slice(Math.max(0, i - windowSize), Math.min(sentences.length, i + windowSize + 1))
  );
};

/**
 * Generates embeddings for each sentence group.
 */
const generateSentenceEmbeddings = async (groups: string[][]): Promise<Float32Array[]> => {
  const embeddings = await Promise.all(groups.map(group => generateEmbeddings(group.join(" "))));
  return embeddings.map(embedding => new Float32Array(embedding));
};

/**
 * Base interface for chunk output without optional fields
 */
export interface BaseChunk {
  document_id: number;
  document_name: string;
  number_of_chunks: number;
  chunk_number: number;
  text: string;
}

/**
 * Interface for chunk with token length
 */
export interface ChunkWithTokenLength extends BaseChunk {
  token_length: number;
}

/**
 * Interface for chunk with embedding
 */
export interface ChunkWithEmbedding extends BaseChunk {
  embedding: Float32Array;
}

/**
 * Interface for chunk with both token length and embedding
 */
export interface ChunkWithAll extends BaseChunk {
  token_length: number;
  embedding: Float32Array;
}

/**
 * Parameters for semantic chunking
 */
interface SemanticChunkParams {
  text: string;
  windowSize?: number;
  similarityThreshold?: number;
  maxTokens?: number;
  documentName?: string;
  returnEmbedding?: boolean;
  returnTokenLength?: boolean;
}

/**
 * Forms chunks by comparing sentence group embeddings and applying a similarity threshold.
 */
const formChunks = (
  sentences: string[],
  embeddings: Float32Array[],
  similarityThreshold: number,
  maxTokens: number,
  documentId: number,
  documentName?: string,
  returnEmbedding: boolean = false,
  returnTokenLength: boolean = false
): BaseChunk[] | ChunkWithTokenLength[] | ChunkWithEmbedding[] | ChunkWithAll[] => {
  const chunks: (BaseChunk | ChunkWithTokenLength | ChunkWithEmbedding | ChunkWithAll)[] = [];
  let currentChunk: string[] = [sentences[0]];
  let chunkEmbeddings: Float32Array[] = [embeddings[0]];

  for (let i = 1; i < sentences.length; i++) {
    const similarity = cosineSimilarity(embeddings[i - 1], embeddings[i]);
    const currentText = currentChunk.join(" ");

    if (similarity < similarityThreshold || currentText.length + sentences[i].length > maxTokens) {
      const chunk: BaseChunk = {
        document_id: documentId,
        document_name: documentName || "Unnamed Document",
        number_of_chunks: 0, // Placeholder, updated later
        chunk_number: chunks.length + 1,
        text: currentText
      };

      if (returnTokenLength) {
        (chunk as ChunkWithTokenLength).token_length = currentText.length;
      }
      
      if (returnEmbedding) {
        (chunk as ChunkWithEmbedding).embedding = chunkEmbeddings[0];
      }

      chunks.push(chunk);
      currentChunk = [];
      chunkEmbeddings = [];
    }
    currentChunk.push(sentences[i]);
    chunkEmbeddings.push(embeddings[i]);
  }

  if (currentChunk.length) {
    const currentText = currentChunk.join(" ");
    const chunk: BaseChunk = {
      document_id: documentId,
      document_name: documentName || "Unnamed Document",
      number_of_chunks: 0, // Placeholder, updated later
      chunk_number: chunks.length + 1,
      text: currentText
    };

    if (returnTokenLength) {
      (chunk as ChunkWithTokenLength).token_length = currentText.length;
    }

    if (returnEmbedding) {
      (chunk as ChunkWithEmbedding).embedding = chunkEmbeddings[0];
    }

    chunks.push(chunk);
  }

  chunks.forEach(chunk => chunk.number_of_chunks = chunks.length);
  return chunks as (BaseChunk[] | ChunkWithTokenLength[] | ChunkWithEmbedding[] | ChunkWithAll[]);
};

/**
 * Main function to perform semantic chunking.
 */
export const semanticChunk = async ({
  text,
  windowSize = 2,
  similarityThreshold = 0.75,
  maxTokens = 384,
  documentName,
  returnEmbedding = false,
  returnTokenLength = false
}: SemanticChunkParams): Promise<BaseChunk[] | ChunkWithTokenLength[] | ChunkWithEmbedding[] | ChunkWithAll[]> => {
  const documentId = Date.now();
  const sentences = splitIntoSentences(text);
  const sentenceGroups = createSentenceGroups(sentences, windowSize);
  const embeddings = await generateSentenceEmbeddings(sentenceGroups);
  return formChunks(sentences, embeddings, similarityThreshold, maxTokens, documentId, documentName, returnEmbedding, returnTokenLength);
};

/* const sampleText = `
# Vector Database Integration

## Overview
This section explains how to integrate vector databases into your application.

## Implementation
### Setting up PostgreSQL
First, install the required dependencies:
\`\`\`bash
npm install @langchain/community/vectorstores/pgvector
\`\`\`

### Creating Embeddings
Use the all-MiniLM-L6-v2 model to create embeddings:
\`\`\`typescript
const embeddings = await generateEmbeddings("Your text here");
\`\`\`

## Best Practices
- Always normalize your vectors
- Use appropriate index types
- Monitor performance metrics
`;

(async () => {
  const chunks = await semanticChunk({
    text: sampleText,
    windowSize: 2,
    similarityThreshold: 0.75,
    maxTokens: 384,
    documentName: "PydanticAI",
    returnEmbedding: false,
    returnTokenLength: true
  });
  console.log("Generated Chunks:", JSON.stringify(chunks, null, 2));
})(); */