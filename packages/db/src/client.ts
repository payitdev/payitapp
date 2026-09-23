import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDbClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required. Pass a connection string or set DATABASE_URL environment variable.');
  
  // Create postgres connection client with SSL, keepalive & auto-retry for Neon DB serverless proxy
  const queryClient = postgres(url, {
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 10,
    max_lifetime: 60,
    connect_timeout: 15,
    prepare: false,
    fetch_types: false,
    onnotice: () => {},
  });

  return drizzle(queryClient, { schema });
}


export type DbClient = ReturnType<typeof createDbClient>;
