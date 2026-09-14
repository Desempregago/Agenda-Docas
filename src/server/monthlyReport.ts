import type { Appointment, AppointmentStatus, StatusHistoryEntry } from '../types';

/**
 * Agregações do Relatório Mensal (Admin → Sistema).
 *
 * Funções puras sobre a lista de agendamentos — sem I/O — para poderem ser
 * testadas isoladamente e reutilizadas (tela, exportação futura, e-mail).
 */

export interface MonthlyReportTotals {
  total: number;
  pendente: number;
  confirmado: number;
  emTransito: number;
  noPatio: number;
  aguardandoDescarga: number;
  entreguesOk: number;
  entreguesComDivergencia: number;
  noShow: number;
  cancelado: number;
  walkIns: number;
  volumes: number;
  pesoKg: number;
  valorNotas: number;
  divergenciasRegistradas: number;
}

export interface MonthlySupplierRow {
  supplierCnpj: string;
  supplierName: string;
  agendamentos: number;
  entregues: number; // OK + com divergência
  noShow: number;
  cancelado: number;
  volumes: number;
  divergencias: number;
  onTimePct: number | null; // % de entregas dentro da janela (quando calculável)
}

export interface MonthlyBranchRow {
  branchId: string;
  branchName: string;
  agendamentos: number;
  entregues: number;
  volumes: number;
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  totals: MonthlyReportTotals;
  bySupplier: MonthlySupplierRow[];
  byBranch: MonthlyBranchRow[];
}

const DELIVERED_OK: AppointmentStatus = 'ENTREGUE_SEM_DIVERGENCIA';
const DELIVERED_DIVERG: AppointmentStatus = 'ENTREGUE_COM_DIVERGENCIA';

export function isDelivered(status: AppointmentStatus): boolean {
  return status === DELIVERED_OK || status === DELIVERED_DIVERG;
}

/** Seleciona os agendamentos cuja data de agendamento cai no mês (YYYY-MM). */
export function filterAppointmentsInMonth(appointments: Appointment[], month: string, branchId?: string): Appointment[] {
  return appointments.filter(a => {
    const d = String(a.scheduledDate || '');
    if (d.slice(0, 7) !== month) return false;
    if (branchId && (a.destinationBranchId || '') !== branchId) return false;
    return true;
  });
}

export function buildMonthlyTotals(appointments: Appointment[]): MonthlyReportTotals {
  const totals: MonthlyReportTotals = {
    total: appointments.length,
    pendente: 0,
    confirmado: 0,
    emTransito: 0,
    noPatio: 0,
    aguardandoDescarga: 0,
    entreguesOk: 0,
    entreguesComDivergencia: 0,
    noShow: 0,
    cancelado: 0,
    walkIns: 0,
    volumes: 0,
    pesoKg: 0,
    valorNotas: 0,
    divergenciasRegistradas: 0,
  };

  for (const a of appointments) {
    switch (a.status) {
      case 'PENDENTE': totals.pendente++; break;
      case 'CONFIRMADO': totals.confirmado++; break;
      case 'EM_TRANSITO': totals.emTransito++; break;
      case 'NO_PATIO': totals.noPatio++; break;
      case 'AGUARDANDO_DESCARGA': totals.aguardandoDescarga++; break;
      case DELIVERED_OK: totals.entreguesOk++; break;
      case DELIVERED_DIVERG: totals.entreguesComDivergencia++; break;
      case 'NO_SHOW': totals.noShow++; break;
      case 'CANCELADO': totals.cancelado++; break;
    }
    if (a.isWalkIn) totals.walkIns++;
    totals.volumes += Number(a.totalVolumes) || 0;
    totals.pesoKg += Number(a.weightKg) || 0;
    totals.valorNotas += Number(a.invoiceTotalValue) || 0;
    if (a.discrepancy) totals.divergenciasRegistradas++;
  }
  return totals;
}

