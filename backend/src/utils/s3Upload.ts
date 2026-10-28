import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import fs from 'fs';
import path from 'path';
import { storeDocument, storedDocumentUrl } from './documentStorage';

// Local uploads directory
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Check if Cloudinary is configured
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadToS3(
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  if (hasCloudinary) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'scholarships',
          public_id: key,
          resource_type: 'auto', // Handles both images and raw files like PDFs
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve({
              key: result.public_id,
              url: result.secure_url,
            });
          }
        }
      );

      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }

  // Hosted uploads persist in Atlas when no external file store is configured.
  if (process.env.NODE_ENV === 'production' || process.env.DOCUMENT_STORAGE === 'mongodb') {
    return storeDocument(fileBuffer, key, contentType);
  }

  // Local storage fallback
  const filePath = path.join(uploadsDir, key);
  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  fs.writeFileSync(filePath, fileBuffer);

  const PORT = process.env.PORT || '5000';
  const normalizedKey = key.replace(/\\/g, '/');
  const localUrl = `http://localhost:${PORT}/uploads/${normalizedKey}`;

  return {
    key: normalizedKey,
    url: localUrl,
  };
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  if (key.startsWith('mongodb:')) return storedDocumentUrl(key);
  if (hasCloudinary) {
    const url = cloudinary.url(key, { secure: true });
    return url;
  }

  const PORT = process.env.PORT || '5000';
  const normalizedKey = key.replace(/\\/g, '/');
  return `http://localhost:${PORT}/uploads/${normalizedKey}`;
}

export function generateS3Key(
  scholarshipId: string,
  applicationId: string,
  docType: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  if (hasCloudinary) {
    const nameWithoutExt = sanitizedName.split('.').slice(0, -1).join('.') || sanitizedName;
    return `${scholarshipId}/${applicationId}/${docType}/${timestamp}_${nameWithoutExt}`;
  }

  // Keep file extension for local serving
  return `${scholarshipId}/${applicationId}/${docType}/${timestamp}_${sanitizedName}`;
}
