/**
 * Rate limiting leve em memória para endpoints de autenticação.
 *
 * Propósito: frear força-bruta de senha/PIN no portal público (operador,
 * admin e fornecedor). Contagem por chave (IP + contexto), janela deslizante:
 * após MAX_FAILURES falhas dentro de FAILURE_WINDOW_MS, a chave fica
 * bloqueada por BLOCK_DURATION_MS.
 *
 * Voluntariamente em memória: reiniciar o processo limpa o contador — aceitável
 * para o tamanho e o perfil de ameaça desta aplicação, sem dependências.
 */

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const BLOCK_DURATION_MS = 60 * 1000; // 1 minuto de bloqueio

interface FailureRecord {
  timestamps: number[];
  blockedUntil?: number;
}

const store = new Map<string, FailureRecord>();

/** Extrai o IP real do cliente (atrás de proxy/Nginx usa X-Forwarded-For). */
export function clientIpFromRequest(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || 'desconhecido';
}

export type RateCheck = string | null;

/** Consulta se a chave pode tentar autenticar agora. null = permitido; string = mensagem de bloqueio. */
export function checkRateLimit(key: string, now: number = Date.now()): RateCheck {
  const record = store.get(key);
  if (!record) return null;

  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.blockedUntil - now) / 1000));
    return `Muitas tentativas incorretas. Tente novamente em ${retryAfterSeconds}s.`;
  }
  return null;
}

/** Registra uma falha de autenticação para a chave. */
export function recordRateLimitFailure(key: string, now: number = Date.now()): void {
  const record = store.get(key) ?? { timestamps: [] };
  // Descarta falhas fora da janela deslizante
  record.timestamps = record.timestamps.filter(t => now - t < FAILURE_WINDOW_MS);
  record.timestamps.push(now);

  if (record.timestamps.length >= MAX_FAILURES) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    record.timestamps = []; // janela reinicia após cumprir o bloqueio
  }
  store.set(key, record);
}

/** Limpa o histórico da chave após um sucesso legítimo. */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

/** Testes/observabilidade: estado agregado por chave. */
export function rateLimitSnapshot(key: string, now: number = Date.now()): { failures: number; blockedForSeconds: number } {
  const record = store.get(key);
  if (!record) return { failures: 0, blockedForSeconds: 0 };
  const failures = record.timestamps.filter(t => now - t < FAILURE_WINDOW_MS).length;
  const blockedForSeconds = record.blockedUntil && record.blockedUntil > now
    ? Math.ceil((record.blockedUntil - now) / 1000)
    : 0;
  return { failures, blockedForSeconds };
}

/** Usado apenas em testes para isolamento entre casos. */
export function resetRateLimits(): void {
  store.clear();
}

export const RATE_LIMIT_CONFIG = { MAX_FAILURES, FAILURE_WINDOW_MS, BLOCK_DURATION_MS };