/**
 * % on-time via trilha de auditoria: compara o momento em que o status
 * ficou NO_PATIO (chegada registrada na portaria) com o início da janela
 * agendada. Sem a trilha (registros legados), não há base — retorna null.
 */
function computeOnTimePct(history: StatusHistoryEntry[] | undefined, scheduledDate: string, timeSlot: string): number | null {
  if (!history || history.length === 0) return null;
  const gateEntry = history.find(h => h.to === 'NO_PATIO');
  if (!gateEntry) return null;

  const slotStart = String(timeSlot || '').split('-')[0]?.trim() || ''; // "08:00 - 09:30" -> "08:00"
  if (!slotStart || !/^\d{1,2}:\d{2}$/.test(slotStart)) return null;

  const windowStartMs = new Date(`${scheduledDate}T${slotStart}:00`).getTime();
  if (!Number.isFinite(windowStartMs)) return null;

  const arrivedMs = new Date(gateEntry.at).getTime();
  if (!Number.isFinite(arrivedMs)) return null;

  return arrivedMs <= windowStartMs ? 100 : 0;
}

export function buildMonthlySupplierRows(appointments: Appointment[]): MonthlySupplierRow[] {
  const map = new Map<string, MonthlySupplierRow & { _onTime: { yes: number; total: number } }>();

  for (const a of appointments) {
    const cnpj = (a.supplierCnpj || '—').replace(/\D/g, '') || '—';
    let row = map.get(cnpj);
    if (!row) {
      row = {
        supplierCnpj: a.supplierCnpj || '—',
        supplierName: a.supplierName || '—',
        agendamentos: 0,
        entregues: 0,
        noShow: 0,
        cancelado: 0,
        volumes: 0,
        divergencias: 0,
        onTimePct: null,
        _onTime: { yes: 0, total: 0 },
      };
      map.set(cnpj, row);
    }
    row.agendamentos++;
    if (isDelivered(a.status)) {
      row.entregues++;
      row.volumes += Number(a.totalVolumes) || 0;
    }
    if (a.status === 'NO_SHOW') row.noShow++;
    if (a.status === 'CANCELADO') row.cancelado++;
    if (a.discrepancy) row.divergencias++;

    const onTime = computeOnTimePct(a.statusHistory, a.scheduledDate, a.timeSlot);
    if (onTime !== null) {
      row._onTime.total++;
      if (onTime === 100) row._onTime.yes++;
    }
  }

  return Array.from(map.values())
    .map(({ _onTime, ...row }) => ({
      ...row,
      onTimePct: _onTime.total > 0 ? Math.round((_onTime.yes / _onTime.total) * 100) : null,
    }))
    .sort((a, b) => b.agendamentos - a.agendamentos);
}

export function buildMonthlyBranchRows(appointments: Appointment[], branchNames: Map<string, string>): MonthlyBranchRow[] {
  const map = new Map<string, MonthlyBranchRow>();
  for (const a of appointments) {
    const id = a.destinationBranchId || '—';
    let row = map.get(id);
    if (!row) {
      row = { branchId: id, branchName: branchNames.get(id) || 'Unidade não identificada', agendamentos: 0, entregues: 0, volumes: 0 };
      map.set(id, row);
    }
    row.agendamentos++;
    if (isDelivered(a.status)) {
      row.entregues++;
      row.volumes += Number(a.totalVolumes) || 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.agendamentos - a.agendamentos);
}

export function buildMonthlyReport(
  appointments: Appointment[],
  month: string,
  branchNames: Map<string, string>,
  branchId?: string
): MonthlyReport {
  const filtered = filterAppointmentsInMonth(appointments, month, branchId);
  return {
    month,
    totals: buildMonthlyTotals(filtered),
    bySupplier: buildMonthlySupplierRows(filtered),
    byBranch: buildMonthlyBranchRows(filtered, branchNames),
  };
}
