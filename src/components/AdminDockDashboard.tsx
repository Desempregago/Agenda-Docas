import React, { useState, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Clock,
  Plus,
  User,
  FileText,
  ShieldCheck,
  ArrowRightCircle,
  KeyRound,
  Check,
  Zap,
  FileSpreadsheet,
  Sliders,
  Package,
  MapPin,
} from 'lucide-react';
import { Appointment, AppointmentStatus, Dock, DiscrepancyReport, DestinationBranch, SystemUser } from '../types';
import { StatusBadge } from './StatusBadge';
import { DiscrepancyModal } from './DiscrepancyModal';
import { WalkInModal } from './WalkInModal';
import { DoubleCheckUnloadModal } from './DoubleCheckUnloadModal';
import { formatCurrencyBRL } from '../utils/formatters';

interface AdminDockDashboardProps {
  appointments: Appointment[];
  docks: Dock[];
  timeSlots?: string[];
  destinations?: DestinationBranch[];
  currentSystemUser?: SystemUser | null;
  isUserAdmin?: boolean;
  onUpdateStatus: (
    apptId: string,
    status: AppointmentStatus,
    dockId?: string,
    discrepancy?: DiscrepancyReport,
    additionalData?: Partial<Appointment>
  ) => void | Promise<void>;
  onOpenNewModal: () => void;
  onOpenReceipt?: (appt: Appointment) => void;
  onOpenTimeSlotConfig?: () => void;
}

