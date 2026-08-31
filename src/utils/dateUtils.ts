export const DAY_NAMES_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export const DAY_SHORT_NAMES_PT = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
];

// Padrão do sistema: Segunda a Sexta (1, 2, 3, 4, 5)
export const DEFAULT_ALLOWED_DAYS: number[] = [1, 2, 3, 4, 5];

/**
 * Converte 'YYYY-MM-DD' em objeto Date local seguro (evita problemas de fuso horário UTC)
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr || !dateStr.includes('-')) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Formata um objeto Date para 'YYYY-MM-DD'
 */
export function formatLocalDateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna o dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado) para uma string 'YYYY-MM-DD'
 */
export function getDayOfWeekFromDate(dateStr: string): number {
  const date = parseLocalDate(dateStr);
  return date.getDay();
}

/**
 * Retorna o nome por extenso do dia da semana (ex: 'Segunda-feira')
 */
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES_PT[dayOfWeek] ?? 'Desconhecido';
}

/**
 * Retorna o nome curto do dia da semana (ex: 'Seg')
 */
export function getDayShortName(dayOfWeek: number): string {
  return DAY_SHORT_NAMES_PT[dayOfWeek] ?? '';
}

/**
 * Verifica se uma data específica é permitida com base na lista de dias autorizados
 */
export function isDateAllowed(
  dateStr: string,
  allowedDays: number[] = DEFAULT_ALLOWED_DAYS,
  blockedDates: string[] = []
): boolean {
  if (!dateStr) return false;
  if (blockedDates && blockedDates.includes(dateStr)) return false;

  const validAllowed = (allowedDays && allowedDays.length > 0) ? allowedDays : DEFAULT_ALLOWED_DAYS;
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  return validAllowed.includes(dayOfWeek);
}

/**
 * Formata um resumo legível dos dias da semana permitidos
 * Ex: "Segunda a Sexta", "Segunda a Sábado", "Todos os dias" ou "Seg, Ter, Qui"
 */
export function formatAllowedDaysSummary(allowedDays: number[] = DEFAULT_ALLOWED_DAYS): string {
  if (!allowedDays || allowedDays.length === 0) {
    return 'Nenhum dia configurado';
  }

  const sorted = [...new Set(allowedDays)].sort((a, b) => a - b);

  if (sorted.length === 7) {
    return 'Todos os dias (Seg a Dom)';
  }

  // Segunda a Sexta: [1, 2, 3, 4, 5]
  const isSegSex = sorted.length === 5 && [1, 2, 3, 4, 5].every(d => sorted.includes(d));
  if (isSegSex) {
    return 'Segunda a Sexta';
  }

  // Segunda a Sábado: [1, 2, 3, 4, 5, 6]
  const isSegSab = sorted.length === 6 && [1, 2, 3, 4, 5, 6].every(d => sorted.includes(d));
  if (isSegSab) {
    return 'Segunda a Sábado';
  }

  return sorted.map(d => DAY_SHORT_NAMES_PT[d]).join(', ');
}

/**
 * Calcula a próxima data válida permitida a partir de uma data inicial (ou a partir de amanhã)
 */
export function getNextAllowedDate(
  startFromDateStr?: string,
  allowedDays: number[] = DEFAULT_ALLOWED_DAYS
): string {
  const validAllowed = (allowedDays && allowedDays.length > 0) ? allowedDays : DEFAULT_ALLOWED_DAYS;
  
  let current: Date;
  if (startFromDateStr) {
    current = parseLocalDate(startFromDateStr);
  } else {
    // Padrão: D+1 (Amanhã)
    current = new Date();
    current.setDate(current.getDate() + 1);
  }

  // Tenta encontrar o próximo dia válido nos próximos 30 dias
  for (let i = 0; i < 30; i++) {
    const ymd = formatLocalDateToYMD(current);
    if (isDateAllowed(ymd, validAllowed)) {
      return ymd;
    }
    current.setDate(current.getDate() + 1);
  }

  // Fallback seguro
  return formatLocalDateToYMD(current);
}

/**
 * Formata data com o dia da semana: Ex: "Segunda-feira, 01/09/2026"
 */
export function formatDateWithWeekday(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  const weekday = DAY_NAMES_PT[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${weekday}, ${day}/${month}/${year}`;
}
