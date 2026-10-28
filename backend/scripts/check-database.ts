import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const collections = [
  'users', 'profiles', 'scholarships', 'applications', 'documents',
  'document_reviews', 'workflow_actions', 'notifications', 'audit_logs', 'stored_files',
];

async function main() {
  const hello = await prisma.$runCommandRaw({ hello: 1 });
  if (!hello.setName || !hello.isWritablePrimary) {
    throw new Error('MongoDB must be a replica set with a writable primary. Run npm run db:start.');
  }
  const result = await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true });
  const existing = (result.cursor as { firstBatch: { name: string }[] }).firstBatch;
  const missing = collections.filter((name) => !existing.some((item) => item.name === name));
  if (missing.length) throw new Error(`Missing collections: ${missing.join(', ')}. Run npm run db:push.`);

  for (const name of collections) {
    const count = await prisma.$runCommandRaw({ count: name });
    const indexes = await prisma.$runCommandRaw({ listIndexes: name });
    const batch = (indexes.cursor as { firstBatch: unknown[] }).firstBatch;
    console.log(`${name}: ${count.n} records, ${batch.length} indexes`);
  }
  // Exercise the same transaction support used by the approval workflow, without writing data.
  await prisma.$transaction([prisma.user.count(), prisma.application.count()]);
  console.log(`Database ready: ${collections.length} collections; replica set ${hello.setName}; transactions OK.`);
}

main()
  .catch((error) => {
    // Do not print the connection URI or credentials from driver errors.
    console.error('Database check failed:', error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/g, '[MongoDB URI]') : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