// Helper to get today's local date in YYYY-MM-DD format
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AdminDockDashboard: React.FC<AdminDockDashboardProps> = ({
  appointments,
  docks,
  timeSlots,
  destinations = [],
  currentSystemUser,
  isUserAdmin,
  onUpdateStatus,
  onOpenNewModal,
  onOpenReceipt,
  onOpenTimeSlotConfig,
}) => {
  const effectiveIsAdmin = isUserAdmin !== undefined 
    ? isUserAdmin 
    : Boolean(currentSystemUser ? currentSystemUser.role === 'ADMIN' : true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getTodayDateString();
  });
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const activeDestinations = destinations.filter(d => d.active);

  const handleOpenDatePicker = () => {
    if (dateInputRef.current) {
      if ('showPicker' in dateInputRef.current) {
        try {
          dateInputRef.current.showPicker();
        } catch (_) {
          dateInputRef.current.focus();
        }
      } else {
        dateInputRef.current.focus();
      }
    }
  };
  const [selectedApptForDiscrepancy, setSelectedApptForDiscrepancy] = useState<Appointment | null>(null);
  const [selectedApptForDoubleCheck, setSelectedApptForDoubleCheck] = useState<Appointment | null>(null);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  // Helper to format Portuguese date
  const formatFullDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const formatted = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return dateStr;
    }
  };

  const shiftDate = (days: number) => {
    try {
      const cur = new Date(selectedDate + 'T00:00:00');
      cur.setDate(cur.getDate() + days);
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    } catch {
      // fallback
    }
  };

  const todayStr = getTodayDateString();

  // Robust volume extractor helper
  const getApptVolume = (a: any): number => {
    const raw = a.totalVolumes ?? a.volumes ?? a.pallets ?? a.totalPallets ?? a.quantidade ?? a.qtd ?? 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const normalizedSelectedDate = (selectedDate || '').split('T')[0].trim();

  // Appointments for chosen date (filtered by branch if selected)
  const dayAppointments = appointments.filter(a => {
    const apptDate = String(a.scheduledDate || '').split('T')[0].trim();
    if (apptDate !== normalizedSelectedDate) return false;
    if (selectedBranchFilter === 'ALL') return true;
    if (a.destinationBranchId) {
      return a.destinationBranchId === selectedBranchFilter;
    }
    const defBranch = activeDestinations.find(d => d.isDefault) || activeDestinations[0];
    return defBranch && defBranch.id === selectedBranchFilter;
  });

  // Branch-specific docks or fallback
  const selectedBranchObj = activeDestinations.find(d => d.id === selectedBranchFilter) || activeDestinations[0];
  const activeDocksToDisplay = (selectedBranchObj?.docks && selectedBranchObj.docks.length > 0)
    ? selectedBranchObj.docks
    : docks;

  // Helper to determine if an appointment belongs to a dock
  const isAppointmentAssignedToDock = (appt: Appointment, dock: Dock) => {
    // Se o agendamento não tem doca atribuída ou foi desatribuído (-- Atribuir Doca --), não pertence a nenhuma doca
    if (!appt.dockId || appt.dockId.trim() === '') {
      return false;
    }

    // 1. Direct ID match
    if (appt.dockId === dock.id) return true;

    // 2. Direct Name match
    if (dock.name && appt.dockId.toLowerCase() === dock.name.toLowerCase()) return true;

    // 3. Numeric ID / code match (e.g. DOCA-01 vs DOCA-1 vs Doca 1 vs 1)
    const dockNum = dock.id.replace(/\D/g, '');
    const apptDockNum = appt.dockId.replace(/\D/g, '');
    if (dockNum && apptDockNum && dockNum === apptDockNum) return true;

    return false;
  };

  // Quick stats
  const totalDay = dayAppointments.length;
  const noPatio = dayAppointments.filter(a => a.status === 'NO_PATIO').length;
  const aguardandoDescarga = dayAppointments.filter(a => a.status === 'AGUARDANDO_DESCARGA').length;
  const inProgress = dayAppointments.filter(a => a.status === 'EM_TRANSITO' || a.status === 'CONFIRMADO').length;
  const completedClean = dayAppointments.filter(a => a.status === 'ENTREGUE_SEM_DIVERGENCIA').length;
  const completedDivergent = dayAppointments.filter(a => a.status === 'ENTREGUE_COM_DIVERGENCIA').length;
  const noShowCount = dayAppointments.filter(a => a.status === 'NO_SHOW').length;

  return (
    <div className="space-y-6">
            {/* Header Bar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-3.5 sm:gap-4 w-full overflow-hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Gestão Operacional de Docas</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Controle de Docas & Janelas</h1>
        </div>

        {/* Date Selector & Slot Config (Right-Aligned) */}
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          
          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
            {onOpenTimeSlotConfig && effectiveIsAdmin && (
              <button
                onClick={onOpenTimeSlotConfig}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-700 shadow-xs transition-colors cursor-pointer"
                title="Cadastrar e gerenciar janelas de horário e capacidade de docas (Exclusivo Administrador)"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Janelas & Docas</span>
              </button>
            )}
          </div>

          {/* Interactive Calendar Control Bar */}
          <div className="w-full md:w-auto flex items-center justify-between gap-1 sm:gap-1.5 bg-slate-900 text-white p-1 sm:p-1.5 rounded-2xl border border-slate-800 shadow-md">
            
            {/* Previous Day */}
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-1 sm:p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0"
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Interactive HTML Date Input + Display */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1 sm:gap-2 bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={handleOpenDatePicker}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left min-w-0 flex-1"
                title="Clique para abrir o calendário"
              >
                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase leading-none truncate">Data da Operação</span>
                  <span className="text-[11px] sm:text-xs font-bold text-white capitalize truncate">
                    {formatFullDate(selectedDate)}
                  </span>
                </div>
              </button>

              {/* Native Date Picker with dark theme color scheme */}
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="bg-slate-900 text-amber-300 font-bold text-[10px] sm:text-xs px-1.5 py-0.5 sm:py-1 rounded-lg border border-slate-600 focus:ring-1 focus:ring-amber-400 focus:outline-none cursor-pointer [color-scheme:dark] shrink-0 w-[100px] sm:w-[125px]"
                title="Escolher data no calendário"
              />
            </div>

            {/* Next Day */}
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-1 sm:p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0"
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick Today button */}
            {selectedDate !== todayStr ? (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                Hoje
              </button>
            ) : (
              <span className="px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold rounded-xl shrink-0">
                Hoje
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Branch / Destination Filter (Exibido quando houver mais de uma filial ativa cadastrada) */}
      {activeDestinations.length > 1 && (
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Filtrar por Unidade / Filial:</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setSelectedBranchFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedBranchFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas as Unidades ({appointments.filter(a => a.scheduledDate === selectedDate).length})
            </button>
            {activeDestinations.map(branch => {
              const count = appointments.filter(a => {
                if (a.scheduledDate !== selectedDate) return false;
                if (a.destinationBranchId) return a.destinationBranchId === branch.id;
                const def = activeDestinations.find(d => d.isDefault) || activeDestinations[0];
                return def && def.id === branch.id;
              }).length;
              return (
                <button
                  key={branch.id}
                  onClick={() => setSelectedBranchFilter(branch.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                    selectedBranchFilter === branch.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{branch.name}</span>
                  {branch.code && <span className="text-[10px] opacity-80">({branch.code})</span>}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedBranchFilter === branch.id ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase block truncate">Programados</span>
          <span className="text-lg sm:text-2xl font-bold text-slate-900">{totalDay}</span>
        </div>

        <div className="bg-purple-50 border border-purple-200 p-2.5 sm:p-3.5 rounded-xl text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-purple-800 font-semibold uppercase block truncate">Na Portaria / Pátio</span>
          <span className="text-lg sm:text-2xl font-bold text-purple-950">{noPatio}</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3.5 rounded-xl text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-emerald-800 font-semibold uppercase block truncate">Lib. Descarga</span>
          <span className="text-lg sm:text-2xl font-bold text-emerald-950">{aguardandoDescarga}</span>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-2.5 sm:p-3.5 rounded-xl text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-blue-700 font-semibold uppercase block truncate">Em Trânsito</span>
          <span className="text-lg sm:text-2xl font-bold text-blue-900">{inProgress}</span>
        </div>

        <div className="bg-teal-50 border border-teal-200 p-2.5 sm:p-3.5 rounded-xl text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-teal-800 font-semibold uppercase block truncate">Concluído OK</span>
          <span className="text-lg sm:text-2xl font-bold text-teal-950">{completedClean}</span>
        </div>

        <div className="bg-orange-50 border border-orange-200 p-2.5 sm:p-3.5 rounded-xl text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] text-orange-800 font-semibold uppercase block truncate">Divergência</span>
          <span className="text-lg sm:text-2xl font-bold text-orange-950">{completedDivergent}</span>
        </div>
      </div>

      {/* Special Security Gate & Loss Prevention Quick Action Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-3.5 sm:p-5 shadow-md border border-purple-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white">
                Prevenção de Perdas & Controle de Portaria
              </h3>
              <p className="text-xs text-purple-200 line-clamp-1">
                Liberação direta de acesso dos veículos na portaria para as docas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-start lg:justify-end">
            <span className="bg-purple-800/80 text-purple-200 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-purple-600/50">
              {noPatio} veículo(s) no pátio
            </span>
            <button
              onClick={() => setIsWalkInModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-950" />
              <span>⚡ Registrar Encaixe</span>
            </button>
          </div>
        </div>

        {/* Gate Vehicles List */}
        {noPatio > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {dayAppointments
              .filter(a => a.status === 'NO_PATIO')
              .map(appt => (
                <div
                  key={appt.id}
                  className="bg-slate-800/90 border border-purple-500/40 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">{appt.protocol}</span>
                      {appt.purchaseOrder && (
                        <span className="text-[10px] sm:text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full">
                          PO: {appt.purchaseOrder}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full">
                        NF: {appt.invoiceNumber}
                      </span>
                      {appt.invoiceDueDate && (
                        <span className="text-[9px] sm:text-[10px] font-bold bg-amber-900/90 text-amber-200 border border-amber-600 px-2 py-0.5 rounded-full">
                          📅 Boleto: {new Date(appt.invoiceDueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-white truncate">{appt.supplierName}</p>
                    <p className="text-[11px] text-slate-300 font-mono truncate">
                      Placa: <strong className="text-white">{appt.vehiclePlate || 'N/I'}</strong> ({appt.vehicleType})
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedApptForDoubleCheck(appt)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                    title="Prevenção de Perdas: Realizar Double Check de chaves de acesso, valor e boleto antes de liberar"
                  >
                    <ArrowRightCircle className="w-4 h-4 shrink-0" />
                    <span>Liberar para Descarga</span>
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-purple-300/80 italic pt-1">
            Nenhum veículo aguardando liberação de acesso na portaria neste momento.
          </p>
        )}
      </div>

      {/* Docks Map Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> Visão Geral de Docas & Ocupação Diária
          </h2>
          {onOpenTimeSlotConfig && (
            <button
              type="button"
              onClick={onOpenTimeSlotConfig}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurar Limites & Janelas</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {activeDocksToDisplay.map(dock => {
            const dockAppts = dayAppointments.filter(a => isAppointmentAssignedToDock(a, dock));
            const activeAtDock = dockAppts.find(a => a.status === 'AGUARDANDO_DESCARGA' || a.status === 'NO_PATIO');

            // Calculate dock volume/pallet load for the day
            const dailyLimit = dock.dailyLimit || (dock.type === 'REFRIGERADA' ? 40 : dock.type === 'BATIDA' ? 200 : dock.type === 'FRACIONADA' ? 50 : 140);
            const limitUnit = dock.limitUnit || (dock.type === 'BATIDA' || dock.type === 'FRACIONADA' ? 'volumes' : 'pallets');
            
            const occupiedTotal = dockAppts
              .filter(a => a.status !== 'CANCELADO' && a.status !== 'NO_SHOW')
              .reduce((sum, a) => sum + getApptVolume(a), 0);

            const occupancyPercent = Math.min(100, Math.round((occupiedTotal / dailyLimit) * 100));
            const isFull = occupiedTotal >= dailyLimit;

            return (
              <div
                key={dock.id}
                className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                  activeAtDock ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                {/* Dock Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 notranslate" translate="no">
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-slate-900 text-sm truncate notranslate" translate="no">{dock.name}</h3>
                    <span className="text-[10px] text-slate-500 font-medium">TIPO: {dock.type}</span>
                  </div>
                  {activeAtDock ? (
                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-pulse shrink-0">
                      Em Operação
                    </span>
                  ) : !dock.isOperational ? (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full shrink-0">
                      Manutenção
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                      Disponível
                    </span>
                  )}
                </div>

                {/* Daily Limit & Occupancy Progress Bar */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-400" />
                      Ocupação Diária:
                    </span>
                    <span className={`font-mono font-bold text-[11px] ${
                      isFull ? 'text-rose-700' : occupancyPercent > 80 ? 'text-amber-700' : 'text-slate-800'
                    }`}>
                      {occupiedTotal} / {dailyLimit} {limitUnit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isFull
                          ? 'bg-rose-500'
                          : occupancyPercent > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${occupancyPercent}%` }}
                    />
                  </div>
                </div>

                {/* Dock Queue / Schedule List */}
                <div className="space-y-2.5 min-h-[100px]">
                  {dockAppts.length > 0 ? (
                    dockAppts.map(appt => {
                      const apptVol = getApptVolume(appt);
                      return (
                        <div
                          key={appt.id}
                          className="bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-xl p-3 space-y-2 text-xs transition-colors shadow-2xs"
                        >
                          {/* Protocol and Slot Header */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono font-bold text-blue-700 text-xs truncate">{appt.protocol}</span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                              {appt.timeSlot}
                            </span>
                          </div>

                          {/* Supplier & Invoice */}
                          <div className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2" title={`NF ${appt.invoiceNumber} • ${appt.supplierName}`}>
                            NF {appt.invoiceNumber} • {appt.supplierName}
                          </div>

                          {/* Vehicle & Pallet/Volume Load */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600 font-mono min-w-0">
                              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate" title={appt.vehiclePlate || appt.vehicleType || 'Veículo N/I'}>
                                {appt.vehiclePlate || appt.vehicleType || 'Veículo N/I'}
                              </span>
                            </div>
                            <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-mono shrink-0">
                              {apptVol} {limitUnit}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className="pt-0.5">
                            <StatusBadge
                              status={appt.status}
                              size="sm"
                              isWalkIn={appt.isWalkIn}
                              isPreApprovedContract={appt.isPreApprovedContract}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-24 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 italic text-center p-3">
                      Sem veículos alocados nesta doca para a data
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational List Table & Live Action Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            Fila de Recebimento do Dia ({dayAppointments.length} Agendamentos)
          </h3>
          <button
            onClick={onOpenNewModal}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Carga
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] tracking-wider uppercase">
                <th className="py-3 px-4">Protocolo / NF</th>
                <th className="py-3 px-4">Horário / Doca Atribuída</th>
                <th className="py-3 px-4">Fornecedor & Transportadora</th>
                <th className="py-3 px-4">Status Atual</th>
                <th className="py-3 px-4 text-right">Ações de Liberação & Recebimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dayAppointments.length > 0 ? (
                dayAppointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Protocol, PO & NF */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-blue-700 text-sm">{appt.protocol}</div>
                      {appt.purchaseOrder && (
                        <div className="text-slate-800 font-bold text-xs flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>PO: {appt.purchaseOrder}</span>
                          {((appt.purchaseOrders && appt.purchaseOrders.length > 1) || (appt.purchaseOrder && appt.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length > 1)) && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-1.5 py-0.5 rounded-md">
                              {appt.purchaseOrders?.length || appt.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length} pedidos
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-slate-600 font-medium text-xs flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>NFs: {appt.invoiceNumber}</span>
                        {appt.invoiceNumbers && appt.invoiceNumbers.length > 1 && (
                          <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-300 font-bold px-1.5 py-0.5 rounded-md">
                            {appt.invoiceNumbers.length} notas
                          </span>
                        )}
                        {appt.nfeAccessKeys && appt.nfeAccessKeys.length > 0 && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <KeyRound className="w-2.5 h-2.5 text-indigo-600" />
                            {appt.nfeAccessKeys.length} chaves NF-e
                          </span>
                        )}
                      </div>
                      {appt.invoiceTotalValue !== undefined && appt.invoiceTotalValue !== null && (
                        <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                          Valor Total: <span className="font-mono">{formatCurrencyBRL(appt.invoiceTotalValue)}</span>
                        </div>
                      )}
                      {appt.invoiceDueDate && (
                        <div className="text-[11px] font-semibold text-amber-700 mt-0.5 flex items-center gap-1">
                          📅 Boleto: {new Date(appt.invoiceDueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500">{appt.cargoType} • {appt.totalVolumes} vol</div>
                    </td>

                    {/* Slot & Dock */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{appt.timeSlot}</div>
                      <select
                        value={appt.dockId || ''}
                        onChange={e => onUpdateStatus(appt.id, appt.status, e.target.value)}
                        className="mt-1 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                      >
                        <option value="">-- Atribuir Doca --</option>
                        {(activeDocksToDisplay.length > 0 ? activeDocksToDisplay : docks).map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Fornecedor & Motorista */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[200px]">{appt.supplierName}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{appt.carrierName || 'Transportadora Própria'}</div>
                      <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                        <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{appt.vehiclePlate || 'Sem placa'}</span>
                      </div>
                      {appt.driverName && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px] mt-0.5">
                          Motorista: <span className="font-medium text-slate-700">{appt.driverName}</span>
                          {appt.driverCpf && <span className="font-mono text-[10px] text-slate-400 block">CPF: {appt.driverCpf}</span>}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge
                        status={appt.status}
                        size="sm"
                        isWalkIn={appt.isWalkIn}
                        isPreApprovedContract={appt.isPreApprovedContract}
                      />
                    </td>

                    {/* Quick Operational Buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Action 1: Approve pending request */}
                        {appt.status === 'PENDENTE' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onUpdateStatus(appt.id, 'CONFIRMADO', appt.dockId)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-1 transition-all"
                              title="Aprovar e Confirmar Agendamento"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                            </button>
                            <button
                              onClick={() => onUpdateStatus(appt.id, 'REJEITADO')}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs px-2 py-1.5 rounded-lg transition-colors"
                              title="Rejeitar Agendamento"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}

                        {/* Action 2: Check-in at Gate (Prevenção de Perdas) */}
                        {(appt.status === 'CONFIRMADO' || appt.status === 'EM_TRANSITO') && (
                          <button
                            onClick={() => onUpdateStatus(appt.id, 'NO_PATIO', appt.dockId)}
                            className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1"
                            title="Prevenção de Perdas: Registrar chegada do veículo na portaria"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Chegada na Portaria
                          </button>
                        )}

                        {/* Action 3: Prevenção de Perdas Releases Vehicle in Real-Time */}
                        {appt.status === 'NO_PATIO' && (
                          <button
                            onClick={() => setSelectedApptForDoubleCheck(appt)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-1.5 animate-pulse cursor-pointer"
                            title="Prevenção de Perdas: Realizar Double Check de chaves de acesso, valor e boleto antes de liberar para a doca"
                          >
                            <ArrowRightCircle className="w-4 h-4" /> Liberar para Descarga
                          </button>
                        )}

                        {/* Action 4: Dock Receiver Completes Inspection */}
                        {appt.status === 'AGUARDANDO_DESCARGA' && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(appt.id, 'ENTREGUE_SEM_DIVERGENCIA')}
                              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1"
                              title="Concluir descarga sem divergências"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Concluir Ok
                            </button>

                            <button
                              onClick={() => setSelectedApptForDiscrepancy(appt)}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1"
                              title="Registrar Avaria / Divergência"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> Com Divergência
                            </button>
                          </>
                        )}

                        {/* Action: Generate Comprovante/Voucher for confirmed/active appointment */}
                        {(appt.status === 'CONFIRMADO' ||
                          appt.status === 'EM_TRANSITO' ||
                          appt.status === 'NO_PATIO' ||
                          appt.status === 'AGUARDANDO_DESCARGA' ||
                          appt.status === 'ENTREGUE_SEM_DIVERGENCIA' ||
                          appt.status === 'ENTREGUE_COM_DIVERGENCIA') && onOpenReceipt && (
                          <button
                            onClick={() => onOpenReceipt(appt)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300/80 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Gerar e imprimir comprovante oficial de agendamento"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Comprovante</span>
                          </button>
                        )}

                        {/* Action 5: Flag No-Show */}
                        {(appt.status === 'PENDENTE' || appt.status === 'CONFIRMADO') && (
                          <button
                            onClick={() => onUpdateStatus(appt.id, 'NO_SHOW')}
                            className="bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 font-medium text-xs px-2 py-1.5 rounded-lg"
                            title="Marcar Não-Comparecimento (No Show)"
                          >
                            No Show
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                    Nenhum agendamento programado para esta data ({selectedDate}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Walk-In Gate Registration Modal */}
      <WalkInModal
        isOpen={isWalkInModalOpen}
        destinations={destinations}
        onClose={() => setIsWalkInModalOpen(false)}
        onSuccess={newAppt => {
          setIsWalkInModalOpen(false);
          onUpdateStatus(newAppt.id, 'NO_PATIO');
        }}
      />

      {/* Double Check de Prevenção & Liberação para Descarga */}
      {selectedApptForDoubleCheck && (
        <DoubleCheckUnloadModal
          isOpen={!!selectedApptForDoubleCheck}
          appointment={selectedApptForDoubleCheck}
          docks={docks}
          currentSystemUser={currentSystemUser}
          onClose={() => setSelectedApptForDoubleCheck(null)}
          onConfirmRelease={async (apptId, data) => {
            await onUpdateStatus(
              apptId,
              'AGUARDANDO_DESCARGA',
              data.dockId,
              undefined,
              {
                nfeAccessKeys: data.nfeAccessKeys,
                invoiceNumbers: data.invoiceNumbers,
                invoiceTotalValue: data.invoiceTotalValue,
                invoiceDueDate: data.invoiceDueDate,
                notes: data.notes,
                preventionDoubleChecked: true,
                preventionCheckedBy: data.preventionCheckedBy,
                preventionCheckedAt: new Date().toISOString()
              }
            );
            setSelectedApptForDoubleCheck(null);
          }}
        />
      )}

      {/* Discrepancy Modal */}
      {selectedApptForDiscrepancy && (
        <DiscrepancyModal
          isOpen={!!selectedApptForDiscrepancy}
          appointmentProtocol={selectedApptForDiscrepancy.protocol}
          onClose={() => setSelectedApptForDiscrepancy(null)}
          onSubmit={discrepancyReport => {
            onUpdateStatus(
              selectedApptForDiscrepancy.id,
              'ENTREGUE_COM_DIVERGENCIA',
              selectedApptForDiscrepancy.dockId,
              discrepancyReport
            );
            setSelectedApptForDiscrepancy(null);
          }}
        />
      )}

    </div>
  );
};

