import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDbClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_FzVIWi01hden@ep-frosty-lab-ay6rqcus.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
  
  // Create postgres connection client with SSL enabled for Neon DB
  const queryClient = postgres(url, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(queryClient, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
