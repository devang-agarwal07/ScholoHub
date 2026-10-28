import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

const prefix = 'mongodb:';

function signatureFor(id: string, expires: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for document links.');
  return createHmac('sha256', secret).update(`document:${id}:${expires}`).digest('base64url');
}

export function storedDocumentUrl(key: string) {
  const id = key.slice(prefix.length);
  const expires = String(Math.floor(Date.now() / 1000) + 300);
  const baseUrl = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || '5000'}`;
  return `${baseUrl}/api/documents/stored/${encodeURIComponent(id)}?expires=${expires}&signature=${signatureFor(id, expires)}`;
}

export async function storeDocument(content: Buffer, key: string, contentType: string) {
  if (content.length > 5 * 1024 * 1024) throw new AppError('File size exceeds 5MB limit.', 400);
  const file = await prisma.storedFile.create({ data: { key, content, contentType }, select: { id: true } });
  const storageKey = `${prefix}${file.id}`;
  return { key: storageKey, url: storedDocumentUrl(storageKey) };
}

export async function readStoredDocument(id: string, expires: unknown, signature: unknown) {
  if (typeof expires !== 'string' || !/^\d+$/.test(expires) || typeof signature !== 'string') {
    throw new AppError('Invalid document link.', 403);
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) < now || Number(expires) > now + 300) throw new AppError('Document link expired.', 403);
  const expected = Buffer.from(signatureFor(id, expires));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new AppError('Invalid document link.', 403);
  }
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) throw new AppError('Document not found.', 404);
  return file;
}
