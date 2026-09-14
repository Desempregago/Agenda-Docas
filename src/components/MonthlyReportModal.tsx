import React, { useMemo, useState } from 'react';
import { CalendarRange, Building2, Truck, X } from 'lucide-react';
import type { Appointment, DestinationBranch } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { buildMonthlyReport, type MonthlyReport } from '../server/monthlyReport';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  destinations?: DestinationBranch[];
}

const fmtInt = (n: number) => (n || 0).toLocaleString('pt-BR');
const fmtPct = (v: number | null) => (v === null ? '—' : `${v}%`);

const monthOptions = (): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${names[(m || 1) - 1]} de ${y}`;
};

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ isOpen, onClose, appointments, destinations = [] }) => {
  useBodyScrollLock(isOpen);
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const branchNames = useMemo(
    () => new Map(destinations.map(d => [d.id, d.name])),
    [destinations]
  );
  const report: MonthlyReport = useMemo(
    () => buildMonthlyReport(appointments, month, branchNames),
    [appointments, month, branchNames]
  );
  const t = report.totals;

  if (!isOpen) return null;

  const kpis: Array<{ label: string; value: string; tone: string }> = [
    { label: 'Agendamentos', value: fmtInt(t.total), tone: 'text-slate-900' },
    { label: 'Entregas OK', value: fmtInt(t.entreguesOk), tone: 'text-emerald-700' },
    { label: 'Com Divergência', value: fmtInt(t.entreguesComDivergencia), tone: 'text-orange-700' },
    { label: 'No Show', value: fmtInt(t.noShow), tone: 'text-rose-700' },
    { label: 'Cancelados', value: fmtInt(t.cancelado), tone: 'text-slate-600' },
    { label: 'Encaixes', value: fmtInt(t.walkIns), tone: 'text-amber-700' },
    { label: 'Volumes', value: fmtInt(t.volumes), tone: 'text-blue-700' },
    { label: 'Peso (kg)', value: fmtInt(Math.round(t.pesoKg)), tone: 'text-indigo-700' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Relatório Mensal de Operação</h3>
              <p className="text-xs text-slate-500">{monthLabel(month)} — dados de agendamento (data programada)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Month selector */}
          <div className="flex flex-wrap items-center gap-2">
            {months.map(m => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  m === month
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {kpis.map(k => (
              <div key={k.label} className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className={`text-lg font-extrabold leading-tight ${k.tone}`}>{k.value}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* By supplier */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Truck className="w-3.5 h-3.5 text-blue-600" /> Por Fornecedor
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-bold px-3 py-2">Fornecedor</th>
                    <th className="text-right font-bold px-3 py-2">Agend.</th>
                    <th className="text-right font-bold px-3 py-2">Entregues</th>
                    <th className="text-right font-bold px-3 py-2">No Show</th>
                    <th className="text-right font-bold px-3 py-2">Canc.</th>
                    <th className="text-right font-bold px-3 py-2">Volumes</th>
                    <th className="text-right font-bold px-3 py-2">Diverg.</th>
                    <th className="text-right font-bold px-3 py-2" title="Chegadas na portaria dentro da janela (quando registrado)">No horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.bySupplier.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Sem agendamentos neste mês.</td></tr>
                  ) : (
                    report.bySupplier.map(r => (
                      <tr key={r.supplierCnpj} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-900 max-w-[220px] truncate" title={`${r.supplierName} (${r.supplierCnpj})`}>{r.supplierName}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtInt(r.agendamentos)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtInt(r.entregues)}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtInt(r.noShow)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtInt(r.cancelado)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtInt(r.volumes)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-700">{fmtInt(r.divergencias)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtPct(r.onTimePct)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By branch */}
          {report.byBranch.length > 1 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Por Unidade
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {report.byBranch.map(b => (
                  <div key={b.branchId} className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3">
                    <div className="text-xs font-bold text-slate-900 truncate" title={b.branchName}>{b.branchName}</div>
                    <div className="mt-1 flex items-baseline gap-3 text-[11px] text-slate-600">
                      <span><strong className="text-indigo-700">{fmtInt(b.agendamentos)}</strong> agend.</span>
                      <span><strong className="text-emerald-700">{fmtInt(b.entregues)}</strong> entregues</span>
                      <span><strong className="text-blue-700">{fmtInt(b.volumes)}</strong> vol.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            “No horário” compara o registro de chegada na portaria com o início da janela agendada; disponível para
            agendamentos cujas transições ocorreram com a trilha de auditoria ativa. Legado sem trilha aparece como “—”.
          </p>
        </div>
      </div>
    </div>
  );
};
