import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(5001),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/trustlayer'),
  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8001'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(25),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_mock_key_trustlayer'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_mock_secret_trustlayer'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_test_mock_webhook_secret'),
});

const rawEnv = {
  ...process.env,
  MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustlayer',
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('❌ FATAL: Invalid or missing environment variables:');
  parsed.error.errors.forEach((err) => {
    console.error(`  - ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;