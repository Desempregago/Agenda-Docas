import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Backup REAL do banco PostgreSQL via pg_dump (SQL plano), gravado em disco
 * com retenção configurável (padrão: os 10 backups mais recentes).
 *
 * Restaura com:  psql "$DATABASE_URL" < backup.sql
 *
 * Diretório: BACKUP_DIR (env) ou ./backups no projeto.
 * Retenção: BACKUP_RETENTION_COUNT (env, padrão 10) — os backups mais antigos
 * são removidos após cada dump bem-sucedido (armazenamento do VPS é limitado).
 */

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
export const BACKUP_RETENTION_COUNT = Math.max(1, Number(process.env.BACKUP_RETENTION_COUNT) || 10);

export interface BackupRunResult {
  ok: boolean;
  fileName?: string;
  fileBytes?: number;
  durationMs?: number;
  pruned?: string[];
  error?: string;
}

/** Lista os arquivos .sql de backup, mais recente primeiro (pelo nome, ISO date-time). */
export function listBackupFiles(dir: string = BACKUP_DIR): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter(f => f.startsWith('agenda_docas_') && f.endsWith('.sql'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Remove backups além da retenção configurada. Retorna os arquivos removidos. */
export function pruneOldBackups(dir: string = BACKUP_DIR, keep: number = BACKUP_RETENTION_COUNT): string[] {
  const files = listBackupFiles(dir);
  const toDelete = files.slice(keep);
  const removed: string[] = [];
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, f));
      removed.push(f);
    } catch {
      // Arquivo já removido/sem permissão — segue o baile
    }
  }
  return removed;
}

/**
 * Executa o pg_dump e grava o dump em disco. Resolve quando o processo
 * fecha (código 0 = sucesso) — streaming direto para o arquivo final.
 */
export function runDatabaseBackup(options?: { dir?: string; now?: Date }): Promise<BackupRunResult> {
  const dir = options?.dir || BACKUP_DIR;
  const now = options?.now || new Date();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return Promise.resolve({ ok: false, error: 'DATABASE_URL não configurada no servidor.' });
  }

  const stamp = now
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '')
    .replace(/\..+/, ''); // agenda_docas_2026-09-14_0330.sql
  const fileName = `agenda_docas_${stamp}.sql`;
  const filePath = path.join(dir, fileName);

  return new Promise(resolve => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      resolve({ ok: false, error: `Falha ao criar o diretório de backup: ${(err as Error).message}` });
      return;
    }

    let child;
    try {
      child = spawn('pg_dump', [
        '--dbname', connectionString,
        '--format', 'plain',
        '--no-owner',
        '--no-privileges',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve({ ok: false, error: 'pg_dump não encontrado no servidor. Instale o cliente PostgreSQL (postgresql-client).' });
      return;
    }

    const startedAt = Date.now();
    let stderrBuf = '';
    let spawnError: Error | undefined;
    const out = fs.createWriteStream(filePath, { encoding: 'utf8' });

    child.on('error', (err: NodeJS.ErrnoException) => {
      spawnError = err;
    });
    child.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });
    child.stdout.pipe(out);

    child.on('close', code => {
      if (spawnError) {
        try { fs.unlinkSync(filePath); } catch { /* nada a limpar */ }
        const msg = (spawnError as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'pg_dump não encontrado no servidor. Instale o cliente PostgreSQL (postgresql-client).'
          : `Falha ao executar pg_dump: ${spawnError.message}`;
        resolve({ ok: false, error: msg });
        return;
      }
      if (code !== 0) {
        try { fs.unlinkSync(filePath); } catch { /* nada a limpar */ }
        resolve({ ok: false, error: stderrBuf.trim() || `pg_dump saiu com código ${code}.` });
        return;
      }
      // Sucesso: aplica retenção e devolve metadados
      const pruned = pruneOldBackups(dir);
      let fileBytes = 0;
      try { fileBytes = fs.statSync(filePath).size; } catch { /* ignorado */ }
      resolve({ ok: true, fileName, fileBytes, durationMs: Date.now() - startedAt, pruned });
    });
  });
}
