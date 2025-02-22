import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { pgConfig } from "../vector_db/config.js";
import { customEmbeddings } from "../generate_embeddings/index.js";
import pkg from 'pg';
const { Pool } = pkg;

/**
 * Check if URLs have been previously crawled and delete their records if found
 * @param urls Array of URLs to check
 * @returns Object containing arrays of new and previously crawled URLs
 */
export async function handlePreviouslyCrawledUrls(urls: string[]) {
    try {
        // Initialize vector store and database pool
        const vectorStore = await PGVectorStore.initialize(customEmbeddings, pgConfig);
        const pool = new Pool(pgConfig.postgresConnectionOptions);

        // Create SQL query to find matching URLs in metadata using JSON operators
        const query = `
            SELECT DISTINCT metadata->>'url' as url 
            FROM documents 
            WHERE metadata->>'url' = ANY($1)
        `;

        // Execute query to find existing URLs
        const result = await pool.query(query, [urls]);
        const existingUrls = result.rows.map(row => row.url);

        if (existingUrls.length > 0) {
            console.log(`Found ${existingUrls.length} previously crawled URLs`);

            // Delete existing records using the same ANY operator
            const deleteQuery = `
                DELETE FROM documents 
                WHERE metadata->>'url' = ANY($1)
            `;
            await pool.query(deleteQuery, [existingUrls]);
            console.log(`Deleted ${existingUrls.length} existing records`);
        }

        // Clean up pool
        await pool.end();

        // Return both new and previously crawled URLs
        const newUrls = urls.filter(url => !existingUrls.includes(url));
        
        return {
            newUrls,
            existingUrls,
            totalChecked: urls.length
        };
    } catch (error) {
        console.error('Error checking previously crawled URLs:', error);
        throw error;
    }
}
