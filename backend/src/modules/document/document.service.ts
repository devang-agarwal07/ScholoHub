import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { DocumentStatus } from '../../constants/enums';
import { uploadToS3, getSignedDownloadUrl, generateS3Key } from '../../utils/s3Upload';
import { notificationService } from '../notification/notification.service';

class DocumentService {
  async upload(
    applicationId: string,
    studentId: string,
    file: Express.Multer.File,
    documentType: string
  ) {
    // Verify application belongs to student
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { scholarship: true },
    });

    if (!application) {
      throw new AppError('Application not found.', 404);
    }

    if (application.studentId !== studentId) {
      throw new AppError('You can only upload documents to your own application.', 403);
    }

    if (application.status !== 'DRAFT' && application.status !== 'SUBMITTED') {
      throw new AppError('Documents can only be uploaded for draft or submitted applications.', 400);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError('Invalid file type. Only PDF, JPEG, and PNG files are allowed.', 400);
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError('File size exceeds 5MB limit.', 400);
    }

    // Generate Cloudinary/S3 key and upload
    const originalS3Key = generateS3Key(
      application.scholarshipId,
      applicationId,
      documentType,
      file.originalname
    );

    let finalS3Key = originalS3Key;
    let s3Url = '';
    try {
      const uploadResult = await uploadToS3(file.buffer, originalS3Key, file.mimetype);
      finalS3Key = uploadResult.key;
      s3Url = uploadResult.url;
    } catch (error) {
      console.error('Upload failed:', error);
      throw new AppError('File upload failed', 500);
    }

    // Check if document of this type already exists for the application
    const existingDoc = await prisma.document.findFirst({
      where: { applicationId, documentType },
    });

    let document;
    if (existingDoc) {
      // Replace existing document
      document = await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          fileName: file.originalname,
          s3Key: finalS3Key,
          s3Url,
          status: 'PENDING',
        },
      });
    } else {
      document = await prisma.document.create({
        data: {
          applicationId,
          documentType,
          fileName: file.originalname,
          s3Key: finalS3Key,
          s3Url,
          status: 'PENDING',
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: studentId,
        action: 'UPLOAD_DOCUMENT',
        entity: 'Document',
        entityId: document.id,
        metadata: { documentType, fileName: file.originalname },
      },
    });

    return document;
  }

  async getSignedUrl(documentId: string, userId: string, userRole: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { application: { select: { studentId: true } } },
    });

    if (!document) {
      throw new AppError('Document not found.', 404);
    }

    if (userRole === 'STUDENT' && document.application.studentId !== userId) {
      throw new AppError('You do not have access to this document.', 403);
    }

    try {
      const signedUrl = await getSignedDownloadUrl(document.s3Key);
      return { signedUrl, document };
    } catch {
      // Fallback for development without S3
      return { signedUrl: document.s3Url, document };
    }
  }

  async reviewDocument(
    documentId: string,
    reviewerId: string,
    status: DocumentStatus,
    remarks?: string
  ) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        application: {
          include: {
            documents: true,
            scholarship: true,
            student: true,
          },
        },
      },
    });

    if (!document) {
      throw new AppError('Document not found.', 404);
    }

    if (status === 'REJECTED' && !remarks) {
      throw new AppError('Remarks are required when rejecting a document.', 400);
    }

    // Create review record
    await prisma.documentReview.create({
      data: {
        documentId,
        reviewerId,
        status,
        remarks,
      },
    });

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status },
    });

    // Update application status to UNDER_VERIFICATION if not already
    if (document.application.status === 'SUBMITTED') {
      await prisma.application.update({
        where: { id: document.applicationId },
        data: { status: 'UNDER_VERIFICATION' },
      });
    }

    // Check if all docs for the application are verified
    const allDocs = await prisma.document.findMany({
      where: { applicationId: document.applicationId },
    });

    const allVerified = allDocs.every((d) =>
      d.id === documentId ? status === 'VERIFIED' : d.status === 'VERIFIED'
    );

    const anyRejected = allDocs.some((d) =>
      d.id === documentId ? status === 'REJECTED' : d.status === 'REJECTED'
    );

    if (allVerified && allDocs.length > 0) {
      await prisma.application.update({
        where: { id: document.applicationId },
        data: { status: 'VERIFICATION_COMPLETE' },
      });

      await notificationService.send(
        document.application.studentId,
        'Documents Verified',
        `All your documents for "${document.application.scholarship.name}" have been verified.`
      );
    } else if (anyRejected) {
      await notificationService.send(
        document.application.studentId,
        'Document Rejected',
        `A document in your application for "${document.application.scholarship.name}" has been rejected. ${remarks ? `Reason: ${remarks}` : ''}`
      );
    }

    await prisma.auditLog.create({
      data: {
        userId: reviewerId,
        action: `REVIEW_DOCUMENT_${status}`,
        entity: 'Document',
        entityId: documentId,
        metadata: { remarks },
      },
    });

    return { message: `Document ${status.toLowerCase()} successfully.` };
  }

  async getPendingDocuments(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { status: 'PENDING' },
        orderBy: { uploadedAt: 'asc' },
        skip,
        take: limit,
        include: {
          application: {
            include: {
              student: {
                include: {
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              scholarship: { select: { name: true } },
            },
          },
          reviews: true,
        },
      }),
      prisma.document.count({ where: { status: 'PENDING' } }),
    ]);

    return { documents, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const documentService = new DocumentService();
