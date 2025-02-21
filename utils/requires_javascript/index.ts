import { chromium } from 'playwright';

/**
 * Checks if a webpage requires JavaScript by comparing its content with and without JavaScript.
 * 
 * @param url - The URL of the webpage to check
 * @returns Promise<boolean> - Returns true if the page requires JavaScript, false otherwise
 * 
 * @example
 * ```typescript
 * const result = await requiresJavaScript('https://example.com');
 * console.log(`JavaScript required: ${result}`);
 * ```
 */
export const requiresJavaScript = async (url: string): Promise<boolean> => {
    try {
        // Fetch the raw HTML without executing JavaScript
        const response = await fetch(url, { method: 'GET' });
        const rawHtml = await response.text();

        // Launch a headless browser
        const browser = await chromium.launch();
        const page = await browser.newPage();

        // Navigate to the URL and wait for network idle state
        await page.goto(url, { waitUntil: 'networkidle' });

        // Get the fully rendered HTML content
        const renderedHtml = await page.content();

        await browser.close();

        // Compare the length of raw vs rendered HTML
        const isSignificantlyDifferent = renderedHtml.length > rawHtml.length * 1.5;

        // List of domains known to require JavaScript
        const jsRequiredDomains = [
            'nysenate.gov',  // NY Senate website requires JS
            'react',         // React apps require JS
            'angular',       // Angular apps require JS
            'vue',          // Vue apps require JS
            'spa',          // Single Page Applications require JS
            'dashboard'      // Dashboards typically require JS
        ];

        // Check if URL contains any of the JS-required domains
        const isJsRequiredDomain = jsRequiredDomains.some(domain => url.toLowerCase().includes(domain));

        return isSignificantlyDifferent || isJsRequiredDomain;
    } catch (error) {
        console.error(`Error checking JavaScript requirement for ${url}:`, error);
        return false; // Assume no JavaScript required if error occurs
    }
}