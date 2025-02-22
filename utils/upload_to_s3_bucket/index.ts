import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from 'axios';
import { config } from "dotenv";
import { lookup } from 'mime-types';
config({ path: '.env' });

// Initialize S3 client with region from environment variables
// Note: AWS credentials are automatically loaded from environment variables or IAM role
const s3Client = new S3Client({
  region: process.env.REGION
});

/**
 * Interface representing the result of a file upload operation
 * @property url - The source URL of the file
 * @property key - The S3 key (path) where the file was uploaded
 * @property success - Whether the upload was successful
 * @property error - Error message if the upload failed
 */
interface UploadResult {
    url: string;
    key: string;
    success: boolean;
    error?: string;
}

/**
 * Uploads a single file from a URL to an S3 bucket
 * 
 * @param url - The URL of the file to download and upload
 * @param bucketName - The name of the S3 bucket
 * @param key - The S3 key (path) where the file should be uploaded
 * @returns Promise<UploadResult> - Result of the upload operation
 * 
 * @example
 * const result = await uploadFileFromUrl(
 *   'https://example.com/document.pdf',
 *   'my-bucket',
 *   'documents/2024/document.pdf'
 * );
 */
export async function uploadFileFromUrl(url: string, bucketName: string, key: string): Promise<UploadResult> {
    try {
        // Download the file from the URL using axios
        // We use arraybuffer to handle both text and binary files
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);

        // Determine the MIME type based on the file extension
        // Falls back to 'application/octet-stream' if type cannot be determined
        const mimeType = lookup(key) || 'application/octet-stream';

        // Configure the S3 upload parameters
        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType, // Setting the correct content type ensures proper handling in S3
        };

        // Execute the upload to S3
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

/**
 * Uploads multiple files from URLs to an S3 bucket in parallel
 * 
 * @param urls - Array of URLs to download and upload
 * @param bucketName - The name of the S3 bucket
 * @param keyPrefix - Optional prefix for S3 keys (e.g., 'states/alabama/2022')
 * @returns Promise<UploadResult[]> - Results of all upload operations
 * 
 * @example
 * const results = await uploadFilesFromUrls(
 *   ['https://example.com/doc1.pdf', 'https://example.com/doc2.pdf'],
 *   'my-bucket',
 *   'states/alabama'
 * );
 * 
 * @note
 * - Files are uploaded in parallel for better performance
 * - S3 keys are automatically generated from the URL's filename
 * - If keyPrefix is provided, files will be stored under that prefix
 * - Failed uploads don't stop the process; all results are returned
 */
export async function uploadFilesFromUrls(urls: string[], bucketName: string, keyPrefix: string = ''): Promise<UploadResult[]> {
    try {
        // Create an array of upload promises for parallel processing
        const uploadPromises = urls.map(url => {
            // Extract filename from URL and construct the S3 key
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            const filename = pathSegments[pathSegments.length - 1];
            const key = keyPrefix ? `${keyPrefix}/${filename}` : filename;
            
            return uploadFileFromUrl(url, bucketName, key);
        });

        // Wait for all uploads to complete
        const results = await Promise.all(uploadPromises);
        
        // Log a summary of the upload results
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