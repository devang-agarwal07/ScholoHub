import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    connection.on('error', (err) => {
      console.warn('Redis connection error (queues will be skipped):', err.message);
    });
  }
  return connection;
}

let emailQueue: Queue | null = null;
let reportQueue: Queue | null = null;

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue('email', { connection: getRedisConnection() as any });
  }
  return emailQueue;
}

export function getReportQueue(): Queue {
  if (!reportQueue) {
    reportQueue = new Queue('report', { connection: getRedisConnection() as any });
  }
  return reportQueue;
}

export async function addEmailJob(data: {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const queue = getEmailQueue();
    await queue.add('send-email', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  } catch {
    console.warn('Failed to enqueue email job. Redis may not be available.');
  }
}

export async function addReportJob(data: {
  type: string;
  filters: Record<string, unknown>;
  requestedBy: string;
}): Promise<string | null> {
  if (!process.env.REDIS_URL) return null;
  try {
    const queue = getReportQueue();
    const job = await queue.add('generate-report', data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
    });
    return job.id || null;
  } catch {
    console.warn('Failed to enqueue report job. Redis may not be available.');
    return null;
  }
}
