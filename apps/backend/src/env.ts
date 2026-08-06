import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_NUVION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4q95pqcOJa8RwUH4aXA
TMzgvhqKK+RBOMkSSFJ9ALFneKV8Wc5y8itkdKFpQ/YsKrxc6aLipVQ0JzfQqpto
P1MDbN1IhzWoQiGfzp4ShE5BWcndGLFnzNj9xhQSDFJPEWGgZsLxuqrsarttj7aw
IosZnnU0E71TaPQDcN4EDNCZbUSO3L9ABrhiyobwuSHoBz44BL0H6b/32iqCJ4np
mh+lgBjyccL8yloGdmf6KCt+Q2N3hfad7q/C8x5ArHC1K9ZmnlwpUzjdLE2IGdN9
wrL69p972f9aEMfneG8iDkymkk7aOgxIbJq3DU55hxUfFDl1Q0+G3zCEHsj7aCz3
hwIDAQAB
-----END PUBLIC KEY-----`;

const EnvSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NUVION_API_KEY: z.string().min(1, 'NUVION_API_KEY is required'),
  NUVION_PUBLIC_KEY: z.string().default(DEFAULT_NUVION_PUBLIC_KEY),
  NUVION_WEBHOOK_SECRET: z.string().default('nv_wsk_fa5932b5d8cf153861817bb2f21587107d7344c925e57025a38ec565ab53d49a'),
  PARTICLE_PROJECT_ID: z.string().default('75f2454c-1316-4d83-9a71-4ea850b261c2'),
  PARTICLE_CLIENT_KEY: z.string().default('cWSajgx7oVLlukErkSa9zkeF9yXOPg8nnU3Jtsx9'),
  PARTICLE_SERVER_KEY: z.string().default('s98sXsKBXVNtNe9Hx7OCbVeSFfcLCHZh6skVC56m'),
  MAGIC_PUBLISHABLE_KEY: z.string().min(1, 'MAGIC_PUBLISHABLE_KEY is required'),
  MAGIC_SECRET_KEY: z.string().min(1, 'MAGIC_SECRET_KEY is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required for payroll OCR'),
  PAYIT_TREASURY_FEE_WALLET: z.string().min(10, 'PAYIT_TREASURY_FEE_WALLET is required for treasury fee sweeps'),
  PAYIT_FX_MARGIN_PERCENT: z.string().default('0.030'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});


export function validateEnv() {
  try {
    return EnvSchema.parse(process.env);
  } catch (err: any) {
    console.error('CRITICAL CONFIGURATION ERROR: Invalid startup environment variables!', err.errors || err.message);
    process.exit(1);
  }
}

export const env = validateEnv();

