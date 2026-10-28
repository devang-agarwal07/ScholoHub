import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { documentService } from './document.service';
import { DocumentStatus } from '../../constants/enums';

const reviewSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  remarks: z.string().optional(),
});

export class DocumentController {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded.' });
        return;
      }

      const applicationId = req.body.applicationId;
      const documentType = req.body.documentType;

      if (!applicationId || !documentType) {
        res.status(400).json({ message: 'applicationId and documentType are required.' });
        return;
      }

      const document = await documentService.upload(
        applicationId,
        req.user!.userId,
        req.file,
        documentType
      );

      res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  }

  async getSignedUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await documentService.getSignedUrl(req.params.id, req.user!.userId, req.user!.role);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async review(req: Request, res: Response, next: NextFunction) {
    try {
      const data = reviewSchema.parse(req.body);
      const result = await documentService.reviewDocument(
        req.params.id,
        req.user!.userId,
        data.status as DocumentStatus,
        data.remarks
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPendingDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const result = await documentService.getPendingDocuments(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
