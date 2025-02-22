import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { pgConfig } from "../vector_db/config.js";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { customEmbeddings } from "../generate_embeddings/index.js";
import redis from "../../configurations/redis/index.js";
import crypto from "crypto";

const vectorStore = await PGVectorStore.initialize(customEmbeddings, pgConfig);

const SYSTEM_TEMPLATE = `You are a friendly and helpful legal documentation assistant for US state laws. Your purpose is to help everyday people understand state-specific legal documentation and regulations in simple terms. You will answer user questions based on the provided context.

Here are your instructions for answering questions:

1. Base your answers ONLY on the provided context. If the context doesn't contain enough information to answer the question, say so.
2. Use clear, everyday language that non-lawyers can understand
3. Keep answers concise but complete
4. If relevant, mention specific sections of law that apply
5. If the context contains multiple relevant pieces of information, synthesize them into a coherent answer
6. If there are important caveats or exceptions, mention them
7. If the question is unclear, ask for clarification

If the information needed to answer a question is not available in the database or document, you should:

1. Clearly state that the information is not available in the provided data.
2. Avoid providing irrelevant sources or references.
3. Suggest general guidance or steps the user can take to find the information elsewhere (e.g., referring to relevant laws or regulations in the specified state).

Context: {context}

Remember: 
- Explain everything as if you're talking to a teenager
- Break down complex legal language into simple terms
- Keep your explanation accurate but easy to understand
- It's okay to simplify, but don't leave out important details
- Use examples from everyday life when it helps explain the law

Rules:
- Do not include irrelevant sources or references.
- If the information is not available, clearly state that and avoid making assumptions.
- Provide general guidance only if the information is not found in the database.
- Only reference laws and regulations from the specified state.
- Do not mix information from different states.`;

const messages = [SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE), HumanMessagePromptTemplate.fromTemplate("{question} [State: {state}]")];

const prompt = ChatPromptTemplate.fromMessages(messages);

// Function to clean content
const cleanContent = (content: string): string => {
  // Remove markdown image links and other UI elements
  content = content.replace(/\[!\[.*?\]\(.*?\)\]/g, "");
  content = content.replace(/\[([^\]]*)\]\(([^\)]*)\)/g, "$1");
  // Remove extra whitespace and normalize line endings
  content = content.replace(/\s+/g, " ").trim();
  // Remove UI-specific text
  content = content.replace(/Source: .*$/g, "");
  return content;
};

// Function to check if the search results are relevant enough
const areResultsRelevant = (results: [any, number][], question: string): boolean => {
  if (results.length === 0) return false;
  
  // Check if the highest similarity score meets our threshold
  const highestScore = results[0][1];
  if (highestScore < 0.7) return false;

  // Get the content from the most relevant results
  const topResults = results.slice(0, 3);
  const combinedContent = topResults
    .map(([doc]) => doc.pageContent.toLowerCase())
    .join(' ');

  // Extract key terms from the question (excluding common words)
  const keyTerms = question.toLowerCase()
    .split(' ')
    .filter(word => 
      word.length > 3 && 
      !['what', 'when', 'where', 'how', 'why', 'who', 'the', 'and', 'for', 'that', 'this'].includes(word)
    );

  // Check if key terms from the question appear in the content
  const termMatches = keyTerms.filter(term => combinedContent.includes(term));
  const termMatchRatio = termMatches.length / keyTerms.length;

  return termMatchRatio >= 0.5; // At least 50% of key terms should match
};

const generateCacheKey = (question: string, state: string): string => {
  // Create a hash of the question and state to use as part of the cache key
  const hash = crypto.createHash("md5")
    .update(`${question.toLowerCase().trim()}:${state.toLowerCase().trim()}`)
    .digest("hex");
  return `question:${hash}:response`;
};

