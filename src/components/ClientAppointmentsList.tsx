import React, { useState } from 'react';
import { Calendar, Search, Filter, Plus, RefreshCw, Eye, Copy, AlertTriangle, FileText, CheckCircle, CheckCircle2, XCircle, Clock, Building2, Truck, Lock, UserCheck, LogOut, ShieldCheck, LogIn, ShieldAlert, FileSpreadsheet, MapPin, KeyRound, DollarSign } from 'lucide-react';
import { Appointment, AppointmentStatus, SystemUser } from '../types';
import { StatusBadge } from './StatusBadge';
import { SupplierSession } from './SupplierLoginModal';
import { UserRole } from './Header';
import { formatCurrencyBRL } from '../utils/formatters';

interface ClientAppointmentsListProps {
  appointments: Appointment[];
  onOpenNewModal: () => void;
  onOpenReschedule: (appt: Appointment) => void;
  onSelectForTracking: (appt: Appointment) => void;
  onOpenReceipt?: (appt: Appointment) => void;
  onUpdateStatus?: (id: string, newStatus: AppointmentStatus, dockId?: string) => void;
  currentSupplierSession?: SupplierSession | null;
  userRole?: UserRole;
  currentSystemUser?: SystemUser | null;
  onOpenSupplierLogin?: () => void;
  onLogoutSupplier?: () => void;
  onNavigateToAdmin?: () => void;
  onLogoutAdmin?: () => void;
  onOpenUsersModal?: () => void;
}

