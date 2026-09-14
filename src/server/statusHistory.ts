import type { AppointmentStatus, StatusHistoryEntry } from '../types';

/**
 * Fábrica de entradas da trilha de auditoria de status.
 * Sempre cria nova lista (imutável) — a entrada mais recente fica primeiro,
 * mesma convenção do rescheduleHistory.
 */
export function appendStatusHistory(
  current: StatusHistoryEntry[] | undefined,
  entry: Omit<StatusHistoryEntry, 'id'>
): StatusHistoryEntry[] {
  const withId: StatusHistoryEntry = {
    ...entry,
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  return [withId, ...(current || [])];
}
