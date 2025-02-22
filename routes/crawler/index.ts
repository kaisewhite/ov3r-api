import express, { Request, Response } from "express";
import { processUrlsToEmbeddings } from "../../utils/process_urls_to_embeddings";
import { crawlAllLinks } from "../../utils/crawl_all_links";

const router = express.Router();

/**
 * @swagger
 * /v1/crawler/url:
 *   post:
 *     summary: Process URLs and generate embeddings
 *     description: Takes an array of URLs and processes them to generate embeddings
 *     tags: [Crawler]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - urls
 *               - state
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of URLs to process
 *                 example: ["https://example.com"]
 *               state:
 *                 type: string
 *                 description: The state associated with the URLs
 *                 example: "New York"
 *               maxUrls:
 *                 type: integer
 *                 description: The maximum number of URLs to crawl
 *                 example: 100
 *     responses:
 *       200:
 *         description: URLs processed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post("/url", async (req: Request, res: Response) => {
  try {
    console.log("Received request body:", JSON.stringify(req.body, null, 2));
    const { urls, state, maxUrls = 1000 } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: "Invalid request",
        message: "urls must be a non-empty array of strings",
      });
    } else {
      // Validate URLs
      const validUrls = urls.filter((url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      });

      if (validUrls.length === 0) {
        res.status(400).json({
          error: "Invalid URLs",
          message: "No valid URLs provided",
        });
      } else {
        // Track timing metrics
        const startTime = performance.now();

        console.log("Starting crawl with URLs:", validUrls.length);
        console.log("Max URLs to crawl:", maxUrls);

        // Crawl URLs and get all linked pages
        const crawlResult = await crawlAllLinks(validUrls, { 
          maxUrls: maxUrls, 
          pdfOutputDir: "./downloaded_pdfs" 
        });
        
        console.log("Crawl completed. Results:", {
          webUrlsCount: crawlResult.webUrls.length,
          pdfUrlsCount: crawlResult.pdfUrls.length,
          //webUrls: crawlResult.webUrls,
         // pdfUrls: crawlResult.pdfUrls
        });

        if (crawlResult.webUrls.length === 0) {
          res.status(400).json({
            error: "No web URLs found",
            message: "The crawler did not find any valid web pages to process",
            originalUrls: validUrls
          });
        } else {
          // Process URLs and generate embeddings
          console.log("Starting embedding generation for", crawlResult.webUrls.length, "URLs");
          await processUrlsToEmbeddings(crawlResult.webUrls, state);
          console.log("Finished generating embeddings");

          const totalDuration = (performance.now() - startTime) / 1000;

          res.json({
            message: "URLs processed successfully",
            stats: {
              inputUrls: validUrls.length,
              crawledWebUrls: crawlResult.webUrls.length,
              crawledPdfUrls: crawlResult.pdfUrls.length,
              timings: {
                totalDuration: parseFloat(totalDuration.toFixed(2)),
              }
            },
            crawledUrls: {
              web: crawlResult.webUrls,
              pdf: crawlResult.pdfUrls
            }
          });
        }
      }
    }
  } catch (error) {
    console.error("Error processing URLs:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to process URLs",
      message: errorMessage
    });
  }
});

export default router;