const answerQuestion = async (question: string, state: string) => {
  const startTime = performance.now();
  console.log("\nSearching for:", question, "in state:", state);

  // Check Redis cache first
  const cacheKey = generateCacheKey(question, state);
  try {
    const cachedResponse = await redis.get(cacheKey);
    if (cachedResponse) {
      console.log("Cache hit! Returning cached response for state:", state);
      const totalDuration = (performance.now() - startTime) / 1000;
      console.log(`Total execution time (cached): ${totalDuration.toFixed(2)} seconds`);
      return JSON.parse(cachedResponse);
    }
  } catch (error) {
    console.warn("Redis cache error:", error);
    // Continue with normal execution if cache fails
  }

  // Search with similarity scores and more results
  const searchStartTime = performance.now();
  const filter = {
    state: state,
  };
  const results = await vectorStore.similaritySearchWithScore(question, 8, filter);
  const searchDuration = (performance.now() - searchStartTime) / 1000;
  console.log(`\nVector search completed in ${searchDuration.toFixed(2)} seconds`);

  // Check if we have relevant results
  if (!areResultsRelevant(results, question)) {
    const noDataResponse = {
      content: `I apologize, but I don't have enough relevant information in my database to answer your question about ${state} state laws regarding "${question}". For the most accurate and up-to-date information, I recommend:

1. Consulting the official ${state} state government website
2. Contacting the relevant ${state} state department or agency
3. Consulting with a legal professional licensed in ${state}

This will ensure you get accurate information specific to ${state} state laws.`,
      sources: [] // Always empty for no data responses
    };

    // Cache the "no data" response for a shorter time
    try {
      await redis.set(
        cacheKey,
        JSON.stringify(noDataResponse),
        "EX",
        parseInt(process.env.NO_DATA_CACHE_TTL || "60") // Cache for 1 minute by default
      );
    } catch (error) {
      console.warn("Failed to cache no-data response:", error);
    }

    return noDataResponse;
  }

  // Only include results with high relevance scores
  const relevantResults = results.filter(([_, score]) => score >= 0.7);
  
  // Only include sources if we have highly relevant results
  const sourceUrls = relevantResults.length > 0 
    ? [...new Set(relevantResults.map(([doc]) => doc.metadata?.url).filter(Boolean))]
    : [];

  // Extract relevant text, clean it, and include similarity scores
  const processingStartTime = performance.now();
  const context = relevantResults
    .map(([doc, score]) => {
      const cleanedContent = cleanContent(doc.pageContent);
      const source = doc.metadata?.url ? `\nSource: ${doc.metadata.url}` : "";
      return `[Relevance Score: ${score.toFixed(3)}] ${cleanedContent}${source}`;
    })
    .join("\n\n");
  const processingDuration = (performance.now() - processingStartTime) / 1000;
  console.log(`Context processing completed in ${processingDuration.toFixed(2)} seconds`);

  // Initialize Chat LLM with higher temperature for more detailed responses
  const chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPEN_AI_MODEL_NAME,
    temperature: 0.7,
  });

  // Generate an answer using the retrieved context
  const llmStartTime = performance.now();
  const chain = prompt.pipe(chatModel);
  const response = await chain.invoke({
    context,
    question,
    state,
  });
  const llmDuration = (performance.now() - llmStartTime) / 1000;
  console.log(`LLM response generated in ${llmDuration.toFixed(2)} seconds`);

  const result = {
    content: response.content,
    sources: sourceUrls,
  };

  // Cache the response in Redis
  try {
    await redis.set(
      cacheKey,
      JSON.stringify(result),
      "EX",
      parseInt(process.env.DEFAULT_CACHE_TTL || "300")
    ); // Default to 5 minutes if not set
    console.log("Response cached successfully");
  } catch (error) {
    console.warn("Failed to cache response:", error);
  }

  const totalDuration = (performance.now() - startTime) / 1000;
  console.log(`\nTotal execution time: ${totalDuration.toFixed(2)} seconds`);

  return result;
};

export { answerQuestion };
