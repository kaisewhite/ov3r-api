import { Pool } from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env' });

async function createHNSWIndex() {
    const pool = new Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
    });

    try {
        console.log('Creating HNSW index...');
        const sqlPath = join(__dirname, 'create_index.sql');
        const sql = readFileSync(sqlPath, 'utf-8');
        
        await pool.query(sql);
        console.log('HNSW index created successfully!');
    } catch (error) {
        console.error('Error creating HNSW index:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute if this file is run directly
if (require.main === module) {
    createHNSWIndex()
        .catch(console.error);
}

export { createHNSWIndex };
