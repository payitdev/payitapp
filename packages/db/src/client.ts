import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDbClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_FzVIWi01hden@ep-frosty-lab-ay6rqcus.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
  
  // Create postgres connection client with SSL, keepalive & auto-retry for Neon DB serverless proxy
  const queryClient = postgres(url, {
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 30,
    max_lifetime: 120,
    connect_timeout: 30,
    prepare: false,
    keep_alive: 15,
    onnotice: () => {},
  });

  return drizzle(queryClient, { schema });
}


export type DbClient = ReturnType<typeof createDbClient>;
