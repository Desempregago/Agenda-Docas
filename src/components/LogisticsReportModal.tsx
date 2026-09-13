import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Printer,
  Calendar,
  Clock,
  Building2,
  Truck,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  TrendingUp,
  RotateCcw,
  Zap,
  BarChart3,
  Search
} from 'lucide-react';
import { Appointment, AppointmentStatus, DestinationBranch, Dock } from '../types';
import { triggerLocalDownload } from '../services/localExportService';
import { formatCnpj, formatCurrencyBRL } from '../utils/formatters';
import { formatLocalDateToYMD } from '../utils/dateUtils';

interface LogisticsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  destinations?: DestinationBranch[];
  docks?: Dock[];
}

// Status legíveis
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  EM_TRANSITO: 'Em Trânsito',
  NO_PATIO: 'No Pátio / Portaria',
  AGUARDANDO_DESCARGA: 'Em Descarga',
  ENTREGUE_SEM_DIVERGENCIA: 'Concluído OK',
  ENTREGUE_COM_DIVERGENCIA: 'Concluído c/ Divergência',
  NO_SHOW: 'Não Compareceu (No-Show)',
  CANCELADO: 'Cancelado',
};

export const LogisticsReportModal: React.FC<LogisticsReportModalProps> = ({
  isOpen,
  onClose,
  appointments,
  destinations = [],
  docks = [],
}) => {
  // Filtros
  const [startDate, setStartDate] = useState<string>(() => {
    // Primeiro dia do mês atual ou 7 dias atrás
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return formatLocalDateToYMD(d);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return formatLocalDateToYMD(new Date());
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOrigin, setSelectedOrigin] = useState<'ALL' | 'AGENDADO' | 'WALKIN'>('ALL');
  const [supplierSearch, setSupplierSearch] = useState<string>('');

  // Filtragem dos agendamentos
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      // 1. Data
      const apptDate = a.scheduledDate || '';
      if (startDate && apptDate < startDate) return false;
      if (endDate && apptDate > endDate) return false;

      // 2. Filial / Destino
      if (selectedBranch !== 'ALL') {
        if (a.destinationBranchId && a.destinationBranchId !== selectedBranch) return false;
        if (!a.destinationBranchId) {
          const defBranch = destinations.find(d => d.isDefault) || destinations[0];
          if (defBranch && defBranch.id !== selectedBranch) return false;
        }
      }

      // 3. Status
      if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;

      // 4. Origem (Agendado vs Walk-in)
      if (selectedOrigin === 'WALKIN' && !a.isWalkIn) return false;
      if (selectedOrigin === 'AGENDADO' && a.isWalkIn) return false;

      // 5. Busca por Fornecedor / CNPJ / NF / Protocolo
      if (supplierSearch.trim()) {
        const query = supplierSearch.toLowerCase().trim();
        const matches =
          (a.supplierName || '').toLowerCase().includes(query) ||
          (a.supplierCnpj || '').replace(/\D/g, '').includes(query.replace(/\D/g, '')) ||
          (a.invoiceNumber || '').toLowerCase().includes(query) ||
          (a.protocol || '').toLowerCase().includes(query) ||
          (a.vehiclePlate || '').toLowerCase().includes(query) ||
          (a.carrierName || '').toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordenação decrescente de data e depois horário
      if (a.scheduledDate !== b.scheduledDate) {
        return b.scheduledDate.localeCompare(a.scheduledDate);
      }
      return (a.timeSlot || '').localeCompare(b.timeSlot || '');
    });
  }, [appointments, startDate, endDate, selectedBranch, selectedStatus, selectedOrigin, supplierSearch, destinations]);

  // Estatísticas e SLAs de Carga e Descarga
  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    let completedOk = 0;
    let completedDivergent = 0;
    let walkIns = 0;
    let noShows = 0;
    let inProgress = 0;
    let totalVolumes = 0;
    let totalWeightKg = 0;
    let totalValue = 0;

    // Métricas de Tempo
    let totalYardWaitMinutes = 0;
    let yardWaitCount = 0;
    let totalUnloadMinutes = 0;
    let unloadCount = 0;

    for (const a of filteredAppointments) {
      if (a.status === 'ENTREGUE_SEM_DIVERGENCIA') completedOk++;
      if (a.status === 'ENTREGUE_COM_DIVERGENCIA') completedDivergent++;
      if (a.status === 'NO_SHOW') noShows++;
      if (a.isWalkIn) walkIns++;
      if (['EM_TRANSITO', 'NO_PATIO', 'AGUARDANDO_DESCARGA'].includes(a.status)) inProgress++;

      totalVolumes += Number(a.totalVolumes || 0);
      totalWeightKg += Number(a.weightKg || 0);
      if (a.invoiceTotalValue) totalValue += Number(a.invoiceTotalValue);

      // Cálculo de tempos com base nos statusTimestamps se existirem
      const ts = a.statusTimestamps || {};
      const patioTime = ts.NO_PATIO ? new Date(ts.NO_PATIO).getTime() : null;
      const dockTime = ts.AGUARDANDO_DESCARGA ? new Date(ts.AGUARDANDO_DESCARGA).getTime() : null;
      const doneTime = (ts.ENTREGUE_SEM_DIVERGENCIA || ts.ENTREGUE_COM_DIVERGENCIA)
        ? new Date(ts.ENTREGUE_SEM_DIVERGENCIA || ts.ENTREGUE_COM_DIVERGENCIA!).getTime()
        : null;

      // Tempo de permanência no pátio até entrar na doca
      if (patioTime && dockTime && dockTime >= patioTime) {
        const diffMin = Math.round((dockTime - patioTime) / 60000);
        if (diffMin > 0 && diffMin < 1440) { // Menor que 24h
          totalYardWaitMinutes += diffMin;
          yardWaitCount++;
        }
      }

      // Tempo de descarga na doca
      if (dockTime && doneTime && doneTime >= dockTime) {
        const diffMin = Math.round((doneTime - dockTime) / 60000);
        if (diffMin > 0 && diffMin < 1440) {
          totalUnloadMinutes += diffMin;
          unloadCount++;
        }
      }
    }

    const completedTotal = completedOk + completedDivergent;
    const otifAccuracy = completedTotal > 0 ? ((completedOk / completedTotal) * 100).toFixed(1) : '100';
    const avgYardWait = yardWaitCount > 0 ? Math.round(totalYardWaitMinutes / yardWaitCount) : null;
    const avgUnload = unloadCount > 0 ? Math.round(totalUnloadMinutes / unloadCount) : null;

    return {
      total,
      completedOk,
      completedDivergent,
      walkIns,
      noShows,
      inProgress,
      totalVolumes,
      totalWeightKg,
      totalValue,
      otifAccuracy,
      avgYardWait,
      avgUnload,
    };
  }, [filteredAppointments]);

  // Função para exportar em Excel / CSV formatado e compatível
  const handleExportCSV = () => {
    const filename = `Relatorio_Performance_Docas_${startDate}_a_${endDate}.csv`;

    const headers = [
      'Protocolo',
      'Data Agendada',
      'Janela / Horário',
      'Status Operacional',
      'Tipo de Entrada',
      'Razão Social Fornecedor',
      'CNPJ Fornecedor',
      'Unidade / Filial Destino',
      'Doca Alocada',
      'Notas Fiscais',
      'Chaves de Acesso NF-e (44 dígitos)',
      'Valor Total das Notas (R$)',
      'Transportadora',
      'Placa do Veículo',
      'Tipo de Veículo',
      'Tipo de Carga',
      'Volumes (cx/paletes)',
      'Peso Líquido (kg)',
      'Nome do Motorista',
      'CPF Motorista',
      'Telefone Motorista',
      'Prevenção Double-Check',
      'Operador Prevenção',
      'Data/Hora Double-Check',
      'Check-in Pátio (Data/Hora)',
      'Entrada na Doca (Data/Hora)',
      'Conclusão Descarga (Data/Hora)',
      'Tempo de Pátio (Minutos)',
      'Tempo de Descarga (Minutos)',
      'Divergências Encontradas',
      'Observações Gerais'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredAppointments.map(a => {
      const keysJoined = Array.isArray(a.nfeAccessKeys) && a.nfeAccessKeys.length > 0
        ? a.nfeAccessKeys.join(' | ')
        : (a.nfeAccessKey || '');

      const nfList = Array.isArray(a.invoiceNumbers) && a.invoiceNumbers.length > 0
        ? a.invoiceNumbers.join(' / ')
        : (a.invoiceNumber || '');

      const formattedVal = a.invoiceTotalValue !== undefined && a.invoiceTotalValue !== null
        ? Number(a.invoiceTotalValue).toFixed(2).replace('.', ',')
        : '';

      const ts = a.statusTimestamps || {};
      const patioTime = ts.NO_PATIO ? new Date(ts.NO_PATIO) : null;
      const dockTime = ts.AGUARDANDO_DESCARGA ? new Date(ts.AGUARDANDO_DESCARGA) : null;
      const doneTime = (ts.ENTREGUE_SEM_DIVERGENCIA || ts.ENTREGUE_COM_DIVERGENCIA)
        ? new Date(ts.ENTREGUE_SEM_DIVERGENCIA || ts.ENTREGUE_COM_DIVERGENCIA!)
        : null;

      let waitMin = '';
      if (patioTime && dockTime && dockTime.getTime() >= patioTime.getTime()) {
        waitMin = String(Math.round((dockTime.getTime() - patioTime.getTime()) / 60000));
      }

      let unloadMin = '';
      if (dockTime && doneTime && doneTime.getTime() >= dockTime.getTime()) {
        unloadMin = String(Math.round((doneTime.getTime() - dockTime.getTime()) / 60000));
      }

      const discrepancyNotes = a.discrepancy
        ? `${(a.discrepancy.types || []).join(', ')}: ${a.discrepancy.description}`
        : '';

      return [
        escapeCSV(a.protocol),
        escapeCSV(a.scheduledDate),
        escapeCSV(a.timeSlot),
        escapeCSV(STATUS_LABELS[a.status] || a.status),
        escapeCSV(a.isWalkIn ? 'Encaixe de Emergência' : 'Agendado Previamente'),
        escapeCSV(a.supplierName),
        escapeCSV(a.supplierCnpj),
        escapeCSV(a.destinationBranchName || ''),
        escapeCSV(a.dockId || 'Não Alocada'),
        escapeCSV(nfList),
        escapeCSV(keysJoined),
        escapeCSV(formattedVal),
        escapeCSV(a.carrierName || ''),
        escapeCSV(a.vehiclePlate || ''),
        escapeCSV(a.vehicleType || ''),
        escapeCSV(a.cargoType || ''),
        escapeCSV(a.totalVolumes || 0),
        escapeCSV(a.weightKg || 0),
        escapeCSV(a.driverName || ''),
        escapeCSV(a.driverCpf || ''),
        escapeCSV(a.driverPhone || ''),
        escapeCSV(a.preventionDoubleChecked ? 'SIM' : 'NÃO'),
        escapeCSV(a.preventionCheckedBy || ''),
        escapeCSV(a.preventionCheckedAt ? new Date(a.preventionCheckedAt).toLocaleString('pt-BR') : ''),
        escapeCSV(patioTime ? patioTime.toLocaleString('pt-BR') : ''),
        escapeCSV(dockTime ? dockTime.toLocaleString('pt-BR') : ''),
        escapeCSV(doneTime ? doneTime.toLocaleString('pt-BR') : ''),
        escapeCSV(waitMin),
        escapeCSV(unloadMin),
        escapeCSV(discrepancyNotes),
        escapeCSV(a.notes || '')
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n');

    triggerLocalDownload(csvContent, filename, 'text/csv;charset=utf-8');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Top Header (Não impresso se for para folha A4) */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Relatório de Performance de Portaria & Recebimento
                </h2>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  SLA & Demurrage
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoria de pontualidade, tempos de descarga, ocupação de docas e exportação fiscal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtros em Barra Superior */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Período De / Até */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> De (Data Inicial)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Até (Data Final)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Filial */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" /> Unidade / Destino
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">Todas as Unidades</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> Status
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">Todos os Status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Tipo de Entrada */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" /> Tipo de Entrada
              </label>
              <select
                value={selectedOrigin}
                onChange={e => setSelectedOrigin(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="ALL">Agendados & Encaixes</option>
                <option value="AGENDADO">Apenas Agendados</option>
                <option value="WALKIN">Apenas Encaixes (Walk-in)</option>
              </select>
            </div>
          </div>

          {/* Busca Livre */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Fornecedor, CNPJ, Número de NF, Placa ou Protocolo..."
              value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Dashboard de Métricas Rápidas (KPIs / SLA) */}
        <div className="p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total de Cargas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-slate-900">{stats.total}</span>
                <span className="text-[10px] text-slate-500 font-medium">{stats.walkIns} encaixes</span>
              </div>
            </div>

            {/* Concluído OK */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Concluídas Sem Ressalva</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-emerald-900">{stats.completedOk}</span>
                <span className="text-[10px] font-bold text-emerald-700">{stats.otifAccuracy}% OK</span>
              </div>
            </div>

            {/* Divergências */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Divergências / Ressalvas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-amber-900">{stats.completedDivergent}</span>
                <span className="text-[10px] text-amber-700 font-medium">{stats.noShows} no-show</span>
              </div>
            </div>

            {/* Tempo Médio de Pátio */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">Espera em Pátio (Médio)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-blue-900">
                  {stats.avgYardWait !== null ? `${stats.avgYardWait} min` : 'N/D'}
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Até a doca</span>
              </div>
            </div>

            {/* Tempo Médio de Descarga */}
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <span className="text-[10px] uppercase font-bold text-purple-800 block">Tempo Descarga (Médio)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-purple-900">
                  {stats.avgUnload !== null ? `${stats.avgUnload} min` : 'N/D'}
                </span>
                <span className="text-[10px] text-purple-600 font-medium">Na doca</span>
              </div>
            </div>

            {/* Volume Total */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Volumes / Peso</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-black text-slate-900">{stats.totalVolumes.toLocaleString('pt-BR')} vol</span>
                <span className="text-[10px] text-slate-500 font-mono">{(stats.totalWeightKg / 1000).toFixed(1)}t</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Resultados */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Nenhum registro encontrado para este filtro.</p>
              <p className="text-xs text-slate-500 mt-0.5">Tente expandir o intervalo de datas ou remover filtros específicos.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Data / Hora</th>
                    <th className="p-2.5">Protocolo</th>
                    <th className="p-2.5">Fornecedor / CNPJ</th>
                    <th className="p-2.5">NFs / Chaves</th>
                    <th className="p-2.5">Placa / Veículo</th>
                    <th className="p-2.5">Doca</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Volumes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAppointments.map((a, idx) => {
                    const isWalkIn = a.isWalkIn;
                    const statusColor =
                      a.status === 'ENTREGUE_SEM_DIVERGENCIA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : a.status === 'ENTREGUE_COM_DIVERGENCIA'
                        ? 'bg-amber-100 text-amber-800'
                        : a.status === 'NO_PATIO'
                        ? 'bg-purple-100 text-purple-800'
                        : a.status === 'AGUARDANDO_DESCARGA'
                        ? 'bg-blue-100 text-blue-800'
                        : a.status === 'NO_SHOW'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-800';

                    return (
                      <tr key={a.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-bold text-slate-900 block">
                            {a.scheduledDate ? a.scheduledDate.split('-').reverse().join('/') : ''}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{a.timeSlot}</span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 block">{a.protocol}</span>
                          {isWalkIn && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full inline-block">
                              ⚡ Encaixe
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 max-w-[220px]">
                          <span className="font-semibold text-slate-900 block truncate" title={a.supplierName}>
                            {a.supplierName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {a.supplierCnpj || '-'}
                          </span>
                        </td>
                        <td className="p-2.5 max-w-[180px]">
                          <span className="font-semibold text-slate-800 block truncate">
                            NF: {a.invoiceNumber || '-'}
                          </span>
                          {Array.isArray(a.nfeAccessKeys) && a.nfeAccessKeys.length > 0 && (
                            <span className="text-[10px] text-slate-500 block truncate font-mono">
                              {a.nfeAccessKeys.length} chave(s) bipadas
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 block">{a.vehiclePlate || 'Sem placa'}</span>
                          <span className="text-[10px] text-slate-500">{a.vehicleType}</span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 block">
                            {a.dockId || <span className="text-slate-400 italic">Pátio</span>}
                          </span>
                          {a.destinationBranchName && (
                            <span className="text-[9px] text-slate-500 block truncate max-w-[100px]">
                              {a.destinationBranchName}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap font-mono font-semibold text-slate-800">
                          {a.totalVolumes ? a.totalVolumes.toLocaleString('pt-BR') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé com Resumo de Exportação */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-600 font-medium">
            Exibindo <strong>{filteredAppointments.length}</strong> de <strong>{appointments.length}</strong> registros cadastrados.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Relatório em Excel (.CSV)</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
