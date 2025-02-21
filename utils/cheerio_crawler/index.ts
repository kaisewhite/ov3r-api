import { CheerioCrawler, LogLevel, log } from 'crawlee';

// Optional: Set logging level
log.setLevel(LogLevel.ERROR); // Changed to ERROR to reduce noise

interface CrawlResult {
    url: string;
    html: string;
}

/**
 * Crawls an array of URLs and returns their HTML content
 * 
 * @param urls - Array of URLs to crawl
 * @returns Promise<CrawlResult[]> - Array of objects containing URL and HTML content
 * 
 * @example
 * ```typescript
 * const results = await crawlUrls(['https://example.com', 'https://example.org']);
 * results.forEach(({ url, html }) => {
 *   console.log(`URL: ${url} has ${html.length} characters of HTML`);
 * });
 * ```
 */
export const crawlUrlsWithCheerio = async (urls: string[]): Promise<CrawlResult[]> => {
    const results: CrawlResult[] = [];

    const crawler = new CheerioCrawler({
        // Function called for each URL
        async requestHandler({ request, $ }) {
            results.push({
                url: request.url,
                html: $.html()
            });
        },
        
        // Error handling
        failedRequestHandler({ request }) {
            log.error(`Failed to crawl ${request.url}`);
            // Add failed URLs with empty HTML to maintain order
            results.push({
                url: request.url,
                html: ''
            });
        },
    });

    // Run the crawler with provided URLs
    await crawler.run(urls);

    return results;
}


