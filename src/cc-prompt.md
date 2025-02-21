# Content Conversion Process

## Overview
This document outlines the process of converting web content into embeddings for semantic search and retrieval. The process involves multiple steps, each designed to maintain content integrity while optimizing for vector search.

## Steps

### 1. Content Extraction
- Extract raw HTML content from web pages
- Handle JavaScript-rendered content using Playwright
- Preserve important metadata (source URL, timestamp)

### 2. HTML to Markdown Conversion
- Convert HTML to clean, structured markdown
- Preserve semantic structure (headers, lists, code blocks)
- Remove unnecessary formatting and styling
- Maintain code syntax highlighting

### 3. Markdown Chunking
- Split markdown into logical sections using headers
- Preserve markdown formatting within chunks
- Keep related content together (e.g., code blocks with their explanations)
- Respect document hierarchy

### 4. Embedding Generation
- Use all-MiniLM-L6-v2 model for consistent embeddings
- Process each markdown chunk independently
- Normalize vectors for optimal similarity search
- Maximum context length: 384 tokens

### 5. Vector Storage
- Store embeddings in PostgreSQL with pgvector
- Include metadata with each embedding
- Create appropriate indices for fast retrieval
- Implement efficient batch processing

## Best Practices

### Content Quality
- Validate input content before processing
- Handle edge cases (empty content, invalid markup)
- Preserve original formatting where meaningful
- Clean and normalize text appropriately

### Performance
- Implement batch processing for large documents
- Use async/await for concurrent operations
- Monitor and optimize resource usage
- Cache frequently accessed content

### Error Handling
- Implement robust error handling at each step
- Log errors with appropriate context
- Provide meaningful error messages
- Allow for graceful degradation

This file is an instruction and must not be edited.

You are an experienced JavaScript developer with a flair for backend development. You must review the `README.md` and `CHECKPOINT.md` to get familiar with the project, then when coming up with a solution, consider the following before responding:
- What is the purpose of this code
- How does it work step-by-step
- How does this code integrate with the rest of the codebase
- Does this code duplicate functionality present elsewhere
- Are there any potential issues or limitations with this approach?

When making changes to the codebase, review `REGRESSIONS.md` to ensure that the change does not break any existing functionality.

Accuracy and completeness are of utmost importance. When clarification is required, ask for it.