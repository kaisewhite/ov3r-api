import TurndownService from 'turndown';

/**
 * Converts HTML content to Markdown with cleanup rules
 */
export const convertHtmlToMarkdown = (html: string): string => {
    if (!html || typeof html !== 'string') {
        throw new Error('Invalid input: HTML content must be a non-empty string');
    }

    const turndownService = createTurndownService();
    let markdown = turndownService.turndown(html);

    // Post-processing cleanup
    return markdown
        .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
        .replace(/[ \t]+$/gm, '')   // Trim trailing spaces
        .trim() + '\n';             // Ensure single trailing newline
};

/**
 * Creates and configures a TurndownService instance with custom rules
 */
const createTurndownService = (): TurndownService => {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        emDelimiter: '_',
        bulletListMarker: '-',
        hr: '---',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
        preformattedCode: true
    });

    // Cleanup rules
    turndownService
        .addRule('removeEmptyParagraphs', {
            filter: (node) => node.nodeName === 'P' && !node.textContent?.trim(),
            replacement: () => ''
        })
        .addRule('removeEmptyLinks', {
            filter: (node) => node.nodeName === 'A' && isInvalidLink(node as HTMLAnchorElement),
            replacement: () => ''
        })
        .addRule('removeScripts', {
            filter: ['script', 'style', 'iframe'],
            replacement: () => ''
        })
        .addRule('tableAlignment', {
            filter: ['th', 'td'],
            replacement: (content, node) => formatTableCell(content, node as HTMLTableCellElement)
        });

    return turndownService;
};

/**
 * Checks if a link is empty or invalid
 */
const isInvalidLink = (anchor: HTMLAnchorElement): boolean =>
    !anchor.href || anchor.href === '#' || anchor.href.startsWith('javascript:');

/**
 * Formats table cells with alignment
 */
const formatTableCell = (content: string, node: HTMLTableCellElement): string => {
    const align = node.getAttribute('align') || '';
    return align === 'center' ? ` ${content} ` :
           align === 'right' ? ` ${content}` :
           `${content} `;
};
