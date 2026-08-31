import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, RefreshCw, AlertCircle, CheckCircle2, History, FilePlus, Package, Weight, Lock, LogIn, Building2, ShieldAlert, AlertTriangle, MapPin } from 'lucide-react';
import { Appointment, Dock, DestinationBranch } from '../types';
import { SupplierSession } from './SupplierLoginModal';
import {
  getDayOfWeekFromDate,
  getDayName,
  isDateAllowed,
  formatAllowedDaysSummary,
  getNextAllowedDate,
} from '../utils/dateUtils';

interface RescheduleModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedAppt: Appointment) => void;
  timeSlots?: string[];
  slotLimits?: Record<string, number>;
  destinations?: DestinationBranch[];
  currentSupplierSession?: SupplierSession | null;
  isOperator?: boolean;
  existingAppointments?: Appointment[];
  docks?: Dock[];
  onOpenSupplierLogin?: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onSuccess,
  timeSlots = [],
  slotLimits = {},
  destinations = [],
  currentSupplierSession,
  isOperator = false,
  existingAppointments = [],
  docks = [],
  onOpenSupplierLogin,
}) => {
  if (!isOpen || !appointment) return null;

  const apptDest = destinations.find(d => d.id === appointment.destinationBranchId) 
    || destinations.find(d => d.isDefault) 
    || destinations[0];

  const defaultSlots = timeSlots.length > 0 ? timeSlots : ['08:00 - 09:30', '10:00 - 11:30', '13:30 - 15:00', '15:30 - 17:00'];
  const branchAvailableSlots = (apptDest?.timeSlots && apptDest.timeSlots.length > 0)
    ? apptDest.timeSlots
    : defaultSlots;

  const branchAllowedDays = useMemo(() => {
    return (apptDest?.allowedDaysOfWeek && apptDest.allowedDaysOfWeek.length > 0)
      ? apptDest.allowedDaysOfWeek
      : [1, 2, 3, 4, 5];
  }, [apptDest]);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultNextDate = tomorrow.toISOString().split('T')[0];
  const initialValidDate = getNextAllowedDate(defaultNextDate, branchAllowedDays);

  const [newDate, setNewDate] = useState(initialValidDate);
  const [newSlot, setNewSlot] = useState(branchAvailableSlots[0] || '08:00 - 09:30');
  const [reason, setReason] = useState('');

  const isSelectedDateAllowed = isDateAllowed(newDate, branchAllowedDays, apptDest?.blockedDates);
  const selectedDayOfWeek = getDayOfWeekFromDate(newDate);
  
  // Extra Invoices & Volumes options for supplier returning with additional NFs
  const [addExtraInvoices, setAddExtraInvoices] = useState(false);
  const [additionalInvoices, setAdditionalInvoices] = useState('');
  const [updatedVolumes, setUpdatedVolumes] = useState(appointment.totalVolumes || 10);
  const [updatedWeightKg, setUpdatedWeightKg] = useState(appointment.weightKg || 1000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Authentication check
  const isSupplierLoggedIn = !!currentSupplierSession;
  const cleanApptCnpj = (appointment.supplierCnpj || '').replace(/\D/g, '');
  const cleanSessionCnpj = (currentSupplierSession?.cnpj || '').replace(/\D/g, '');

  const isMatchingSupplier = isSupplierLoggedIn && (
    (cleanApptCnpj && cleanSessionCnpj && cleanApptCnpj === cleanSessionCnpj) ||
    (currentSupplierSession?.name && appointment.supplierName &&
      appointment.supplierName.toLowerCase().includes(currentSupplierSession.name.toLowerCase()))
  );

  const canPerformReschedule = isOperator || isMatchingSupplier;

  const getSlotLimit = (slot: string) => {
    if (apptDest?.slotSupplierLimits?.[slot] !== undefined) {
      return apptDest.slotSupplierLimits[slot];
    }
    return slotLimits[slot] ?? 3;
  };

  // Calculate supplier count per slot for the newDate and this specific branch
  const slotOccupancy = useMemo(() => {
    const map: Record<string, number> = {};
    branchAvailableSlots.forEach(slot => {
      map[slot] = existingAppointments.filter(
        a =>
          a.id !== appointment.id &&
          a.scheduledDate === newDate &&
          a.timeSlot === slot &&
          (a.destinationBranchId ? a.destinationBranchId === apptDest?.id : apptDest?.isDefault) &&
          a.status !== 'CANCELADO' &&
          a.status !== 'NO_SHOW'
      ).length;
    });
    return map;
  }, [existingAppointments, newDate, branchAvailableSlots, appointment.id, apptDest]);

  // Calculate Dock Capacity for the newly selected date
  const targetDockInfo = useMemo(() => {
    const defaultDocksMap: Record<string, { limit: number; unit: string; name: string; id: string }> = {
      PALETIZADA: { limit: 140, unit: 'pallets', name: 'Doca 01 (Paletizada Geral)', id: 'DOCA-01' },
      REFRIGERADA: { limit: 40, unit: 'pallets', name: 'Doca 02 (Congelados/Refrigerado)', id: 'DOCA-02' },
      BATIDA: { limit: 200, unit: 'volumes', name: 'Doca 03 (Fracionados e Batidos)', id: 'DOCA-03' },
      FRACIONADA: { limit: 50, unit: 'volumes', name: 'Doca 04 (VUCs e Vans Express)', id: 'DOCA-04' },
      PERIGOSA: { limit: 140, unit: 'pallets', name: 'Doca 01 (Paletizada Geral)', id: 'DOCA-01' },
    };

    const branchDocks = (apptDest?.docks && apptDest.docks.length > 0)
      ? apptDest.docks
      : docks;

    if (branchDocks && branchDocks.length > 0) {
      const found = branchDocks.find(d => d.id === appointment.dockId || d.type === appointment.cargoType);
      if (found) {
        return {
          limit: found.dailyLimit || 100,
          unit: found.limitUnit || 'volumes',
          name: found.name,
          id: found.id,
        };
      }
    }
    return defaultDocksMap[appointment.cargoType] || defaultDocksMap['PALETIZADA'];
  }, [docks, apptDest, appointment.cargoType, appointment.dockId]);

  const scheduledDateTotal = useMemo(() => {
    if (!existingAppointments || existingAppointments.length === 0) return 0;
    return existingAppointments
      .filter(
        a =>
          a.id !== appointment.id &&
          a.scheduledDate === newDate &&
          a.status !== 'CANCELADO' &&
          a.status !== 'NO_SHOW' &&
          (a.destinationBranchId ? a.destinationBranchId === apptDest?.id : apptDest?.isDefault) &&
          (a.dockId === targetDockInfo.id || (!a.dockId && a.cargoType === appointment.cargoType))
      )
      .reduce((sum, a) => sum + (Number(a.totalVolumes) || 0), 0);
  }, [existingAppointments, newDate, targetDockInfo, appointment.cargoType, appointment.id, apptDest]);

  const projectedTotal = scheduledDateTotal + (addExtraInvoices ? Number(updatedVolumes || 0) : Number(appointment.totalVolumes || 0));
  const isOverLimit = projectedTotal > targetDockInfo.limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canPerformReschedule) {
      setError('Apenas a empresa responsável por este CNPJ ou um operador podem reagendar esta entrega.');
      return;
    }

    if (!reason.trim()) {
      setError('Por favor, descreva o motivo da solicitação de reagendamento.');
      return;
    }

    if (!isSelectedDateAllowed) {
      const dayName = getDayName(selectedDayOfWeek);
      const daysSummary = formatAllowedDaysSummary(branchAllowedDays);
      const branchName = apptDest?.name ? ` na unidade "${apptDest.name}"` : '';
      setError(`A data selecionada cai em um(a) ${dayName}, que não está disponível para recebimento${branchName}. Dias autorizados: ${daysSummary}.`);
      return;
    }

    setLoading(true);

    try {
      const requesterName = isOperator
        ? 'Operação Logística'
        : currentSupplierSession?.name || appointment.supplierName;

      const res = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate,
          newSlot,
          reason,
          requestedBy: requesterName,
          additionalInvoices: addExtraInvoices ? additionalInvoices : '',
          updatedVolumes: addExtraInvoices ? updatedVolumes : appointment.totalVolumes,
          updatedWeightKg: addExtraInvoices ? updatedWeightKg : appointment.weightKg,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao solicitar reagendamento.');
      }

      const updated: Appointment = await res.json();
      setSuccess(true);
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError(null);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 rounded-lg">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Solicitar Reagendamento</h2>
              <p className="text-xs text-slate-300">
                Protocolo: <span className="font-mono font-semibold text-amber-300">{appointment.protocol}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reagendamento Solicitado!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  O agendamento foi atualizado para a nova data e reenviado para a fila de aprovação da doca com status <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">PENDENTE</span>.
                </p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
                <p className="text-slate-500 font-semibold">Nova Janela Solicitada:</p>
                <p className="font-bold text-slate-800 text-sm">
                  {new Date(newDate + 'T00:00:00').toLocaleDateString('pt-BR')} às {newSlot}
                </p>
                <p className="text-slate-500 text-[11px]">
                  Doca Prevista: <strong className="text-slate-700">{targetDockInfo.name}</strong>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                Concluir
              </button>
            </div>
          ) : !canPerformReschedule ? (
            /* Unauthenticated / Unauthorized Protection Screen */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Identificação da Empresa Obrigatória</h3>
                <p className="text-xs text-slate-600 mt-1.5 max-w-sm mx-auto">
                  Como o reagendamento altera o compromisso e a ocupação da doca, apenas a empresa cadastrada (CNPJ <span className="font-mono font-bold text-slate-800">{appointment.supplierCnpj || 'não informado'}</span>) ou um operador podem solicitar a alteração.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-1">
                <div className="text-slate-500 font-medium">Dados do Agendamento:</div>
                <div className="font-bold text-slate-800">{appointment.supplierName}</div>
                <div className="text-slate-600 font-mono">NF: {appointment.invoiceNumber} • {appointment.scheduledDate} ({appointment.timeSlot})</div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
                {onOpenSupplierLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenSupplierLogin();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Acessar com CNPJ da Empresa
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current details box */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Agendamento Atual:
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                  {appointment.purchaseOrder && (
                    <div>
                      <span className="text-slate-500">Pedido de Compra:</span>{' '}
                      <span className="font-mono font-bold text-blue-700">PO {appointment.purchaseOrder}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Nota Fiscal:</span>{' '}
                    <span className="font-semibold">{appointment.invoiceNumber ? `NF ${appointment.invoiceNumber}` : 'Pendente'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Data Atual:</span>{' '}
                    <span className="font-semibold">
                      {new Date(appointment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Horário Atual:</span> <span className="font-semibold">{appointment.timeSlot}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Fornecedor:</span> <span className="font-semibold truncate block">{appointment.supplierName}</span>
                  </div>
                </div>
              </div>

              {/* Notice: Status will be Pending */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-950">Aviso Operacional:</span> O reagendamento atualiza a data (mínimo D+1) e coloca o status novamente em <strong className="text-amber-800 bg-amber-100 px-1 py-0.2 rounded font-semibold">PENDENTE</strong> para confirmação da equipe operacional.
                </div>
              </div>

              {/* New Date & Slot inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nova Data Desejada <span className="text-[11px] text-blue-600 font-normal">(A partir de amanhã)</span>
                    </label>
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {getDayName(selectedDayOfWeek)}
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    min={defaultNextDate}
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                      !isSelectedDateAllowed
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-slate-300'
                    }`}
                  />
                  {!isSelectedDateAllowed ? (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Dia Indisponível:</strong> A unidade{' '}
                        <strong>{apptDest?.name}</strong> não recebe entregas aos{' '}
                        <strong>{getDayName(selectedDayOfWeek)}s</strong>.
                        <div className="mt-1 flex items-center gap-1">
                          <span>Próximo dia autorizado:</span>
                          <button
                            type="button"
                            onClick={() => setNewDate(getNextAllowedDate(defaultNextDate, branchAllowedDays))}
                            className="font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
                          >
                            Ajustar para {getNextAllowedDate(defaultNextDate, branchAllowedDays)}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Atendimento autorizado: {formatAllowedDaysSummary(branchAllowedDays)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Janela de Horário</label>
                  <select
                    value={newSlot}
                    onChange={e => setNewSlot(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {branchAvailableSlots.map((slot, sIdx) => {
                      const limit = getSlotLimit(slot);
                      const count = slotOccupancy[slot] || 0;
                      const isFull = count >= limit;
                      return (
                        <option key={`resched-slot-${slot}-${sIdx}`} value={slot} disabled={isFull}>
                          {slot} {isFull ? '(Indisponível)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Reason input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo do Reagendamento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Atraso no faturamento da NF, indisponibilidade do motorista ou inclusão de novas notas."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Toggle for adding extra Invoices / NFs */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addExtraInvoices}
                    onChange={e => setAddExtraInvoices(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <FilePlus className="w-4 h-4 text-blue-600" />
                    <span>Inclusão de Mais Notas Fiscais (NFs) para esta Entrega</span>
                  </div>
                </label>

                {addExtraInvoices && (
                  <div className="space-y-3 pt-2 border-t border-blue-200/60 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Números das Novas NFs Adicionais (separadas por vírgula ou espaço)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: NF-8891, NF-8892"
                        value={additionalInvoices}
                        onChange={e => setAdditionalInvoices(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Essas notas serão vinculadas ao agendamento atual (NFs atuais: <span className="font-semibold">{appointment.invoiceNumber}</span>).
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <Package className="w-3 h-3 text-slate-500" /> Novo Total de Volumes
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={updatedVolumes}
                          onChange={e => setUpdatedVolumes(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <Weight className="w-3 h-3 text-slate-500" /> Novo Peso Total (Kg)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={updatedWeightKg}
                          onChange={e => setUpdatedWeightKg(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* History trail if previously rescheduled */}
              {appointment.rescheduleHistory && appointment.rescheduleHistory.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2">
                    <History className="w-3.5 h-3.5" /> Histórico de Alterações Anteriores ({appointment.rescheduleHistory.length})
                  </h4>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {appointment.rescheduleHistory.map(hist => (
                      <div key={hist.id} className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-600">
                        <span className="font-semibold text-slate-800">
                          De {new Date(hist.previousDate + 'T00:00:00').toLocaleDateString('pt-BR')} ({hist.previousSlot}) para{' '}
                          {new Date(hist.newDate + 'T00:00:00').toLocaleDateString('pt-BR')} ({hist.newSlot})
                        </span>
                        <p className="italic text-slate-500">Motivo: {hist.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons & Error on Left */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {error && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span className="font-medium leading-tight">{error}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <span>Solicitar Reagendamento</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

