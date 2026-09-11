/**
 * Aplica as migrations do Drizzle (pasta drizzle/) no banco de DATABASE_URL.
 * Usado por `npm run db:migrate` — o servidor também aplica automaticamente no boot.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[DB] DATABASE_URL não configurada.');
    process.exitCode = 1;
    return;
  }

  let ssl: boolean | { rejectUnauthorized: boolean } = false;
  try {
    const url = new URL(connectionString);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!isLocal) ssl = { rejectUnauthorized: false };
  } catch (_) {}

  const pool = new pg.Pool({ connectionString, ssl });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[DB] Migrations aplicadas com sucesso.');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[DB] Falha ao aplicar migrations:', err);
  process.exitCode = 1;
});
