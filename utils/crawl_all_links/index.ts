import { CheerioCrawler, EnqueueStrategy, Configuration } from 'crawlee';
import robotsParser from 'robots-parser';
import fs from 'fs';
import path from 'path';

// Function to check robots.txt
async function canCrawl(url: string) {
    try {
        const robotsUrl = new URL('/robots.txt', url).toString();
        const response = await fetch(robotsUrl);
        const robotsTxt = await response.text();
        const robots = robotsParser(robotsUrl, robotsTxt);
        return robots.isAllowed(url);
    } catch (error) {
        console.warn(`Could not fetch robots.txt for ${url}:`, error);
        return true; // Default to allowing if robots.txt is inaccessible
    }
}

/**
 * Downloads a file from a URL and saves it to the specified directory.
 * @param url The URL of the file to download.
 * @param outputDir The directory to save the file in.
 */
async function downloadFile(url: string, outputDir: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download ${url}: ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error(`No response body from ${url}`);
        }

        // Extract the filename from the URL
        const filename = path.basename(new URL(url).pathname) || 'downloaded_file';
        const filePath = path.join(outputDir, filename);

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create a buffer from the response body
        const buffer = await response.arrayBuffer();
        const nodeBuffer = Buffer.from(buffer);

        // Write the buffer to file
        await fs.promises.writeFile(filePath, nodeBuffer);

        console.log(`Downloaded: ${url} -> ${filePath}`);
    } catch (error) {
        console.error(`Error downloading ${url}:`, error);
    }
}

interface CrawlResult {
    webUrls: string[];
    pdfUrls: string[];
}

/**
 * Crawls one or more websites and returns arrays of discovered web and PDF URLs that respect robots.txt rules.
 * Downloads PDF files when encountered.
 * @param startUrls Single URL string or array of URLs to start crawling from.
 * @param options Optional configuration for the crawler.
 * @returns Promise<CrawlResult> Object containing arrays of web and PDF URLs.
 */
export async function crawlAllLinks(
    startUrls: string | string[],
    options: { maxUrls?: number; pdfOutputDir?: string } = {}
): Promise<CrawlResult> {
    // Normalize input to array
    const urls = Array.isArray(startUrls) ? startUrls : [startUrls];
    
    // Use Sets to automatically handle duplicates
    const webUrls = new Set<string>();
    const pdfUrls = new Set<string>();
    let shouldStop = false;

    // Default PDF output directory
    const pdfOutputDir = options.pdfOutputDir || './pdfs';
    
    const crawler = new CheerioCrawler({
        maxRequestRetries: 3,
        maxRequestsPerCrawl: options.maxUrls,
        navigationTimeoutSecs: 30,
        additionalMimeTypes: ['application/pdf'], // Allow PDF content types
        
        
        async requestHandler({ request, enqueueLinks, response }) {
            if (shouldStop) return;

            // Check if we can crawl this URL
            const canCrawlUrl = await canCrawl(request.url);
            if (!canCrawlUrl) {
                console.log(`Skipping ${request.url} (blocked by robots.txt)`);
                return;
            }

            // Handle PDF files first
            if (response.headers['content-type']?.includes('application/pdf')) {
                console.log(`Found PDF: ${request.url}`);
                pdfUrls.add(request.url);
                await downloadFile(request.url, pdfOutputDir);
                
                if (options.maxUrls && (webUrls.size + pdfUrls.size) >= options.maxUrls) {
                    shouldStop = true;
                }
                return; // Skip further processing for PDFs
            }

            // Add URL to web URLs set
            webUrls.add(request.url);
            if (options.maxUrls && (webUrls.size + pdfUrls.size) >= options.maxUrls) {
                shouldStop = true;
                return;
            }

            // Enqueue links from the same domain
            await enqueueLinks({
                strategy: EnqueueStrategy.SameDomain,
                transformRequestFunction: (req) => {
                    return webUrls.has(req.url) || pdfUrls.has(req.url) ? null : req;
                },
            });
        },

        // Handle failed requests gracefully
        failedRequestHandler({ request }) {
            console.warn(`Request failed: ${request.url}`);
            webUrls.add(request.url); // Add the failed URL to web URLs
        }

        
    }, new Configuration({
        persistStorage: false,
    }))

    // Run the crawler with all start URLs
    await crawler.run(urls);

    return {
        webUrls: Array.from(webUrls),
        pdfUrls: Array.from(pdfUrls)
    };
}

/* // Example usage:
const result = await crawlAllLinks([
    'https://www.nysenate.gov/legislation/laws'
], { maxUrls: 100, pdfOutputDir: './downloaded_pdfs' });
console.log('Web URLs:', result.webUrls);
console.log('PDF URLs:', result.pdfUrls); */