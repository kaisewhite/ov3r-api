import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from 'axios';

// Configure AWS S3 client
const s3Client = new S3Client({
  region: 'YOUR_AWS_REGION',
  credentials: {
    accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
  },
});

async function uploadFileFromUrl(url: string, bucketName: string, key: string): Promise<void> {
    try {
        // Download the file from the URL
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);

        // Set up S3 upload parameters
        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: fileBuffer,
        };

        // Upload the file to S3
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log(`File uploaded successfully to s3://${bucketName}/${key}`);
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

//Example usage:
/* const fileUrl = 'YOUR_FILE_URL';
const s3BucketName = process.env.S3_BUCKET_NAME;
const s3Key = 'YOUR_S3_KEY';

uploadFileFromUrl(fileUrl, s3BucketName, s3Key); */