import React, { useState } from 'react';
import { Search, Package, Clock, CheckCircle2, AlertTriangle, Truck, RefreshCw, Copy, Calendar, Building2, User, FileText, ChevronRight, Lock, LogIn, Eye, ShieldCheck, MapPin } from 'lucide-react';
import { Appointment, AppointmentStatus, SystemUser } from '../types';
import { StatusBadge } from './StatusBadge';
import { SupplierSession } from './SupplierLoginModal';
import { UserRole } from './Header';
import { formatCurrencyBRL, formatNfeAccessKey } from '../utils/formatters';

interface TrackingViewProps {
  appointments: Appointment[];
  onOpenReschedule: (appt: Appointment) => void;
  onOpenNewModal: () => void;
  onOpenReceipt?: (appt: Appointment) => void;
  onUpdateStatus?: (id: string, newStatus: AppointmentStatus, dockId?: string) => void;
  currentSupplierSession?: SupplierSession | null;
  userRole?: UserRole;
  currentSystemUser?: SystemUser | null;
  onOpenSupplierLogin?: () => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({
  appointments,
  onOpenReschedule,
  onOpenNewModal,
  onOpenReceipt,
  onUpdateStatus,
  currentSupplierSession,
  userRole,
  currentSystemUser,
  onOpenSupplierLogin,
}) => {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Operational / Admin users have full system access to view all appointments and suppliers
  const isOperatorOrAdmin = userRole === 'ADMIN' || !!currentSystemUser;
  const isSupplierLoggedIn = !isOperatorOrAdmin && !!currentSupplierSession;
  const canApproveReject = currentSystemUser
    ? currentSystemUser.role === 'ADMIN' || currentSystemUser.role === 'SUPERVISOR'
    : userRole === 'ADMIN';

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  // Visible appointments:
  // - Operational / Admin: Shows ALL appointments (can see all suppliers)
  // - Supplier Logged in: Filtered to their own CNPJ / Name
  // - Logged Out / Public: Strictly isolated - only displays explicitly searched appointment (protecting corporate confidentiality)
  const visibleAppointments = isSupplierLoggedIn
    ? appointments.filter(a => {
        const cleanCnpjA = a.supplierCnpj ? a.supplierCnpj.replace(/\D/g, '') : '';
        const cleanCnpjB = currentSupplierSession.cnpj.replace(/\D/g, '');
        if (cleanCnpjA && cleanCnpjB && cleanCnpjA === cleanCnpjB) return true;
        return a.supplierName.toLowerCase().includes(currentSupplierSession.name.toLowerCase());
      })
    : isOperatorOrAdmin
    ? appointments
    : (selectedApptId ? appointments.filter(a => a.id === selectedApptId) : []);

  const selectedAppt = appointments.find(a => a.id === selectedApptId) || (isOperatorOrAdmin || isSupplierLoggedIn ? visibleAppointments[0] : null) || null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const q = query.toLowerCase().trim();
    // Search pool: operators and general view search the full database; suppliers search within their scope
    const pool = isSupplierLoggedIn ? visibleAppointments : appointments;
    const found = pool.find(
      a =>
        a.protocol.toLowerCase().includes(q) ||
        (a.purchaseOrder && a.purchaseOrder.toLowerCase().includes(q)) ||
        (a.invoiceNumber && a.invoiceNumber.toLowerCase().includes(q)) ||
        (a.supplierCnpj && a.supplierCnpj.replace(/\D/g, '').includes(q.replace(/\D/g, ''))) ||
        (a.vehiclePlate && a.vehiclePlate.toLowerCase().includes(q)) ||
        a.supplierName.toLowerCase().includes(q) ||
        (a.carrierName && a.carrierName.toLowerCase().includes(q))
    );

    if (found) {
      setSelectedApptId(found.id);
    } else {
      setSelectedApptId(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to format ISO timestamp cleanly
  const formatStepTime = (isoString?: string) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Timeline step generator with real timestamps for each stage
  const getTimelineSteps = (appt: Appointment) => {
    const isNoShow = appt.status === 'NO_SHOW';
    const isCanceled = appt.status === 'CANCELADO';
    const isDelivered = appt.status === 'ENTREGUE_SEM_DIVERGENCIA' || appt.status === 'ENTREGUE_COM_DIVERGENCIA';
    const isAwaitingUnload = appt.status === 'AGUARDANDO_DESCARGA' || isDelivered;
    const isAtGate = appt.status === 'NO_PATIO' || isAwaitingUnload;
    const isConfirmed = appt.status === 'CONFIRMADO' || appt.status === 'EM_TRANSITO' || isAtGate;

    const timestamps = appt.statusTimestamps || {};

    const regTime = formatStepTime(timestamps.PENDENTE || appt.createdAt);
    const confTime = formatStepTime(timestamps.CONFIRMADO);
    const transitTime = formatStepTime(timestamps.EM_TRANSITO);
    const gateTime = formatStepTime(timestamps.NO_PATIO);
    const releaseTime = formatStepTime(timestamps.AGUARDANDO_DESCARGA);
    const finalTime = formatStepTime(
      timestamps.ENTREGUE_SEM_DIVERGENCIA ||
      timestamps.ENTREGUE_COM_DIVERGENCIA ||
      timestamps.NO_SHOW ||
      timestamps.CANCELADO
    );

    return [
      {
        id: 'STEP_1',
        title: '1. Solicitação Registrada',
        desc: regTime ? `Registrado em ${regTime}` : 'Aguardando envio',
        timestamp: regTime,
        done: true,
        current: appt.status === 'PENDENTE',
      },
      {
        id: 'STEP_2',
        title: '2. Confirmação do Agendamento',
        desc: isConfirmed
          ? (confTime ? `Confirmado em ${confTime}` : 'Confirmado pela operação') + (appt.dockId ? ` (${appt.dockId})` : '')
          : 'Aguardando validação da equipe de logística',
        timestamp: confTime,
        done: isConfirmed,
        current: appt.status === 'CONFIRMADO',
      },
      {
        id: 'STEP_3',
        title: '3. Em Trânsito / Deslocamento',
        desc: appt.status === 'EM_TRANSITO' || isAtGate
          ? transitTime ? `Sinalizado em ${transitTime}` : 'Carga em deslocamento rodoviário'
          : 'Aguardando saída do veículo',
        timestamp: transitTime,
        done: appt.status === 'EM_TRANSITO' || isAtGate,
        current: appt.status === 'EM_TRANSITO',
      },
      {
        id: 'STEP_4',
        title: '4. Chegada na Portaria (Pátio)',
        desc: isAtGate
          ? (gateTime ? `Entrada no pátio registrada em ${gateTime}` : 'Chegada na portaria registrada')
          : 'Aguardando apresentação na guarita do CD/Fábrica',
        timestamp: gateTime,
        done: isAtGate,
        current: appt.status === 'NO_PATIO',
      },
      {
        id: 'STEP_5',
        title: '5. Autorização & Liberação para Doca',
        desc: isAwaitingUnload
          ? (releaseTime ? `Liberado para encostar na doca em ${releaseTime}` : 'Acesso liberado pela Prevenção de Perdas')
          : 'Aguardando conferência documental na portaria',
        timestamp: releaseTime,
        done: isAwaitingUnload,
        current: appt.status === 'AGUARDANDO_DESCARGA',
      },
      {
        id: 'STEP_6',
        title: isNoShow
          ? '6. Falta de Comparecimento (No Show)'
          : isCanceled
          ? '6. Agendamento Cancelado'
          : appt.status === 'ENTREGUE_COM_DIVERGENCIA'
          ? '6. Recebido com Divergência'
          : '6. Recebido sem Divergência',
        desc: isDelivered
          ? (finalTime ? `Descarga concluída em ${finalTime}` : 'Descarga e conferência finalizadas')
          : isNoShow
          ? (finalTime ? `Registrado No Show em ${finalTime}` : 'Veículo não compareceu na janela acordada')
          : isCanceled
          ? (finalTime ? `Cancelado em ${finalTime}` : 'Agendamento cancelado')
          : 'Aguardando término de descarregamento e conferência física',
        timestamp: finalTime,
        done: isDelivered || isNoShow || isCanceled,
        current: isDelivered || isNoShow || isCanceled,
        isWarning: appt.status === 'ENTREGUE_COM_DIVERGENCIA' || isNoShow,
      },
    ];
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 w-full">
        <div className="w-full">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Search className="w-3.5 h-3.5" /> Portal de Consulta Aberta
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Rastreamento de Agendamentos & Status de Carga
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-2">
            Digite o código de protocolo (ex: <span className="font-mono text-amber-300 font-semibold">AGD-2026-1042</span>) ou o número da Nota Fiscal para verificar a situação do descarregamento.
          </p>

          <form onSubmit={handleSearch} className="mt-5 flex items-center gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: AGD-2026-1042 ou NF 849201"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-2xl text-sm transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer"
            >
              Consultar
            </button>
          </form>
        </div>
      </div>

      {/* Main Grid: Quick Selector List + Detailed Tracking Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Recent / Filtered List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 flex items-center justify-between">
            <span>
              {isOperatorOrAdmin
                ? 'Todos os Agendamentos (Visão Operacional)'
                : isSupplierLoggedIn
                ? `Agendamentos (${currentSupplierSession?.name})`
                : 'Agendamentos Cadastrados'}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {visibleAppointments.length} {visibleAppointments.length === 1 ? 'item' : 'itens'}
            </span>
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {visibleAppointments.length > 0 ? (
              visibleAppointments.map((appt, aIdx) => {
                const isSelected = selectedAppt?.id === appt.id;
                return (
                  <div
                    key={`track-appt-${appt.id}-${aIdx}`}
                    onClick={() => setSelectedApptId(appt.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 shadow-sm ring-1 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-blue-700">{appt.protocol}</span>
                      <StatusBadge status={appt.status} size="sm" />
                    </div>

                    <div className="mt-2 text-xs text-slate-800 font-semibold truncate">
                      {appt.purchaseOrder ? (
                        <span className="font-mono text-blue-700 mr-1">PO {appt.purchaseOrder} •</span>
                      ) : null}
                      {appt.invoiceNumber ? `NF ${appt.invoiceNumber}` : 'NF Pendente'} - {appt.supplierName}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(appt.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {appt.timeSlot}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-3 text-center space-y-2.5 bg-slate-50 rounded-xl border border-slate-200">
                {isOperatorOrAdmin ? (
                  <>
                    <Package className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-700 font-bold">Nenhum agendamento cadastrado</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Não há agendamentos registrados no momento. Novos agendamentos criados por fornecedores ou equipe operacional aparecerão aqui.
                    </p>
                    {onOpenNewModal && (
                      <button
                        onClick={onOpenNewModal}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer mt-1"
                      >
                        + Novo Agendamento
                      </button>
                    )}
                  </>
                ) : isSupplierLoggedIn ? (
                  <>
                    <Package className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-700 font-bold">Nenhum agendamento encontrado</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Não há entregas agendadas para o CNPJ {currentSupplierSession?.cnpj} ({currentSupplierSession?.name}).
                    </p>
                    {onOpenNewModal && (
                      <button
                        onClick={onOpenNewModal}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer mt-1"
                      >
                        Solicitar Agendamento
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-700 font-bold">Nenhum agendamento disponível</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Consulte um protocolo pelo campo de busca acima ou identifique-se com o CNPJ da sua empresa.
                    </p>
                    {onOpenSupplierLogin && (
                      <button
                        onClick={onOpenSupplierLogin}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline cursor-pointer pt-1"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Entrar com CNPJ
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed View & Progress Timeline */}
        <div className="lg:col-span-2">
          {selectedAppt ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              
              {/* Top Details Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold font-mono text-slate-900">{selectedAppt.protocol}</h2>
                    <button
                      onClick={() => handleCopy(selectedAppt.protocol)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copiado!' : 'Copiar Protocolo'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 mt-1">
                    {selectedAppt.purchaseOrder && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{selectedAppt.purchaseOrders && selectedAppt.purchaseOrders.length > 1 ? 'Pedidos de Compra:' : 'Pedido de Compra:'}</span>
                        {(selectedAppt.purchaseOrders || selectedAppt.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean)).map((po, idx) => (
                          <strong key={idx} className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded font-mono text-[11px]">
                            PO {po.trim()}
                          </strong>
                        ))}
                      </div>
                    )}
                    <div>
                      Nota Fiscal: <strong className="text-slate-800">{selectedAppt.invoiceNumber ? `NF ${selectedAppt.invoiceNumber}` : 'Pendente / A emitir'}</strong> (Série {selectedAppt.invoiceSeries || '1'})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedAppt.status} size="lg" />
                  
                  {/* Pending Quick Approval Actions (Exclusively for Logged-In Supervisors/Admins) */}
                  {selectedAppt.status === 'PENDENTE' && onUpdateStatus && (
                    canApproveReject ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateStatus(selectedAppt.id, 'CONFIRMADO', selectedAppt.dockId)}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
                          title="Aprovar e confirmar solicitação (Supervisor ou Administrador)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar
                        </button>
                        <button
                          onClick={() => onUpdateStatus(selectedAppt.id, 'CANCELADO')}
                          className="inline-flex items-center gap-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 font-semibold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer"
                          title="Rejeitar solicitação (Supervisor ou Administrador)"
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : isOperatorOrAdmin ? (
                      <span
                        className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5"
                        title="Apenas Supervisores de Logística ou Administradores possuem permissão para aprovar ou rejeitar solicitações."
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        Aguardando Aprovação de Supervisor/Admin
                      </span>
                    ) : null
                  )}

                  {/* Signal In Transit button */}
                  {selectedAppt.status === 'CONFIRMADO' && onUpdateStatus && (
                    <button
                      onClick={() => onUpdateStatus(selectedAppt.id, 'EM_TRANSITO')}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs active:scale-95"
                      title="Sinalizar que o veículo saiu com a carga e está em deslocamento para a fábrica/CD"
                    >
                      <Truck className="w-4 h-4" />
                      Sinalizar Em Trânsito
                    </button>
                  )}

                  {/* Gerar Comprovante Button for confirmed/active appointments */}
                  {(selectedAppt.status === 'CONFIRMADO' ||
                    selectedAppt.status === 'EM_TRANSITO' ||
                    selectedAppt.status === 'NO_PATIO' ||
                    selectedAppt.status === 'AGUARDANDO_DESCARGA' ||
                    selectedAppt.status === 'ENTREGUE_SEM_DIVERGENCIA' ||
                    selectedAppt.status === 'ENTREGUE_COM_DIVERGENCIA') && onOpenReceipt && (
                    <button
                      onClick={() => onOpenReceipt(selectedAppt)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                      title="Gerar e imprimir comprovante de agendamento"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Gerar Comprovante</span>
                    </button>
                  )}

                  {/* Reschedule Button */}
                  {(selectedAppt.status === 'PENDENTE' ||
                    selectedAppt.status === 'CONFIRMADO' ||
                    selectedAppt.status === 'NO_SHOW') && (
                    isOperatorOrAdmin || (currentSupplierSession && (
                      (selectedAppt.supplierCnpj && currentSupplierSession.cnpj && selectedAppt.supplierCnpj.replace(/\D/g, '') === currentSupplierSession.cnpj.replace(/\D/g, '')) ||
                      (selectedAppt.supplierName && currentSupplierSession.name && selectedAppt.supplierName.toLowerCase().includes(currentSupplierSession.name.toLowerCase()))
                    )) ? (
                      <button
                        onClick={() => onOpenReschedule(selectedAppt)}
                        className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Solicitar nova data ou janela de horário para este agendamento"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reagendar
                      </button>
                    ) : !isOperatorOrAdmin && !currentSupplierSession ? (
                      <button
                        onClick={() => {
                          if (onOpenSupplierLogin) {
                            onOpenSupplierLogin();
                          } else {
                            onOpenReschedule(selectedAppt);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 text-xs font-medium px-3 py-2 rounded-xl transition-all cursor-pointer"
                        title="Identifique-se com o CNPJ da empresa para solicitar o reagendamento"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Reagendar (Requer Login)</span>
                      </button>
                    ) : null
                  )}
                </div>
              </div>

              {/* Information Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Fornecedor:
                  </span>
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedAppt.supplierName}</p>
                  <p className="text-[11px] text-slate-500">{selectedAppt.supplierCnpj || 'CNPJ não informado'}</p>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1">
                  <span className="text-indigo-900 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Unidade de Destino:
                  </span>
                  <p className="font-bold text-indigo-950 text-sm truncate">
                    {selectedAppt.destinationBranchName || 'Matriz - CD Principal'}
                  </p>
                  <p className="text-[11px] text-indigo-800/80 truncate">
                    {selectedAppt.destinationBranchAddress || 'Centro de Distribuição'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" /> Transportadora & Placa:
                  </span>
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedAppt.carrierName || 'Própria'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedAppt.vehiclePlate || 'Placa não informada'} • {selectedAppt.vehicleType}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-slate-400" /> Carga & Volume:
                  </span>
                  <p className="font-bold text-slate-800 text-sm">
                    {selectedAppt.weightKg.toLocaleString('pt-BR')} kg
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedAppt.totalVolumes} vol. ({selectedAppt.cargoType})
                  </p>
                </div>
              </div>

              {/* Fiscal Documents & Prevenção Double Check Card */}
              {(Boolean(selectedAppt.nfeAccessKeys && selectedAppt.nfeAccessKeys.length > 0) ||
                Boolean(selectedAppt.invoiceTotalValue) ||
                Boolean(selectedAppt.invoiceDueDate) ||
                selectedAppt.preventionDoubleChecked) && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Documentos Fiscais & Conferência de Prevenção</span>
                    </div>

                    {selectedAppt.preventionDoubleChecked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Double Check Concluído ({selectedAppt.preventionCheckedBy || 'Prevenção'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        Aguardando Double Check na Descarga
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block">Valor Total das Notas:</span>
                      <strong className="text-slate-900 text-sm">
                        {selectedAppt.invoiceTotalValue ? formatCurrencyBRL(selectedAppt.invoiceTotalValue) : 'Não informado'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block">Validade do Boleto:</span>
                      <strong className="text-slate-900 text-sm">
                        {selectedAppt.invoiceDueDate
                          ? new Date(selectedAppt.invoiceDueDate + 'T00:00:00').toLocaleDateString('pt-BR')
                          : 'Não aplicável / Não inf.'}
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium block">Total de Chaves NF-e:</span>
                      <strong className="text-slate-900 text-sm">
                        {selectedAppt.nfeAccessKeys ? selectedAppt.nfeAccessKeys.length : 0} chave(s)
                      </strong>
                    </div>
                  </div>

                  {selectedAppt.nfeAccessKeys && selectedAppt.nfeAccessKeys.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Chaves de Acesso de NF-e ({selectedAppt.nfeAccessKeys.length}):
                      </span>
                      <div className="max-h-28 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                        {selectedAppt.nfeAccessKeys.map((key, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="text-slate-700 truncate select-all">{formatNfeAccessKey(key)}</span>
                            <span className="text-[10px] text-slate-400 font-sans ml-2 shrink-0">NF #{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Timeline */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Evolução do Agendamento
                </h3>

                <div className="relative pl-6 space-y-4.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {getTimelineSteps(selectedAppt).map((step, idx) => {
                    return (
                      <div key={idx} className="relative flex items-center gap-3">
                        {/* Circle Indicator */}
                        <div
                          className={`absolute -left-6 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            step.isWarning
                              ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                              : step.done
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-bold ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                              {step.title}
                            </h4>
                            {step.timestamp && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                                <Clock className="w-2.5 h-2.5 text-blue-600" />
                                {step.timestamp}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discrepancy Detail Box if Status is ENTREGUE_COM_DIVERGENCIA */}
              {selectedAppt.discrepancy && (
                <div className="bg-orange-50/90 border border-orange-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-orange-900 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                    <span>Registro de Divergência no Recebimento</span>
                  </div>

                  <p className="text-xs text-orange-900/90 leading-relaxed">
                    {selectedAppt.discrepancy.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="font-semibold text-orange-950">Tipos Notificados:</span>
                    {selectedAppt.discrepancy.types.map((type, idx) => (
                      <span
                        key={idx}
                        className="bg-orange-200/80 text-orange-950 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                      >
                        {type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-orange-200/60 flex flex-wrap items-center justify-between text-[11px] text-orange-800">
                    <span>
                      Registrado por: <strong>{selectedAppt.discrepancy.reportedBy}</strong>
                    </span>
                    <span>
                      Data:{' '}
                      {new Date(selectedAppt.discrepancy.reportedAt).toLocaleDateString('pt-BR')}{' '}
                      {new Date(selectedAppt.discrepancy.reportedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Photo attachments simulation */}
                  {selectedAppt.discrepancy.photos && selectedAppt.discrepancy.photos.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs font-semibold text-orange-950 block mb-1">Fotos Anexadas pelo Conferente:</span>
                      <div className="flex gap-2">
                        {selectedAppt.discrepancy.photos.map((photo, i) => (
                          <img
                            key={i}
                            src={photo}
                            alt="Evidência de divergência"
                            className="w-20 h-20 object-cover rounded-lg border border-orange-300 shadow-2xs"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reschedule History Trail */}
              {selectedAppt.rescheduleHistory && selectedAppt.rescheduleHistory.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    Histórico de Reagendamentos Deste Protocolo ({selectedAppt.rescheduleHistory.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedAppt.rescheduleHistory.map(hist => (
                      <div key={hist.id} className="text-xs bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>
                            Alterado de {new Date(hist.previousDate + 'T00:00:00').toLocaleDateString('pt-BR')} ({hist.previousSlot}) para{' '}
                            {new Date(hist.newDate + 'T00:00:00').toLocaleDateString('pt-BR')} ({hist.newSlot})
                          </span>
                        </div>
                        <p className="text-slate-600 italic">Motivo declarado: "{hist.reason}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              Nenhum agendamento selecionado. Escolha um item na lista ao lado ou busque por um código.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