export const ClientAppointmentsList: React.FC<ClientAppointmentsListProps> = ({
  appointments,
  onOpenNewModal,
  onOpenReschedule,
  onSelectForTracking,
  onOpenReceipt,
  onUpdateStatus,
  currentSupplierSession,
  userRole = 'CLIENT',
  currentSystemUser,
  onOpenSupplierLogin,
  onLogoutSupplier,
  onNavigateToAdmin,
  onLogoutAdmin,
  onOpenUsersModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const isOperator = userRole === 'ADMIN' || !!currentSystemUser;
  const isSupplierLoggedIn = !!currentSupplierSession;
  const canApproveReject = currentSystemUser
    ? currentSystemUser.role === 'ADMIN' || currentSystemUser.role === 'SUPERVISOR'
    : userRole === 'ADMIN';

  // Visible appointments:
  // 1. If supplier logged in, isolate strictly to their CNPJ/Name
  // 2. If Admin / Operator, show all appointments
  // 3. If logged out / unauthenticated, do NOT expose other companies' appointments
  const visibleAppointments = isSupplierLoggedIn
    ? appointments.filter(a => {
        const cleanCnpjA = a.supplierCnpj ? a.supplierCnpj.replace(/\D/g, '') : '';
        const cleanCnpjB = currentSupplierSession.cnpj.replace(/\D/g, '');
        if (cleanCnpjA && cleanCnpjB && cleanCnpjA === cleanCnpjB) return true;
        return a.supplierName.toLowerCase().includes(currentSupplierSession.name.toLowerCase());
      })
    : isOperator
    ? appointments
    : [];

  // Stats Counters based on visible appointments
  const total = visibleAppointments.length;
  const pending = visibleAppointments.filter(a => a.status === 'PENDENTE').length;
  const confirmed = visibleAppointments.filter(a => a.status === 'CONFIRMADO' || a.status === 'EM_TRANSITO' || a.status === 'NO_PATIO').length;
  const withDivergence = visibleAppointments.filter(a => a.status === 'ENTREGUE_COM_DIVERGENCIA').length;

  const filteredAppointments = visibleAppointments.filter(appt => {
    const matchesSearch =
      appt.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.carrierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appt.vehiclePlate && appt.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (appt.supplierCnpj && appt.supplierCnpj.includes(searchTerm));

    const matchesStatus = statusFilter === 'ALL' || appt.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Dynamic Access & Authentication Header Banner */}
      {isSupplierLoggedIn ? (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-4 shadow-md border border-blue-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{currentSupplierSession.name}</span>
                <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded-full">
                  CNPJ: {currentSupplierSession.cnpj}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                Filtro de Fornecedor Ativo: Exibindo apenas agendamentos desta empresa ({total} agendamento(s))
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Solicitar Agendamento
            </button>
            <button
              onClick={onLogoutSupplier}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              Sair do Fornecedor
            </button>
          </div>
        </div>
      ) : isOperator ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-indigo-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${currentSystemUser?.role === 'ADMIN' ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300' : 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'} flex items-center justify-center shrink-0`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {currentSystemUser ? `${currentSystemUser.name} (${currentSystemUser.department})` : 'Acesso Operacional'}
                </span>
                <span className={`text-[10px] font-bold ${currentSystemUser?.role === 'ADMIN' ? 'bg-purple-950 text-purple-300 border-purple-700/80' : 'bg-cyan-950 text-cyan-300 border-cyan-700/80'} border px-2 py-0.5 rounded-full`}>
                  {currentSystemUser?.role === 'ADMIN' ? 'Administrador Geral' : 'Operador'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentSystemUser?.role === 'ADMIN' 
                  ? `Visualizando e administrando todos os agendamentos registrados no sistema (${total} agendamentos).` 
                  : `Operando agendamentos, recepção e acompanhamento de cargas (${total} agendamentos).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
            </button>
            {onLogoutAdmin && (
              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-1.5 bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 text-xs font-semibold px-3 py-2 rounded-xl border border-rose-800/80 transition-colors cursor-pointer"
                title="Encerrar sessão e voltar ao modo público"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                Sair ({currentSystemUser?.role === 'ADMIN' ? 'Admin' : 'Operador'})
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl shrink-0 mt-0.5">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Painel de Solicitações e Agendamentos de Carga</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Consulte o status das entregas agendadas ou solicite uma nova data/janela de recebimento.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-start md:justify-end">
            {onOpenSupplierLogin && (
              <button
                onClick={onOpenSupplierLogin}
                className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                title="Filtrar exclusivamente os agendamentos da sua empresa pelo CNPJ"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                Filtrar por CNPJ
              </button>
            )}
            <button
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Solicitar Agendamento
            </button>
          </div>
        </div>
      )}

      {/* Quick KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Agendamentos</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Aguardando Aprovação</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{pending}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Confirmados / Pátio</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{confirmed}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Com Divergência</span>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{withDivergence}</p>
          </div>
        </div>

      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Controls Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por NF, Protocolo, Fornecedor, Placa..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos ({visibleAppointments.length})
            </button>

            <button
              onClick={() => setStatusFilter('PENDENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'PENDENTE'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Pendentes ({visibleAppointments.filter(a => a.status === 'PENDENTE').length})
            </button>

            <button
              onClick={() => setStatusFilter('CONFIRMADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'CONFIRMADO'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Confirmados
            </button>

            <button
              onClick={() => setStatusFilter('EM_TRANSITO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'EM_TRANSITO'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Em Trânsito
            </button>

            <button
              onClick={() => setStatusFilter('NO_PATIO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'NO_PATIO'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Na Portaria / Pátio
            </button>

            <button
              onClick={() => setStatusFilter('AGUARDANDO_DESCARGA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'AGUARDANDO_DESCARGA'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Liberados p/ Descarga
            </button>

            <button
              onClick={() => setStatusFilter('ENTREGUE_COM_DIVERGENCIA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'ENTREGUE_COM_DIVERGENCIA'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Com Divergência
            </button>

            <button
              onClick={() => setStatusFilter('NO_SHOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'NO_SHOW'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              No Show
            </button>
          </div>

        </div>

        {/* List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
                <th className="py-3 px-4">Protocolo / NF</th>
                <th className="py-3 px-4">Fornecedor / Transportadora</th>
                <th className="py-3 px-4">Data & Horário</th>
                <th className="py-3 px-4">Volume / Veículo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAppointments.length > 0 ? (
                filteredAppointments.map((appt, aIdx) => (
                  <tr key={`client-appt-${appt.id}-${aIdx}`} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Protocol & NF & PO */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-blue-600 text-sm">{appt.protocol}</div>
                      {appt.purchaseOrder && (
                        <div className="text-slate-800 font-semibold text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>PO: {appt.purchaseOrder}</span>
                          {(appt.purchaseOrders && appt.purchaseOrders.length > 1) || (appt.purchaseOrder && appt.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length > 1) ? (
                            <span className="text-[9px] bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-1.5 py-0.2 rounded-md">
                              {appt.purchaseOrders?.length || appt.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length} pedidos
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className="text-slate-500 font-medium text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>NF {appt.invoiceNumber}</span>
                        {appt.nfeAccessKeys && appt.nfeAccessKeys.length > 0 && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <KeyRound className="w-2.5 h-2.5 text-indigo-600" />
                            {appt.nfeAccessKeys.length} chaves
                          </span>
                        )}
                      </div>
                      {appt.invoiceTotalValue !== undefined && appt.invoiceTotalValue !== null && (
                        <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                          Total: <span className="font-mono">{formatCurrencyBRL(appt.invoiceTotalValue)}</span>
                        </div>
                      )}
                    </td>

                    {/* Fornecedor & Motorista */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[220px] xl:max-w-[340px]">{appt.supplierName}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[220px] xl:max-w-[340px]">{appt.carrierName || 'Transportadora Própria'}</div>
                      {appt.driverName && (
                        <div className="text-[11px] text-slate-600 truncate max-w-[220px] xl:max-w-[340px] mt-0.5">
                          Motorista: <span className="font-medium">{appt.driverName}</span>
                          {appt.driverCpf && <span className="font-mono text-[10px] text-slate-400 block">CPF: {appt.driverCpf}</span>}
                        </div>
                      )}
                      {appt.supplierCnpj && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">CNPJ: {appt.supplierCnpj}</div>
                      )}
                      {appt.destinationBranchName && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md mt-1 truncate max-w-[200px]">
                          <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{appt.destinationBranchName}</span>
                        </div>
                      )}
                    </td>

                    {/* Data & Horário */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {new Date(appt.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-slate-500">{appt.timeSlot}</div>
                    </td>

                    {/* Cargo info */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{appt.totalVolumes} vol ({appt.weightKg} kg)</div>
                      <div className="text-xs text-slate-500 font-mono">{appt.vehiclePlate || appt.vehicleType}</div>
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

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        
                        {/* Pending Quick Approval Actions (Exclusively for Logged-In Supervisors/Admins) */}
                        {appt.status === 'PENDENTE' && onUpdateStatus && (
                          canApproveReject ? (
                            <div className="flex items-center gap-1.5 mr-1">
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'CONFIRMADO', appt.dockId)}
                                className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="Aprovar e confirmar este agendamento (Apenas Supervisores ou Administradores)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirmar</span>
                              </button>
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'CANCELADO')}
                                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 font-semibold px-2 py-1 rounded-lg transition-all cursor-pointer"
                                title="Rejeitar solicitação de agendamento (Apenas Supervisores ou Administradores)"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rejeitar</span>
                              </button>
                            </div>
                          ) : isOperator ? (
                            <span
                              className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-md font-medium inline-flex items-center gap-1 mr-1"
                              title="Apenas Supervisores de Logística ou Administradores Gerais possuem permissão para aprovar ou rejeitar solicitações."
                            >
                              <Lock className="w-3 h-3 text-amber-600" />
                              Aguardando Supervisor/Admin
                            </span>
                          ) : null
                        )}

                        {/* Signal In Transit button */}
                        {appt.status === 'CONFIRMADO' && onUpdateStatus && (
                          <button
                            onClick={() => onUpdateStatus(appt.id, 'EM_TRANSITO')}
                            className="inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
                            title="Sinalizar que o veículo saiu com a carga e está em deslocamento para a fábrica/CD"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Em Trânsito</span>
                          </button>
                        )}

                        {/* Gerar Comprovante button for confirmed appointments */}
                        {(appt.status === 'CONFIRMADO' ||
                          appt.status === 'EM_TRANSITO' ||
                          appt.status === 'NO_PATIO' ||
                          appt.status === 'AGUARDANDO_DESCARGA' ||
                          appt.status === 'ENTREGUE_SEM_DIVERGENCIA' ||
                          appt.status === 'ENTREGUE_COM_DIVERGENCIA') && onOpenReceipt && (
                          <button
                            onClick={() => onOpenReceipt(appt)}
                            className="inline-flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300/90 px-2.5 py-1 rounded-lg font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Gerar e imprimir comprovante oficial de agendamento"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Comprovante</span>
                          </button>
                        )}

                        {/* Track button */}
                        <button
                          onClick={() => onSelectForTracking(appt)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Ver Detalhes do Rastreamento"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Reschedule button */}
                        {(appt.status === 'PENDENTE' ||
                          appt.status === 'CONFIRMADO' ||
                          appt.status === 'NO_SHOW') && (isOperator || isSupplierLoggedIn) && (
                          <button
                            onClick={() => onOpenReschedule(appt)}
                            className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg font-semibold transition-all shadow-2xs cursor-pointer"
                            title="Solicitar nova data ou janela de horário para este agendamento"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reagendar</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                    {!isOperator && !isSupplierLoggedIn ? (
                      <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto py-6 px-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-200 shadow-2xs">
                          <Lock className="w-7 h-7 text-slate-600" />
                        </div>
                        <div className="space-y-1.5 text-center">
                          <h4 className="font-bold text-slate-800 text-base">Acesso aos Agendamentos Restrito</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Por motivos de segurança e confidencialidade logística, a listagem de agendamentos só é visível após a identificação do fornecedor por CNPJ ou login de operador de docas.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          {onOpenSupplierLogin && (
                            <button
                              onClick={onOpenSupplierLogin}
                              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              Entrar com CNPJ
                            </button>
                          )}
                          {onNavigateToAdmin && (
                            <button
                              onClick={onNavigateToAdmin}
                              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              Acesso Operação
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-700">Nenhum agendamento encontrado</p>
                          <p className="text-xs text-slate-400">
                            {searchTerm || statusFilter !== 'ALL'
                              ? 'Nenhum resultado corresponde aos filtros selecionados.'
                              : isSupplierLoggedIn
                              ? `Ainda não constam agendamentos registrados para ${currentSupplierSession?.name}.`
                              : 'Ainda não há agendamentos cadastrados na base de dados.'}
                          </p>
                        </div>
                        <button
                          onClick={onOpenNewModal}
                          className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Cadastrar Agendamento
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};

