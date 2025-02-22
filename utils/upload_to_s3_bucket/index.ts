import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import { config } from "dotenv";
import { lookup } from 'mime-types';
config({ path: '.env' });

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.REGION
});

interface UploadResult {
    url: string;
    key: string;
    success: boolean;
    error?: string;
}

export async function uploadFileFromUrl(url: string, bucketName: string, key: string): Promise<UploadResult> {
    try {
        // Download the file from the URL
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);
        const mimeType = lookup(key) || 'application/octet-stream';

        // Set up S3 upload parameters
        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
        };

        // Upload the file to S3
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log(`File uploaded successfully to s3://${bucketName}/${key}`);
        return {
            url,
            key,
            success: true
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        return {
            url,
            key,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function uploadFilesFromUrls(urls: string[], bucketName: string, keyPrefix: string = ''): Promise<UploadResult[]> {
    try {
        const uploadPromises = urls.map(url => {
            // Generate a key based on the URL path
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            const filename = pathSegments[pathSegments.length - 1];
            const key = keyPrefix ? `${keyPrefix}/${filename}` : filename;
            
            return uploadFileFromUrl(url, bucketName, key);
        });

        const results = await Promise.all(uploadPromises);
        
        // Log summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`Upload summary: ${successful} successful, ${failed} failed`);
        
        return results;
    } catch (error) {
        console.error('Error in batch upload:', error);
        throw error;
    }
}

/* Example usage:
const urls = [
    'https://www.revenue.alabama.gov/ultraviewer/viewer/basic_viewer/index.html?form=2022/02/810-9-1-.02-clean.pdf',
    'https://example.com/another-file.pdf'
];
const s3BucketName = process.env.S3_BUCKET_NAME || "";
const keyPrefix = 'states/alabama/2022/02';

uploadFilesFromUrls(urls, s3BucketName, keyPrefix); */