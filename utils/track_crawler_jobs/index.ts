import prisma from "../../configurations/prisma/index.js";

type CrawlerJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface CrawlerJob {
    id: string;
    state: string;
    urls: string[];
    max_urls?: number;
    status: CrawlerJobStatus;
    web_urls_found?: number;
    pdf_urls_found?: number;
    error_message?: string;
    started_at?: Date;
    completed_at?: Date;
    duration_seconds?: number;
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Helper function to sanitize nullable Prisma fields
 */
function sanitizeJob(job: any): CrawlerJob {
    return {
        ...job,
        // Handle both JSON string and raw string array from Prisma
        urls: typeof job.urls === 'string' ? 
            (job.urls.startsWith('[') ? JSON.parse(job.urls) : [job.urls]) : 
            (Array.isArray(job.urls) ? job.urls : []),
        max_urls: job.max_urls ?? undefined,
        web_urls_found: job.web_urls_found ?? undefined,
        pdf_urls_found: job.pdf_urls_found ?? undefined,
        error_message: job.error_message ?? undefined,
        started_at: job.started_at ?? undefined,
        completed_at: job.completed_at ?? undefined,
        duration_seconds: job.duration_seconds ? Number(job.duration_seconds) : undefined,
        created_at: job.created_at ?? undefined,
        updated_at: job.updated_at ?? undefined
    };
}

/**
 * Creates a new crawler job in the database
 */
export async function createCrawlerJob(state: string, urls: string[], maxUrls?: number): Promise<CrawlerJob> {
    try {
        // Ensure urls is an array and convert to JSON string
        const urlsArray = Array.isArray(urls) ? urls : [urls];
        
        const result = await prisma.crawler_jobs.create({
            data: {
                state,
                urls: urlsArray, // Prisma will handle the JSON serialization
                max_urls: maxUrls || 1000,
                status: 'pending'
            }
        });

        return sanitizeJob(result);
    } catch (error) {
        console.error("Error in createCrawlerJob:", error);
        throw new Error("Failed to create crawler job.");
    }
}

/**
 * Updates the status of a crawler job
 */
export async function updateCrawlerJobStatus(
    jobId: string,
    status: CrawlerJobStatus,
    data?: Partial<CrawlerJob>
): Promise<void> {
    try {
        const updateData: any = { status, ...data };

        if (status === 'processing' && !data?.started_at) {
            updateData.started_at = new Date();
        }

        if (status === 'completed' || status === 'failed') {
            const currentJob = await prisma.crawler_jobs.findUnique({
                where: { id: jobId },
                select: { started_at: true }
            });

            const now = new Date();
            updateData.completed_at = now;

            if (currentJob?.started_at) {
                updateData.duration_seconds = (now.getTime() - new Date(currentJob.started_at).getTime()) / 1000;
            }
        }

        // Handle urls field if present
        if (updateData.urls) {
            const urlsArray = Array.isArray(updateData.urls) ? updateData.urls : [updateData.urls];
            updateData.urls = urlsArray; // Let Prisma handle JSON serialization
        }

        await prisma.crawler_jobs.update({
            where: { id: jobId },
            data: updateData
        });
    } catch (error) {
        console.error(`Error updating crawler job ${jobId}:`, error);
        throw new Error(`Failed to update crawler job ${jobId}.`);
    }
}

/**
 * Gets a crawler job by its ID
 */
export async function getCrawlerJob(jobId: string): Promise<CrawlerJob | null> {
    try {
        const result = await prisma.crawler_jobs.findUnique({
            where: { id: jobId }
        });

        if (!result) return null;

        return sanitizeJob(result);
    } catch (error) {
        console.error("Error in getCrawlerJob:", error);
        throw new Error("Failed to retrieve crawler job.");
    }
}

/**
 * Lists crawler jobs with optional filters
 */
export async function listCrawlerJobs(filters?: {
    state?: string;
    status?: CrawlerJobStatus;
    limit?: number;
    offset?: number;
}): Promise<CrawlerJob[]> {
    try {
        const results = await prisma.crawler_jobs.findMany({
            where: {
                state: filters?.state,
                status: filters?.status
            },
            orderBy: {
                created_at: 'desc'
            },
            take: filters?.limit,
            skip: filters?.offset
        });

        return results.map(sanitizeJob);
    } catch (error) {
        console.error("Error in listCrawlerJobs:", error);
        throw new Error("Failed to list crawler jobs.");
    }
}

/**
 * Updates the progress of a crawler job
 */
export async function updateCrawlerJobProgress(
    jobId: string,
    webUrlsFound: number,
    pdfUrlsFound: number
): Promise<void> {
    try {
        await prisma.crawler_jobs.update({
            where: { id: jobId },
            data: {
                web_urls_found: webUrlsFound,
                pdf_urls_found: pdfUrlsFound
            }
        });
    } catch (error) {
        console.error(`Error updating crawler job progress for ${jobId}:`, error);
        throw new Error(`Failed to update progress for job ${jobId}.`);
    }
}

/**
 * Marks a job as failed with an error message
 */
export async function markCrawlerJobAsFailed(
    jobId: string,
    errorMessage: string
): Promise<void> {
    try {
        await updateCrawlerJobStatus(jobId, 'failed', { error_message: errorMessage });
    } catch (error) {
        console.error(`Error marking job ${jobId} as failed:`, error);
        throw new Error(`Failed to mark job ${jobId} as failed.`);
    }
}

/**
 * Global error handlers for uncaught exceptions and unhandled rejections
 */
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1); // Force exit to prevent undefined behavior
});
