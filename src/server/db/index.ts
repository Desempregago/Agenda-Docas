import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema';

/**
 * Pool compartilhado do Postgres. A connection string vem de DATABASE_URL
 * (Neon, RDS, ou Postgres local). SSL é ativado automaticamente para hosts
 * gerenciados (Neon etc.) e desativado para Postgres local (localhost).
 *
 * Inicialização LAZY: o pool só é criado na primeira query real. Assim,
 * importar este módulo (ex.: nos testes, via security→storage) nunca lança
 * erro por falta de DATABASE_URL.
 */
function buildPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '[DB] DATABASE_URL não configurada. Defina a connection string do Postgres no ambiente (ex: postgresql://user:pass@host:5432/agendamento).'
    );
  }

  // Valida ANTES de chegar ao driver — o erro cru do pg ("Invalid URL") não diz o que corrigir.
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(
      '[DB] DATABASE_URL inválida (não é uma URL). Formato esperado: postgresql://usuario:senha@host:5432/banco. ' +
        'Verifique: (1) começa com postgresql:// ; (2) senha sem caracteres especiais não codificados (@ : / # ? — codifique como %40 %3A %2F %23) ' +
        'ou troque a senha por uma alfanumérica; (3) no .env, nada de comentários na mesma linha da variável.'
    );
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(
      `[DB] DATABASE_URL com protocolo inesperado "${parsed.protocol}" — deve ser postgresql:// (host detectado: ${parsed.hostname}).`
    );
  }

  // SSL automático apenas para conexões TCP a hosts remotos (Neon etc.).
  // Conexões por Unix socket (host vazio na URL, ?host=/caminho) NÃO usam SSL.
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  const isSocket = parsed.hostname.length === 0;
  const ssl: boolean | { rejectUnauthorized: boolean } =
    isSocket || isLocal ? false : { rejectUnauthorized: false };

  return {
    connectionString,
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (!_pool) _pool = new pg.Pool(buildPoolConfig());
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

/**
 * Cliente Drizzle lazy: proxy que cria o pool/cliente real apenas no primeiro
 * acesso a uma propriedade (ex.: primeira query). Permite `import { db }`
 * em módulos carregados sem DATABASE_URL (testes, ferramentas de build).
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

let migrated = false;

/**
 * Aplica as migrations do Drizzle (pasta drizzle/) na inicialização.
 * Idempotente: executa de fato apenas na primeira chamada por processo.
 * Assim o deploy continua sendo só: git pull → build → pm2 restart.
 */
export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  try {
    await migrate(getDb(), { migrationsFolder: './drizzle' });
    migrated = true;
  } catch (err) {
    throw err;
  }
}

/** Health check simples usado no boot e em diagnósticos. */
export async function checkDbConnection(): Promise<{ ok: true; serverVersion: string } | { ok: false; error: string }> {
  try {
    const result = await getPool().query<{ version: string }>('SELECT version()');
    return { ok: true, serverVersion: String(result.rows[0]?.version || 'PostgreSQL') };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export { schema };
