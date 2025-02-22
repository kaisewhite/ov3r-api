import pkg from 'pg';
const { Pool } = pkg;

const dbConfig = {
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
};

const pool = new Pool(dbConfig);

interface CrawlerJob {
    id: string;
    state: string;
    urls: string[];
    max_urls?: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
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
 * Creates a new crawler job in the database
 * @param state Two-letter state code
 * @param urls Array of URLs to crawl
 * @param maxUrls Maximum number of URLs to crawl (optional)
 * @returns The created job record
 */
export async function createCrawlerJob(state: string, urls: string[], maxUrls?: number): Promise<CrawlerJob> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `INSERT INTO crawler_jobs (state, urls, max_urls, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING *`,
            [state, JSON.stringify(urls), maxUrls || 1000]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

/**
 * Updates the status of a crawler job
 * @param jobId UUID of the job to update
 * @param status New status
 * @param data Additional data to update
 */
export async function updateCrawlerJobStatus(
    jobId: string,
    status: CrawlerJob['status'],
    data?: Partial<CrawlerJob>
): Promise<void> {
    const client = await pool.connect();
    try {
        // First, get the current job to calculate duration if needed
        let currentJob;
        if (status === 'completed' || status === 'failed') {
            const result = await client.query(
                'SELECT started_at FROM crawler_jobs WHERE id = $1',
                [jobId]
            );
            currentJob = result.rows[0];
        }

        const updates: string[] = ['status = $2'];
        const values: any[] = [jobId, status];
        let paramCount = 3;

        if (data) {
            if (status === 'processing' && !data.started_at) {
                data.started_at = new Date();
            }
            if (status === 'completed' || status === 'failed') {
                const now = new Date();
                data.completed_at = now;
                
                // Calculate duration if we have a started_at time
                if (currentJob?.started_at) {
                    data.duration_seconds = (now.getTime() - new Date(currentJob.started_at).getTime()) / 1000;
                }
            }

            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    updates.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            });
        }

        await client.query(
            `UPDATE crawler_jobs 
             SET ${updates.join(', ')}
             WHERE id = $1`,
            values
        );
    } finally {
        client.release();
    }
}

/**
 * Gets a crawler job by its ID
 * @param jobId UUID of the job to retrieve
 * @returns The job record or null if not found
 */
export async function getCrawlerJob(jobId: string): Promise<CrawlerJob | null> {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM crawler_jobs WHERE id = $1',
            [jobId]
        );
        return result.rows[0] || null;
    } finally {
        client.release();
    }
}

/**
 * Lists crawler jobs with optional filters
 * @param filters Optional filters for the query
 * @returns Array of job records
 */
export async function listCrawlerJobs(filters?: {
    state?: string;
    status?: CrawlerJob['status'];
    limit?: number;
    offset?: number;
}): Promise<CrawlerJob[]> {
    const client = await pool.connect();
    try {
        const conditions: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (filters?.state) {
            conditions.push(`state = $${paramCount}`);
            values.push(filters.state);
            paramCount++;
        }

        if (filters?.status) {
            conditions.push(`status = $${paramCount}`);
            values.push(filters.status);
            paramCount++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : '';
        const offsetClause = filters?.offset ? `OFFSET ${filters.offset}` : '';

        const result = await client.query(
            `SELECT * FROM crawler_jobs
             ${whereClause}
             ORDER BY created_at DESC
             ${limitClause}
             ${offsetClause}`,
            values
        );
        return result.rows;
    } finally {
        client.release();
    }
}

/**
 * Updates the progress of a crawler job
 * @param jobId UUID of the job to update
 * @param webUrlsFound Number of web URLs found
 * @param pdfUrlsFound Number of PDF URLs found
 */
export async function updateCrawlerJobProgress(
    jobId: string,
    webUrlsFound: number,
    pdfUrlsFound: number
): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE crawler_jobs 
             SET web_urls_found = $2,
                 pdf_urls_found = $3
             WHERE id = $1`,
            [jobId, webUrlsFound, pdfUrlsFound]
        );
    } finally {
        client.release();
    }
}

/**
 * Marks a job as failed with an error message
 * @param jobId UUID of the job to update
 * @param errorMessage Error message to store
 */
export async function markCrawlerJobAsFailed(
    jobId: string,
    errorMessage: string
): Promise<void> {
    await updateCrawlerJobStatus(jobId, 'failed', { error_message: errorMessage });
}