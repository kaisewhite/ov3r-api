import TurndownService from 'turndown';

/**
 * Converts HTML content to Markdown format
 * 
 * @param html - The HTML content to convert
 * @returns string - The converted Markdown content
 * 
 * @example
 * ```typescript
 * const markdown = await convertHtmlToMarkdown('<h1>Hello</h1><p>World</p>');
 * console.log(markdown);
 * // Output:
 * // # Hello
 * // World
 * ```
 */
export const convertHtmlToMarkdown = (html: string): string => {
    const turndownService = new TurndownService({
        headingStyle: 'atx',      // Use # style headings
        codeBlockStyle: 'fenced', // Use ``` style code blocks
        emDelimiter: '_',         // Use _text_ for emphasis
        bulletListMarker: '-',    // Use - for bullet lists
    });

    // Additional rules can be added here if needed
    turndownService.addRule('removeEmptyParagraphs', {
        filter: (node) => {
            return node.nodeName === 'P' && (node.textContent?.trim() ?? '') === '';
        },
        replacement: () => ''
    });

    return turndownService.turndown(html);
}