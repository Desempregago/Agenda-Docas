import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendStatusHistory } from '../src/server/statusHistory';
import {
  buildMonthlyReport,
  buildMonthlyTotals,
  filterAppointmentsInMonth,
} from '../src/server/monthlyReport';
import type { Appointment, StatusHistoryEntry } from '../src/types';

const appt = (overrides: Partial<Appointment>): Appointment => ({
  id: 'appt-1',
  protocol: 'AGD-2026-TEST000001',
  purchaseOrder: 'PC-2026-0001',
  invoiceNumber: 'NF-000001',
  supplierCnpj: '12.345.678/0001-90',
  supplierName: 'Fornecedor Teste Ltda',
  carrierName: 'Transportadora X',
  vehicleType: 'TRUCK_34',
  cargoType: 'PALETIZADA',
  weightKg: 1000,
  totalVolumes: 10,
  scheduledDate: '2026-09-10',
  timeSlot: '08:00 - 09:30',
  status: 'ENTREGUE_SEM_DIVERGENCIA',
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-10T14:00:00.000Z',
  rescheduleHistory: [],
  ...overrides,
});

describe('status history trail', () => {
  it('prepends the newest entry and never mutates the original list', () => {
    const original: StatusHistoryEntry[] = [
      { id: 'st-1', from: null, to: 'PENDENTE', at: '2026-09-08T12:00:00.000Z', by: 'Sistema' },
    ];
    const next = appendStatusHistory(original, {
      from: 'PENDENTE',
      to: 'CONFIRMADO',
      at: '2026-09-08T13:00:00.000Z',
      by: 'fernanda',
      byRole: 'SUPERVISOR',
    });
    assert.equal(next.length, 2);
    assert.equal(next[0].to, 'CONFIRMADO');
    assert.equal(original.length, 1);
  });

  it('accepts undefined history (legacy appointments)', () => {
    const next = appendStatusHistory(undefined, { from: null, to: 'NO_PATIO', at: 'x', by: 'Sistema' });
    assert.equal(next.length, 1);
    assert.match(next[0].id, /^st-/);
  });
});

describe('monthly report', () => {
  it('filters by month (YYYY-MM) and optionally by branch', () => {
    const list = [
      appt({ id: 'a', scheduledDate: '2026-09-10' }),
      appt({ id: 'b', scheduledDate: '2026-08-30' }),
      appt({ id: 'c', scheduledDate: '2026-09-20', destinationBranchId: 'filial-2' }),
    ];
    assert.equal(filterAppointmentsInMonth(list, '2026-09').length, 2);
    assert.equal(filterAppointmentsInMonth(list, '2026-09', 'filial-2').length, 1);
    assert.equal(filterAppointmentsInMonth(list, '2026-08').length, 1);
  });

  it('aggregates totals by status, walk-ins, volumes and discrepancies', () => {
    const list = [
      appt({ id: 'a', status: 'ENTREGUE_SEM_DIVERGENCIA', totalVolumes: 10, weightKg: 500 }),
      appt({ id: 'b', status: 'ENTREGUE_COM_DIVERGENCIA', totalVolumes: 5, discrepancy: { id: 'd1', types: [], description: 'x', reportedBy: 'op', reportedAt: 't' } }),
      appt({ id: 'c', status: 'NO_SHOW' }),
      appt({ id: 'd', status: 'PENDENTE', isWalkIn: true }),
      appt({ id: 'e', status: 'CANCELADO', invoiceTotalValue: 1234.5 }),
    ];
    const t = buildMonthlyTotals(list);
    assert.equal(t.total, 5);
    assert.equal(t.entreguesOk, 1);
    assert.equal(t.entreguesComDivergencia, 1);
    assert.equal(t.noShow, 1);
    assert.equal(t.pendente, 1);
    assert.equal(t.cancelado, 1);
    assert.equal(t.walkIns, 1);
    // Soma bruta de todos os agendamentos do mês (10+5+10+10+10)
    assert.equal(t.volumes, 45);
    assert.equal(t.pesoKg, 4500);
    assert.equal(t.valorNotas, 1234.5);
    assert.equal(t.divergenciasRegistradas, 1);
  });

  it('builds per-supplier rows with on-time percentage from the audit trail', () => {
    const list = [
      appt({
        id: 'a',
        status: 'ENTREGUE_SEM_DIVERGENCIA',
        statusHistory: [
          { id: 's2', from: 'NO_PATIO', to: 'AGUARDANDO_DESCARGA', at: '2026-09-10T14:00:00.000Z', by: 'op' },
          { id: 's1', from: 'AGUARDANDO_DESCARGA', to: 'NO_PATIO', at: '2026-09-10T07:55:00.000Z', by: 'op' }, // 5 min antes da janela
        ],
      }),
      appt({
        id: 'b',
        status: 'ENTREGUE_SEM_DIVERGENCIA',
        statusHistory: [
          { id: 's3', from: 'CONFIRMADO', to: 'NO_PATIO', at: '2026-09-10T09:10:00.000Z', by: 'op' }, // atrasado
        ],
      }),
      appt({ id: 'c', status: 'ENTREGUE_SEM_DIVERGENCIA' }), // legado sem trilha
    ];
    const report = buildMonthlyReport(list, '2026-09', new Map());
    assert.equal(report.bySupplier.length, 1);
    const row = report.bySupplier[0];
    assert.equal(row.agendamentos, 3);
    assert.equal(row.entregues, 3);
    // 2 com trilha: 1 no horário, 1 atrasado → 50%
    assert.equal(row.onTimePct, 50);
  });

  it('returns null on-time for appointments without audit trail', () => {
    const report = buildMonthlyReport([appt({ id: 'legacy' })], '2026-09', new Map());
    assert.equal(report.bySupplier[0].onTimePct, null);
  });

  it('splits rows by branch with names resolved from the map', () => {
    const list = [
      appt({ id: 'a', destinationBranchId: 'matriz' }),
      appt({ id: 'b', destinationBranchId: 'matriz' }),
      appt({ id: 'c', destinationBranchId: 'sul' }),
    ];
    const report = buildMonthlyReport(list, '2026-09', new Map([['matriz', 'Matriz CD'], ['sul', 'Filial Sul']]));
    assert.equal(report.byBranch.length, 2);
    assert.equal(report.byBranch[0].branchName, 'Matriz CD');
    assert.equal(report.byBranch[0].agendamentos, 2);
  });
});
