import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const EnvSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FIAT_PROVIDER_LIVE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  
  // Proxim Treasury & Monetization
  PROXIM_TREASURY_WALLET: z.string().min(1, 'PROXIM_TREASURY_WALLET is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('proxim_super_secure_jwt_secret_key_2026'),
  
  // Savings & Stocks
  PODS_API_KEY: z.string().optional(),
  ONDO_API_KEY: z.string().optional(),

  // Nuvion banking infrastructure
  NUVION_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  NUVION_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  NUVION_API_KEY: z.string().optional(),
  NUVION_SANDBOX_BASE_URL: z.string().url().default('https://api.nuvion.dev'),
  NUVION_PRODUCTION_BASE_URL: z.string().url().default('https://api.nuvion.co'),
  NUVION_API_VERSION: z.string().default('2026-02-06'),
  NUVION_WEBHOOK_SECRET: z.string().optional(),
  NUVION_ENCRYPTION_PUBLIC_KEY: z.string().optional(),

  // Privy Configuration
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  PRIVY_CLIENT_ID: z.string().optional(),

  // NEAR Chain Signatures Configuration
  NEAR_NETWORK_ID: z.enum(['mainnet'], {
    errorMap: () => ({ message: 'NEAR_NETWORK_ID must be mainnet for production' }),
  }).default('mainnet'),
  NEAR_RELAYER_ACCOUNT_ID: z.string().min(1, 'NEAR_RELAYER_ACCOUNT_ID is required'),
  NEAR_RELAYER_PRIVATE_KEY: z.string().min(1, 'NEAR_RELAYER_PRIVATE_KEY is required'),
  NEAR_GAS_TREASURY_IDENTIFIER: z.string().optional().default(''),

  // Biconomy MEE Configuration
  BICONOMY_MEE_API_KEY: z.string().optional().default(''),
  BICONOMY_PROJECT_ID: z.string().optional().default(''),

  // NEAR Intent 1Click Configuration
  NEAR_INTENT_1CLICK_API_KEY: z.string().optional().default(''),
  NEAR_INTENT_EXPLORER_API_KEY: z.string().optional().default(''),
  NEAR_INTENT_ALLOWED_ASSETS: z.string().optional(),
  NEAR_INTENT_ALLOWED_PAIRS: z.string().optional(),

  // EaseID Identity Verification (KYC/KYB for Nigerian rails)
  EASEID_APP_ID: z.string().optional().default(''),
  EASEID_API_KEY: z.string().optional().default(''),
  EASEID_BASE_URL: z.string().default('https://open-api.easeid.ai'),

  // Brails Fiat Banking Infrastructure
  BRAILS_API_KEY: z.string().optional().default(''),
  BRAILS_API_BASE_URL: z.string().default('https://api.brails.com/v1'),
  BRAILS_WEBHOOK_SECRET: z.string().optional().default(''),

  // Backend public URL for EaseID liveness callbacks
  BACKEND_PUBLIC_URL: z.string().optional().default('https://payit-backend-td53.onrender.com'),
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

export function validatePrivyEnv() {
  return {
    appId: process.env.PRIVY_APP_ID,
    appSecret: process.env.PRIVY_APP_SECRET,
    clientId: process.env.PRIVY_CLIENT_ID,
  };
}

export function validateNEAREnv() {
  const networkId = process.env.NEAR_NETWORK_ID || 'mainnet';
  const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID;
  const relayerPrivateKey = process.env.NEAR_RELAYER_PRIVATE_KEY;

  if (networkId !== 'mainnet') {
    throw new Error('Production NEAR MPC requires NEAR_NETWORK_ID=mainnet.');
  }

  if (!relayerAccountId || !relayerPrivateKey) {
    throw new Error('Production NEAR MPC requires NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY.');
  }

  return {
    networkId,
    contractId: 'v1.signer',
    relayerAccountId,
    relayerPrivateKey,
  };
}

export function validateBiconomyEnv() {
  return {
    apiKey: process.env.BICONOMY_MEE_API_KEY || 'mee_QgNK9G24KkNKeitXwh477b',
    projectId: process.env.BICONOMY_PROJECT_ID || '02059f83-8000-4ed0-a1e3-71458f2010bd',
  };
}

export function validateNEARIntentsEnv() {
  return {
    oneClickApiKey: process.env.NEAR_INTENT_1CLICK_API_KEY || '',
    explorerApiKey: process.env.NEAR_INTENT_EXPLORER_API_KEY || '',
    baseUrl: process.env.NEAR_INTENT_BASE_URL || 'https://1click.chaindefuser.com',
  };
}

