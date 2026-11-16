import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FAILED_LOGIN_ATTEMPTS: z.string().default('5').transform(Number),
  LOCKOUT_DURATION_MINUTES: z.string().default('15').transform(Number),
  PAYMENT_PROVIDER: z.enum(['MOCK', 'RAZORPAY']).default('MOCK'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('RepairHub <no-reply@repairhub.in>'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  MASTER_ADMIN_EMAIL: z.string().email().default('mrbindastanmay@gmail.com'),
  MASTER_ADMIN_INITIAL_PASSWORD: z.string().min(8).optional().default('MasterAdmin@2026!'),
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER_EMAIL: z.string().optional().default(''),
  BREVO_SENDER_NAME: z.string().optional().default('RepairHub'),
});

export const env = envSchema.parse(process.env);
