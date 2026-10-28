import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = (process.env.TEST_BASE_URL || 'http://127.0.0.1:5100').replace(/\/$/, '');
const marker = `deployment-${randomUUID()}`;
const password = randomBytes(24).toString('base64url');
const userIds: string[] = [];
let scholarshipId = '';
let applicationId = '';
let fileId = '';

async function request(path: string, token?: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
  return { response, data: await response.json() };
}

async function main() {
  const registration = await request('/auth/register', undefined, 'POST', {
    email: `${marker}@example.invalid`, password, firstName: 'Deployment', lastName: 'Verification',
  });
  const student = registration.data.accessToken;
  userIds.push(registration.data.user.id);
  assert.equal(registration.data.user.role, 'STUDENT');
  const cookie = registration.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const refreshed = await fetch(`${base}/api/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}',
  });
  assert.equal(refreshed.status, 200);
  assert.ok((await refreshed.json()).accessToken);
  const escalation = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `blocked-${marker}@example.invalid`, password, firstName: 'Blocked', lastName: 'Role', role: 'ADMIN' }),
  });
  assert.equal(escalation.status, 400);
  console.log('PASS: student registration, cookie refresh, blocked public staff registration.');

  const staff: Record<string, string> = {};
  const passwordHash = await bcrypt.hash(password, 12);
  for (const role of ['ADMIN', 'VERIFIER', 'COMMITTEE']) {
    const email = `${role.toLowerCase()}-${marker}@example.invalid`;
    const user = await prisma.user.create({
      data: { email, passwordHash, role, profile: { create: { firstName: 'Deployment', lastName: role } } },
    });
    userIds.push(user.id);
    staff[role] = (await request('/auth/login', undefined, 'POST', { email, password })).data.accessToken;
  }
  scholarshipId = (await request('/scholarships', staff.ADMIN, 'POST', {
    name: marker, description: 'Temporary deployment verification scholarship.', totalBudget: 1000,
    perAwardAmount: 100, maxAwardees: 10, eligibilityCriteria: {}, requiredDocuments: ['id_proof'],
    applicationDeadline: new Date(Date.now() + 86400000).toISOString(), academicYear: 'verification',
  })).data.id;
  applicationId = (await request('/applications', student, 'POST', {
    scholarshipId, personalStatement: 'Temporary deployment verification.', familyIncome: 1000,
  })).data.id;
  const content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.set('file', new Blob([content], { type: 'image/png' }), 'verification.png');
  form.set('applicationId', applicationId);
  form.set('documentType', 'id_proof');
  const document = (await request('/documents/upload', student, 'POST', form)).data;
  assert.ok(document.s3Key.startsWith('mongodb:'));
  fileId = document.s3Key.slice('mongodb:'.length);
  const signed = (await request(`/documents/${document.id}/signed-url`, student)).data.signedUrl;
  const download = await fetch(signed);
  assert.equal(download.status, 200);
  assert.ok(Buffer.from(await download.arrayBuffer()).equals(content));
  const tampered = new URL(signed);
  tampered.searchParams.set('signature', 'invalid');
  assert.equal((await fetch(tampered)).status, 403);
  console.log('PASS: scholarship/application creation, persistent upload, signed download, rejected tampered link.');

  await request(`/applications/${applicationId}/submit`, student, 'POST');
  await request(`/documents/${document.id}/review`, staff.VERIFIER, 'PUT', { status: 'VERIFIED' });
  for (let step = 0; step < 2; step++) {
    await request(`/workflow/${applicationId}/action`, staff.COMMITTEE, 'POST', { action: 'APPROVE', stage: 'COMMITTEE_REVIEW' });
  }
  const approved = (await request(`/applications/${applicationId}`, student)).data;
  assert.equal(approved.status, 'APPROVED');
  await request('/reports/summary', staff.ADMIN);
  console.log('PASS: submission, verification, committee approval, application history and admin reporting.');
  for (const path of ['/', '/login', '/student/dashboard']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('id="root"'));
  }
  console.log('PASS: frontend and deep links served with the API on one origin.');
}

async function cleanup() {
  // Only remove the temporary records created by this uniquely named verification run.
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
    if (applicationId) {
      const docs = await tx.document.findMany({ where: { applicationId }, select: { id: true } });
      await tx.documentReview.deleteMany({ where: { documentId: { in: docs.map((doc) => doc.id) } } });
      await tx.workflowAction.deleteMany({ where: { applicationId } });
      await tx.document.deleteMany({ where: { applicationId } });
      await tx.application.deleteMany({ where: { id: applicationId } });
    }
    if (fileId) await tx.storedFile.deleteMany({ where: { id: fileId } });
    if (scholarshipId) await tx.scholarship.deleteMany({ where: { id: scholarshipId } });
    await tx.profile.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  }, { timeout: 30000, maxWait: 10000 });
  console.log('Temporary verification records removed; existing records preserved.');
}

main().catch((error) => {
  console.error('Deployment verification failed:', error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/g, '[MongoDB URI]') : 'Unknown error');
  process.exitCode = 1;
}).finally(async () => {
  try { await cleanup(); } catch { console.error('Temporary verification cleanup failed.'); process.exitCode = 1; }
  await prisma.$disconnect();
});
