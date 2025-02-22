import { config } from "dotenv";
config({ path: ".env" });

import { requiresJavaScript } from "../requires_javascript/index.js";
import { crawlUrlsWithCheerio } from "../cheerio_crawler/index.js";
import { crawlUrlsWithPlaywright } from "../playwright_crawler/index.js";
import { convertHtmlToMarkdown } from "../convert_html_to_markdown/index.js";
import { insertDocuments } from "../insert_into_vector_db/index.js";
import { semanticChunk, ChunkWithAll } from "../chunker/index.js";
import { handlePreviouslyCrawledUrls } from "../previously_crawled/index.js";

export async function processUrlsToEmbeddings(urls: string[], state: string): Promise<void> {
  try {
    console.log(`Starting to process ${urls.length} URLs:`, urls);

    console.log(`Checking for previously crawled URLs...`);
    const result = await handlePreviouslyCrawledUrls(urls);
    console.log("Previous URLs:", JSON.stringify(result, null, 2));

    // Check each URL for JavaScript requirements
    console.log("Checking JavaScript requirements for URLs...");
    const jsRequirements = await Promise.all(urls.map((url) => requiresJavaScript(url)));
    console.log("Finished checking JavaScript requirements");

    // Group URLs based on JavaScript requirements
    const jsUrls = urls.filter((_, i) => jsRequirements[i]);
    const nonJsUrls = urls.filter((_, i) => !jsRequirements[i]);
    console.log(`URLs requiring JavaScript: ${jsUrls.length}`);
    console.log(`URLs not requiring JavaScript: ${nonJsUrls.length}`);

    // Crawl URLs using appropriate methods
    console.log("Starting to crawl URLs...");
    const crawlResults = await Promise.all([
      nonJsUrls.length > 0 ? crawlUrlsWithCheerio(nonJsUrls) : [],
      jsUrls.length > 0 ? crawlUrlsWithPlaywright(jsUrls) : [],
    ]).then((results) => results.flat());
    console.log("Finished crawling all URLs");

    // Process each crawled result
    for (const { url, html } of crawlResults) {
      console.log(`\nProcessing URL: ${url}`);

      // Convert HTML to Markdown
      console.log(`Converting HTML to Markdown for ${url}`);
      const markdown = convertHtmlToMarkdown(html);
      console.log(`Finished converting HTML to Markdown for ${url}`);

      // Create semantic chunks with embeddings
      console.log(`Creating semantic chunks for ${url}`);
      const chunks = (await semanticChunk({
        text: markdown,
        windowSize: 2,
        similarityThreshold: 0.75,
        maxTokens: 384,
        documentName: url,
        returnEmbedding: true,
        returnTokenLength: true,
      })) as ChunkWithAll[]; // Assert that we'll get chunks with all properties
      console.log(`Created ${chunks.length} semantic chunks for ${url}`);

      // Prepare documents for vector database
      const documents = chunks.map((chunk) => ({
        pageContent: chunk.text,
        embedding: chunk.embedding,
        metadata: {
          url,
          document_id: chunk.document_id,
          document_name: chunk.document_name,
          number_of_chunks: chunk.number_of_chunks,
          chunk_number: chunk.chunk_number,
          token_length: chunk.token_length,
            timestamp: new Date().toISOString(),
          state: state
        },
        
      }));
        
      //console.log("Metadata for documents:", JSON.stringify(documents[0].metadata, null, 2));

      // Insert documents into vector database
      console.log(`Inserting ${documents.length} documents for ${url} into vector database for state ${state}`);
      await insertDocuments(documents);
      console.log(`Finished inserting documents for ${url}`);
    }

    console.log("\nCompleted processing all URLs successfully");
  } catch (error) {
    console.error("Error processing URLs:", error);
    throw error;
  }
}

/* const testUrls = ['https://www.nysenate.gov/legislation/laws/ABC/60'];
await processUrlsToEmbeddings(testUrls); */
