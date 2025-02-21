/**
 * Generates embeddings for a given text.
 * Refer to the following link for Custom Usage in regards to TransformersJS: 
 * https://huggingface.co/docs/transformers.js/custom_usage
 */

import { pipeline } from "@xenova/transformers"

const EXPECTED_DIMENSIONS = 384;

/**
 * Generates vector embeddings for a given text input using the all-MiniLM-L6-v2 model.
 * 
 * This function uses the Xenova/all-MiniLM-L6-v2 model to convert text into a dense vector
 * representation (embeddings). The embeddings are mean-pooled and normalized, making them
 * suitable for semantic similarity comparisons and other NLP tasks.
 * 
 * @param input - The text to generate embeddings for
 * @returns Promise<Float32Array> - A promise that resolves to a normalized vector representation of the input text
 * 
 * @example
 * ```typescript
 * const embeddings = await generateEmbeddings("Hello world");
 * // Returns a normalized vector representation of "Hello world"
 * ```
 */
export const generateEmbeddings = async (input: string): Promise<number[]> => {
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const result = await pipe(input, { pooling: 'mean', normalize: true });
    const embeddings = Array.from(result.data); // Convert tensor to a plain number array

    // Validate dimensions
    if (embeddings.length !== EXPECTED_DIMENSIONS) {
        console.error(`Unexpected embedding dimensions. Expected ${EXPECTED_DIMENSIONS}, got ${embeddings.length}`);
        throw new Error(`Invalid embedding dimensions: ${embeddings.length}`);
    }

    return embeddings;
};

/**
 * Custom embeddings function that generates embeddings for a given text input.
 * 
 * This function uses the all-MiniLM-L6-v2 model to convert text into a dense vector
 * representation (embeddings). The embeddings are mean-pooled and normalized, making them
 * suitable for semantic similarity comparisons and other NLP tasks.
 * 
 * @param input - The text to generate embeddings for
 * @returns Promise<Float32Array> - A promise that resolves to a normalized vector representation of the input text
 * 
 * @example
 * ```typescript
 * const embeddings = await customEmbeddings("Hello world");
 * // Returns a normalized vector representation of "Hello world"
 * ```
 */
export const customEmbeddings = {
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
        console.log(`Generating embeddings for ${texts.length} texts`);
        const embeddings = await Promise.all(texts.map(text => generateEmbeddings(text)));
        
        // Log dimensions for the first embedding
        if (embeddings.length > 0) {
            console.log(`First embedding dimensions: ${embeddings[0].length}`);
        }

        return embeddings;
    },
    embedQuery: async (text: string): Promise<number[]> => {
        console.log(`Generating embedding for query: ${text.substring(0, 100)}...`);
        const embedding = await generateEmbeddings(text);
        console.log(`Query embedding dimensions: ${embedding.length}`);
        return embedding;
    }
};
