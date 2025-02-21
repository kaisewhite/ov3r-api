import { PlaywrightCrawler, LogLevel, log } from 'crawlee';

// Optional: Set logging level
log.setLevel(LogLevel.ERROR); // Changed to ERROR to reduce noise

interface CrawlResult {
    url: string;
    html: string;
}

/**
 * Crawls an array of URLs and returns their HTML content using Playwright
 * This version can handle JavaScript-rendered content unlike Cheerio
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
export const crawlUrlsWithPlaywright = async (urls: string[]): Promise<CrawlResult[]> => {
    const results: CrawlResult[] = [];

    const crawler = new PlaywrightCrawler({
        // Function called for each URL
        async requestHandler({ request, page }) {
            // Wait for the page to be fully loaded
            await page.waitForLoadState('networkidle');
            
            // Get the full HTML content
            const html = await page.content();
            
            results.push({
                url: request.url,
                html
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

