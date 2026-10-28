import { Router } from 'express';
import multer from 'multer';
import { documentController } from './document.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { uploadLimiter } from '../../middleware/rateLimiter';
import { readStoredDocument } from '../../utils/documentStorage';
import path from 'path';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = Router();

// Access is granted only by the short-lived signed URL issued after authorization.
router.get('/stored/:fileId', async (req, res, next) => {
  try {
    const file = await readStoredDocument(req.params.fileId, req.query.expires, req.query.signature);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(file.key).replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(file.content));
  } catch (error) { next(error); }
});

// Student uploads document
router.post(
  '/upload',
  authenticate,
  authorize('STUDENT'),
  uploadLimiter,
  upload.single('file'),
  (req, res, next) => documentController.upload(req, res, next)
);

// Get signed URL for document viewing
router.get('/:id/signed-url', authenticate, (req, res, next) =>
  documentController.getSignedUrl(req, res, next)
);

// Verifier reviews document
router.put('/:id/review', authenticate, authorize('VERIFIER', 'ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  documentController.review(req, res, next)
);

// Get pending documents for verifiers
router.get('/pending', authenticate, authorize('VERIFIER', 'ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  documentController.getPendingDocuments(req, res, next)
);

export default router;
