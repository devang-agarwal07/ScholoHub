import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = `db-check-${randomUUID()}@example.invalid`;
const rollback = new Error('Intentional verification rollback');

async function main() {
  // Write all nine collections in one transaction, inspect the relations, then roll it back.
  await assert.rejects(prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email, passwordHash: 'verification-only', role: 'STUDENT',
        profile: { create: { firstName: 'Database', lastName: 'Check' } },
      },
    });
    const scholarship = await tx.scholarship.create({
      data: {
        name: 'Database verification', description: 'Rolled back after verification',
        totalBudget: 1000, perAwardAmount: 100, maxAwardees: 10,
        eligibilityCriteria: { minCgpa: 6 }, requiredDocuments: ['marksheet'],
        applicationDeadline: new Date(Date.now() + 86400000), academicYear: 'verification',
      },
    });
    const application = await tx.application.create({
      data: { studentId: user.id, scholarshipId: scholarship.id, status: 'SUBMITTED' },
    });
    const document = await tx.document.create({
      data: {
        applicationId: application.id, documentType: 'marksheet', fileName: 'check.pdf',
        s3Key: 'verification/check.pdf', s3Url: 'https://example.invalid/check.pdf',
      },
    });
    await tx.documentReview.create({
      data: { documentId: document.id, reviewerId: user.id, status: 'VERIFIED' },
    });
    await tx.workflowAction.create({
      data: { applicationId: application.id, actorId: user.id, stage: 'DOCUMENT_VERIFICATION', action: 'VERIFY' },
    });
    await tx.notification.create({ data: { userId: user.id, title: 'Check', message: 'Check' } });
    await tx.auditLog.create({
      data: { userId: user.id, action: 'CHECK', entity: 'Application', entityId: application.id },
    });
    const stored = await tx.application.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        student: { include: { profile: true } }, scholarship: true,
        documents: { include: { reviews: true } }, workflowStages: true,
      },
    });
    assert.equal(stored.student.profile?.firstName, 'Database');
    assert.equal(stored.scholarship.id, scholarship.id);
    assert.equal(stored.documents[0].reviews[0].status, 'VERIFIED');
    assert.equal(stored.workflowStages.length, 1);
    assert.equal(await tx.notification.count({ where: { userId: user.id } }), 1);
    assert.equal(await tx.auditLog.count({ where: { userId: user.id } }), 1);
    throw rollback;
  }), (error) => error === rollback);
  assert.equal(await prisma.user.count({ where: { email } }), 0);

  // Force each unique constraint to reject a duplicate, rolling back its temporary records.
  for (const constraint of ['email', 'application'] as const) {
    let attemptedDuplicate = false;
    await assert.rejects(prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash: 'verification-only', role: 'STUDENT' } });
      if (constraint === 'email') {
        attemptedDuplicate = true;
        await tx.user.create({ data: { email, passwordHash: 'verification-only', role: 'STUDENT' } });
      } else {
        const scholarship = await tx.scholarship.create({
          data: {
            name: 'Uniqueness verification', description: 'Rolled back after verification',
            totalBudget: 1000, perAwardAmount: 100, maxAwardees: 10,
            eligibilityCriteria: {}, requiredDocuments: [],
            applicationDeadline: new Date(Date.now() + 86400000), academicYear: 'verification',
          },
        });
        const data = { studentId: user.id, scholarshipId: scholarship.id };
        await tx.application.create({ data });
        attemptedDuplicate = true;
        await tx.application.create({ data });
      }
    }), (error: unknown) => attemptedDuplicate &&
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002');
    assert.equal(await prisma.user.count({ where: { email } }), 0);
  }
  console.log('PASS: writes across 9 collections, related reads, unique email/application constraints, transaction rollback.');
  console.log('Verification records were rolled back; existing data was preserved.');
}

main()
  .catch(() => { console.error('Database verification failed. Run npm run db:setup and inspect the database.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
