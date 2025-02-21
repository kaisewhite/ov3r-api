import express, { Request, Response } from 'express';
import { answerQuestion } from '../../utils/query';

const router = express.Router();

/**
 * @swagger
 * /v1/query/ask:
 *   post:
 *     summary: Ask a question about the documentation
 *     description: Ask a question about the documentation using RAG (Retrieval-Augmented Generation)
 *     tags: [Query]
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
 *               state:
 *                 type: string
 *                 description: The state associated with the URLs
 *                 example: "New York"
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
router.post('/ask', async (req: Request, res: Response) => {
    try {
        const { question, state } = req.body;

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

export default router;

/* const texas = {
    "urls": [
      "https://statutes.capitol.texas.gov/Docs/AG/htm/AG.1.htm","https://statutes.capitol.texas.gov/Docs/AG/htm/AG.12A.htm"
    ],
    "state": "Texas"
  } */