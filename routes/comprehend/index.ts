import express, { Request, Response } from "express";
import { crawlAllLinks } from "../../utils/crawl_all_links/index.js";
import { processUrlsToEmbeddings } from "../../utils/process_urls_to_embeddings/index.js";
import { uploadFilesFromUrls } from "../../utils/upload_to_s3_bucket/index.js";
import { createCrawlerJob, updateCrawlerJobStatus, getCrawlerJob, listCrawlerJobs, updateCrawlerJobProgress, markCrawlerJobAsFailed } from "../../utils/track_crawler_jobs/index.js";
import { answerQuestion } from "../../utils/query/index.js";

const router = express.Router();

/**
 * @swagger
 * /v1/comprehend/query:
 *   post:
 *     summary: Ask a question about the documentation
 *     description: Ask a question about the documentation using RAG (Retrieval-Augmented Generation)
 *     tags: [Comprehend]
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *           enum: [AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question to ask about the documentation
 *                 example: "What is the difference between a Class A and Class B distiller's license?"
 *     responses:
 *       200:
 *         description: Question answered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                   description: The answer to the question
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of source URLs used to generate the answer
 *                 timings:
 *                   type: object
 *                   properties:
 *                     totalDuration:
 *                       type: number
 *                       description: Total time taken to process the query in seconds
 *                     vectorSearchDuration:
 *                       type: number
 *                       description: Time taken for vector search in seconds
 *                     llmDuration:
 *                       type: number
 *                       description: Time taken for LLM response in seconds
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
      const { question } = req.body;
      const state = req.query.state as string;

      if (!question || typeof question !== 'string') {
          res.status(400).json({
              error: 'Invalid request',
              message: 'Question must be a non-empty string'
          });
          return;
      }

   

      // Get answer using RAG
      const result = await answerQuestion(question, state);
      console.log("Passed in the following State:", state);
  

      res.json({
          answer: result.content,
          sources: result.sources,
      });
  } catch (error) {
      console.error('Error processing question:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({
          error: 'Failed to process question',
          message: errorMessage
      });
  }
});

/**
 * @swagger
 * /v1/comprehend/crawl/url:
 *   post:
 *     summary: Process URLs and generate embeddings
 *     description: Takes an array of URLs and processes them to generate embeddings
 *     tags: [Comprehend]
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *           enum: [AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - urls
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of URLs to process
 *                 example: ["https://example.com"]
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
router.post("/crawl/url", async (req: Request, res: Response) => {
  try {
    console.log("Received request body:", JSON.stringify(req.body, null, 2));
    const { urls, maxUrls = 1000 } = req.body;
    const state = req.query.state as string;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: "Invalid request",
        message: "urls must be a non-empty array of strings",
      });
    }

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
    }

    // Create a new crawler job
    const job = await createCrawlerJob(state, validUrls, maxUrls);
    await updateCrawlerJobStatus(job.id, 'processing');

    try {
      // Track timing metrics
      console.log("Starting crawl with URLs:", validUrls.length);
      console.log("Max URLs to crawl:", maxUrls);

      // Crawl URLs and get all linked pages
      const crawlResult = await crawlAllLinks(validUrls, {
        maxUrls: maxUrls,
        pdfOutputDir: "./downloaded_pdfs"
      });

      // Update progress
      await updateCrawlerJobProgress(
        job.id,
        crawlResult.webUrls.length,
        crawlResult.pdfUrls.length
      );

      console.log("Crawl completed. Results:", {
        webUrlsCount: crawlResult.webUrls.length,
        pdfUrlsCount: crawlResult.pdfUrls.length,
      });

      if (crawlResult.webUrls.length === 0) {
        await markCrawlerJobAsFailed(job.id, "No web URLs found");
        res.status(400).json({
          error: "No web URLs found",
          message: "The crawler did not find any valid web pages to process",
          originalUrls: validUrls,
          jobId: job.id
        });
      }

      // Process URLs and generate embeddings
      console.log("Starting embedding generation for", crawlResult.webUrls.length, "URLs");
      await processUrlsToEmbeddings(crawlResult.webUrls, state);
      await uploadFilesFromUrls(crawlResult.pdfUrls, process.env.S3_BUCKET_NAME || "", `states/${state}`);

      // Mark job as completed
      await updateCrawlerJobStatus(job.id, 'completed', {
        web_urls_found: crawlResult.webUrls.length,
        pdf_urls_found: crawlResult.pdfUrls.length
      });

      res.json({
        message: "URLs processed successfully",
        jobId: job.id,
        stats: {
          inputUrls: validUrls.length,
          crawledWebUrls: crawlResult.webUrls.length,
          crawledPdfUrls: crawlResult.pdfUrls.length,
        },
        crawledUrls: {
          web: crawlResult.webUrls,
          pdf: crawlResult.pdfUrls
        }
      });
    } catch (error) {
      console.error("Error processing URLs:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await markCrawlerJobAsFailed(job.id, errorMessage);
      throw error;
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

/**
 * @swagger
 * /v1/comprehend/crawl/website:
 *   post:
 *     summary: Process URLs and generate embeddings in the background
 *     description: Takes an array of URLs and processes them asynchronously without waiting for completion
 *     tags: [Comprehend]
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *           enum: [AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - urls
 *             properties:
 *               urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of URLs to process
 *                 example: ["https://example.com"]
 *               maxUrls:
 *                 type: integer
 *                 description: The maximum number of URLs to crawl
 *                 example: 100
 *     responses:
 *       202:
 *         description: URLs accepted for processing
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post("/crawl/website", async (req: Request, res: Response) => {
  try {
    console.log("Received background processing request:", JSON.stringify(req.body, null, 2));
    const { urls, maxUrls = 1000 } = req.body;
    const state = req.query.state as string;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: "Invalid request",
        message: "urls must be a non-empty array of strings",
      });
    }

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
    }

    // Create a new crawler job
    const job = await createCrawlerJob(state, validUrls, maxUrls);

    // Return response immediately with job ID
    res.status(202).json({
      message: "URLs accepted for processing",
      jobId: job.id,
      stats: {
        urlsAccepted: validUrls.length,
        maxUrls,
        state
      }
    });

    // Process URLs in the background
    (async () => {
      try {
        // Update job status to processing
        await updateCrawlerJobStatus(job.id, 'processing');

        console.log("Starting background crawl with URLs:", validUrls.length);
        console.log("Max URLs to crawl:", maxUrls);

        // Crawl URLs and get all linked pages
        const crawlResult = await crawlAllLinks(validUrls, { 
          maxUrls, 
          pdfOutputDir: "./downloaded_pdfs" 
        });

        // Update progress
        await updateCrawlerJobProgress(
          job.id,
          crawlResult.webUrls.length,
          crawlResult.pdfUrls.length
        );

        console.log("Background crawl completed. Results:", {
          webUrlsCount: crawlResult.webUrls.length,
          pdfUrlsCount: crawlResult.pdfUrls.length
        });

        if (crawlResult.webUrls.length > 0) {
          // Process URLs and generate embeddings
          console.log("Starting background embedding generation for", crawlResult.webUrls.length, "URLs");
          await processUrlsToEmbeddings(crawlResult.webUrls, state);
          await uploadFilesFromUrls(crawlResult.pdfUrls, process.env.S3_BUCKET_NAME || "", `states/${state}`);
          
          // Mark job as completed
          await updateCrawlerJobStatus(job.id, 'completed', {
            web_urls_found: crawlResult.webUrls.length,
            pdf_urls_found: crawlResult.pdfUrls.length
          });

          console.log("Background processing completed for job:", job.id);
        } else {
          console.log("No valid web URLs found in background processing");
          await markCrawlerJobAsFailed(job.id, "No valid web URLs found to process");
        }
      } catch (error) {
        console.error("Error in background processing:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await markCrawlerJobAsFailed(job.id, errorMessage);
      }
    })();
  } catch (error) {
    console.error("Error processing background request:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to process request",
      message: errorMessage
    });
  }
});

export default router;
