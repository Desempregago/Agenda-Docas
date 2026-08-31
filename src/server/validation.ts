import type { AppointmentStatus } from '../types';

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'PENDENTE', 'CONFIRMADO', 'EM_TRANSITO', 'NO_PATIO', 'AGUARDANDO_DESCARGA',
  'ENTREGUE_SEM_DIVERGENCIA', 'ENTREGUE_COM_DIVERGENCIA', 'NO_SHOW', 'CANCELADO'
];

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function businessToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

export function dayOfWeekForDate(value: string): number {
  return new Date(value + 'T12:00:00Z').getUTCDay();
}

export function normalizeNfeKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item ?? '').replace(/\D/g, '')).filter(item => item.length === 44).slice(0, 20);
}
