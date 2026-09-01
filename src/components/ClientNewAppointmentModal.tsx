import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Truck, FileText, CheckCircle2, Copy, AlertCircle, Lock, MapPin, Building2, Info, Sparkles, KeyRound, Plus, Trash2, DollarSign, User, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Appointment, Dock, DestinationBranch } from '../types';
import { SupplierSession } from './SupplierLoginModal';
import { formatCpf, formatCurrencyBRL, parseCurrencyInput, formatNfeAccessKey, cleanNfeAccessKey, extractNfeKeysFromText } from '../utils/formatters';
import {
  getDayOfWeekFromDate,
  getDayName,
  isDateAllowed,
  formatAllowedDaysSummary,
  getNextAllowedDate,
} from '../utils/dateUtils';

interface ClientNewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAppt: Appointment) => void;
  currentSupplierSession?: SupplierSession | null;
  existingAppointments?: Appointment[];
  docks?: Dock[];
  timeSlots?: string[];
  slotLimits?: Record<string, number>;
  destinations?: DestinationBranch[];
}

export const ClientNewAppointmentModal: React.FC<ClientNewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSupplierSession,
  existingAppointments = [],
  docks,
  timeSlots = [],
  slotLimits: propSlotLimits = {},
  destinations = [],
}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  const availableSlots = timeSlots.length > 0 ? timeSlots : ['08:00 - 09:30', '10:00 - 11:30', '13:30 - 15:00', '15:30 - 17:00'];
  const activeDestinations = destinations.filter(d => d.active);
  const defaultDestination = activeDestinations.find(d => d.isDefault) || activeDestinations[0];

  const [formData, setFormData] = useState({
    destinationBranchId: defaultDestination?.id || '',
    purchaseOrder: '',
    invoiceNumber: '',
    invoiceSeries: '1',
    invoiceTotalValue: '' as string | number, // Valor Total das NFs (R$)
    supplierName: currentSupplierSession?.name || '',
    supplierCnpj: currentSupplierSession?.cnpj || '',
    carrierName: '',
    driverName: '',
    driverCpf: '',
    driverPhone: '',
    vehiclePlate: '',
    vehicleType: 'TRUCK_34' as const,
    cargoType: 'PALETIZADA' as const,
    weightKg: 2500,
    totalVolumes: 20,
    scheduledDate: minDateStr,
    timeSlot: availableSlots[0] || '08:00 - 09:30',
    isPreApprovedContract: false,
    notes: '',
  });

  // Lista de Chaves de Acesso da NF-e (permitindo até 5 ou mais chaves de 44 dígitos)
  const [nfeAccessKeys, setNfeAccessKeys] = useState<string[]>(['']);
  const nfeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAddNfeKey = () => {
    if (nfeAccessKeys.length < 20) {
      setNfeAccessKeys(prev => [...prev, '']);
      setTimeout(() => {
        nfeInputRefs.current[nfeAccessKeys.length]?.focus();
      }, 40);
    }
  };

  const handleRemoveNfeKey = (index: number) => {
    setNfeAccessKeys(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : [''];
    });
  };

  const handleNfeKeyChange = (index: number, val: string) => {
    // Se o usuário colou múltiplas chaves ou texto longo com várias NFs
    const extracted = extractNfeKeysFromText(val);
    if (extracted.length > 1) {
      setNfeAccessKeys(prev => {
        const next = [...prev];
        next.splice(index, 1, ...extracted);
        if (next.length < 20 && !next[next.length - 1]) {
          // já tem linha vazia
        } else if (next.length < 20) {
          next.push('');
        }
        const trimmed = next.slice(0, 20);
        setTimeout(() => {
          const nextFocus = Math.min(index + extracted.length, trimmed.length - 1);
          nfeInputRefs.current[nextFocus]?.focus();
        }, 40);
        return trimmed;
      });
      return;
    }

    const cleaned = cleanNfeAccessKey(val);
    setNfeAccessKeys(prev => {
      const updated = [...prev];
      updated[index] = cleaned;
      
      // Auto-criação e descida automática de linha:
      // Ao atingir 44 dígitos, se for a última linha cria a próxima e desce o cursor; se já existir a próxima, desce o cursor
      if (cleaned.length === 44) {
        if (index === updated.length - 1 && updated.length < 20) {
          updated.push('');
        }
        setTimeout(() => {
          nfeInputRefs.current[index + 1]?.focus();
        }, 40);
      }
      return updated;
    });
  };

  // Suporte a leitor de código de barras: ao receber Enter na chave NF-e, não submete e avança para a próxima linha
  const handleNfeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      const currentVal = cleanNfeAccessKey(nfeAccessKeys[index] || '');
      if (index === nfeAccessKeys.length - 1) {
        if (currentVal.length > 0 && nfeAccessKeys.length < 20) {
          setNfeAccessKeys(prev => [...prev, '']);
          setTimeout(() => {
            nfeInputRefs.current[index + 1]?.focus();
          }, 40);
        }
      } else {
        nfeInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePasteNfeKey = async (index: number) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const extracted = extractNfeKeysFromText(text);
        if (extracted.length > 1) {
          setNfeAccessKeys(prev => {
            const next = [...prev];
            next.splice(index, 1, ...extracted);
            return next.slice(0, 20);
          });
        } else {
          handleNfeKeyChange(index, text);
        }
      }
    } catch (_) {}
  };

  // Sync default destination if not set yet
  useEffect(() => {
    if (!formData.destinationBranchId && defaultDestination) {
      setFormData(prev => ({ ...prev, destinationBranchId: defaultDestination.id }));
    }
  }, [defaultDestination, formData.destinationBranchId]);

  const selectedBranch = activeDestinations.find(d => d.id === formData.destinationBranchId) || defaultDestination || activeDestinations[0];

  // Dias da semana permitidos para a filial selecionada
  const branchAllowedDays = React.useMemo(() => {
    return (selectedBranch?.allowedDaysOfWeek && selectedBranch.allowedDaysOfWeek.length > 0)
      ? selectedBranch.allowedDaysOfWeek
      : [1, 2, 3, 4, 5];
  }, [selectedBranch]);

  // Se a data atual não for permitida na filial, ajusta para a próxima data permitida
  useEffect(() => {
    if (isOpen && branchAllowedDays.length > 0) {
      if (!isDateAllowed(formData.scheduledDate, branchAllowedDays, selectedBranch?.blockedDates)) {
        const nextValid = getNextAllowedDate(minDateStr, branchAllowedDays);
        setFormData(prev => ({ ...prev, scheduledDate: nextValid }));
      }
    }
  }, [isOpen, selectedBranch?.id, branchAllowedDays]);

  const isSelectedDateAllowed = isDateAllowed(formData.scheduledDate, branchAllowedDays, selectedBranch?.blockedDates);
  const selectedDayOfWeek = getDayOfWeekFromDate(formData.scheduledDate);

  // Janelas disponíveis para a filial selecionada
  const branchAvailableSlots = React.useMemo(() => {
    if (selectedBranch?.timeSlots && selectedBranch.timeSlots.length > 0) {
      return selectedBranch.timeSlots;
    }
    return availableSlots.length > 0 ? availableSlots : ['07:00 - 08:30', '08:30 - 10:00', '10:00 - 11:30', '13:00 - 14:30', '14:30 - 16:00', '16:00 - 17:30'];
  }, [selectedBranch, availableSlots]);

  // Se a janela selecionada não existir na filial atual, reajustar para a primeira válida
  useEffect(() => {
    if (branchAvailableSlots.length > 0 && !branchAvailableSlots.includes(formData.timeSlot)) {
      setFormData(prev => ({ ...prev, timeSlot: branchAvailableSlots[0] }));
    }
  }, [branchAvailableSlots, formData.timeSlot]);

  const [slotLimits, setSlotLimits] = useState<Record<string, number>>(() => propSlotLimits);

  useEffect(() => {
    if (propSlotLimits && Object.keys(propSlotLimits).length > 0) {
      setSlotLimits(propSlotLimits);
    }
  }, [propSlotLimits]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/slot-limits')
        .then(res => res.json())
        .then(data => {
          if (data && typeof data === 'object') {
            setSlotLimits(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentSupplierSession) {
      setFormData(prev => ({
        ...prev,
        supplierName: currentSupplierSession.name,
        supplierCnpj: currentSupplierSession.cnpj,
      }));
    }
  }, [currentSupplierSession, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [copied, setCopied] = useState(false);

  // Helper para obter limite máximo de uma janela na filial selecionada
  const getSlotMaxSuppliers = (slot: string) => {
    if (selectedBranch?.slotSupplierLimits?.[slot] !== undefined) {
      return selectedBranch.slotSupplierLimits[slot];
    }
    return slotLimits[slot] ?? 3;
  };

  // Calculate supplier count per slot for selected date AND selected branch
  const slotOccupancy = React.useMemo(() => {
    const map: Record<string, number> = {};
    branchAvailableSlots.forEach(slot => {
      map[slot] = existingAppointments.filter(
        a =>
          a.scheduledDate === formData.scheduledDate &&
          a.timeSlot === slot &&
          (a.destinationBranchId ? a.destinationBranchId === selectedBranch?.id : selectedBranch?.isDefault) &&
          a.status !== 'CANCELADO' &&
          a.status !== 'NO_SHOW'
      ).length;
    });
    return map;
  }, [existingAppointments, formData.scheduledDate, branchAvailableSlots, selectedBranch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação de Pedido de Compra (Obrigatório)
    if (!formData.purchaseOrder.trim()) {
      setError('Informe o número do Pedido de Compra (obrigatório).');
      return;
    }

    if (!formData.supplierName.trim()) {
      setError('Informe a Razão Social do fornecedor/remetente.');
      return;
    }

    // Validação D+0 (Proibir solicitação para o dia atual ou datas passadas)
    const todayStr = new Date().toISOString().split('T')[0];
    if (formData.scheduledDate <= todayStr) {
      setError('Não é permitido solicitar agendamentos para o mesmo dia (D+0). A data mínima permitida é a partir de amanhã.');
      return;
    }

    // Validação de Dias Autorizados para Recebimento (ex: bloquear Fins de Semana ou Dias Não-Úteis)
    if (!isSelectedDateAllowed) {
      const dayName = getDayName(selectedDayOfWeek);
      const daysSummary = formatAllowedDaysSummary(branchAllowedDays);
      const branchName = selectedBranch?.name ? ` na unidade "${selectedBranch.name}"` : '';
      setError(`A data selecionada cai em um(a) ${dayName}, que não está disponível para agendamento${branchName}. Os dias autorizados para recebimento são: ${daysSummary}.`);
      return;
    }

    // Validação de Limite de Fornecedores por Janela na Filial
    const maxSuppliers = getSlotMaxSuppliers(formData.timeSlot);
    const currentCount = slotOccupancy[formData.timeSlot] || 0;
    if (currentCount >= maxSuppliers) {
      const branchName = selectedBranch?.name ? ` na unidade "${selectedBranch.name}"` : '';
      setError(`A janela de horário ${formData.timeSlot}${branchName} para a data selecionada já está indisponível. Por favor, selecione outro horário ou data.`);
      return;
    }

    setLoading(true);

    try {
      const validNfeKeys = nfeAccessKeys.map(k => cleanNfeAccessKey(k)).filter(Boolean);
      const parsedValue = typeof formData.invoiceTotalValue === 'string'
        ? parseCurrencyInput(formData.invoiceTotalValue)
        : formData.invoiceTotalValue;

      const payload = {
        ...formData,
        invoiceTotalValue: parsedValue > 0 ? parsedValue : undefined,
        nfeAccessKeys: validNfeKeys,
        nfeAccessKey: validNfeKeys[0] || undefined,
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao criar agendamento.');
      }

      const data: Appointment = await res.json();
      setCreatedAppointment(data);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar solicitação de agendamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyProtocol = () => {
    if (createdAppointment) {
      navigator.clipboard.writeText(createdAppointment.protocol);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setCreatedAppointment(null);
    setFormData({
      destinationBranchId: defaultDestination?.id || '',
      purchaseOrder: '',
      invoiceNumber: '',
      invoiceSeries: '1',
      invoiceTotalValue: '',
      supplierName: '',
      supplierCnpj: '',
      carrierName: '',
      driverName: '',
      driverCpf: '',
      driverPhone: '',
      vehiclePlate: '',
      vehicleType: 'TRUCK_34',
      cargoType: 'PALETIZADA',
      weightKg: 2500,
      totalVolumes: 20,
      scheduledDate: minDateStr,
      timeSlot: availableSlots[0] || '08:00 - 09:30',
      isPreApprovedContract: false,
      notes: '',
    });
    setNfeAccessKeys(['']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Solicitar Agendamento de Entrega</h2>
              <p className="text-xs text-slate-300">Reserve a data e janela de horário para entrega de suprimentos</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {createdAppointment ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Agendamento Solicitado com Sucesso!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Guarde seu código de protocolo para consultar o status ou solicitar alteração.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-md mx-auto text-left space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">CÓDIGO DE PROTOCOLO:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-blue-600">{createdAppointment.protocol}</span>
                    <button
                      onClick={handleCopyProtocol}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Copiar Protocolo"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {copied && (
                  <p className="text-xs text-emerald-600 text-right font-medium">Copiado para a área de transferência!</p>
                )}

                {createdAppointment.destinationBranchName && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-950">
                    <div className="flex items-center gap-1.5 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Destino: {createdAppointment.destinationBranchName}</span>
                    </div>
                    {createdAppointment.destinationBranchAddress && (
                      <p className="text-[11px] text-indigo-800 mt-0.5 ml-5">
                        {createdAppointment.destinationBranchAddress}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Pedido de Compra:</span>
                    <span className="font-semibold text-blue-700 font-mono">PO {createdAppointment.purchaseOrder}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nota Fiscal:</span>
                    <span className="font-semibold text-slate-800">
                      {createdAppointment.invoiceNumber ? `NF ${createdAppointment.invoiceNumber}` : 'Pendente / A emitir'}
                    </span>
                  </div>
                  {createdAppointment.invoiceTotalValue !== undefined && createdAppointment.invoiceTotalValue !== null && (
                    <div>
                      <span className="text-slate-500 block">Valor Total NFs:</span>
                      <span className="font-semibold text-emerald-700 font-mono">
                        {formatCurrencyBRL(createdAppointment.invoiceTotalValue)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block">Fornecedor:</span>
                    <span className="font-semibold text-slate-800 truncate block">{createdAppointment.supplierName}</span>
                  </div>
                  {createdAppointment.driverName && (
                    <div>
                      <span className="text-slate-500 block">Motorista:</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {createdAppointment.driverName} {createdAppointment.driverCpf ? `(CPF: ${createdAppointment.driverCpf})` : ''}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 block">Data Prevista:</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(createdAppointment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Janela de Horário:</span>
                    <span className="font-semibold text-slate-800">{createdAppointment.timeSlot}</span>
                  </div>
                  {createdAppointment.nfeAccessKeys && createdAppointment.nfeAccessKeys.length > 0 && (
                    <div className="col-span-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 mt-1">
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">
                        Chaves de Acesso da NF-e ({createdAppointment.nfeAccessKeys.length}):
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {createdAppointment.nfeAccessKeys.map((key, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] font-mono bg-white p-1.5 rounded border border-slate-200 text-slate-700">
                            <span className="truncate">{key}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(key)}
                              className="ml-2 text-blue-600 hover:text-blue-800 shrink-0 font-sans font-medium"
                              title="Copiar Chave"
                            >
                              Copiar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md cursor-pointer"
                >
                  Concluir & Ir para Meus Agendamentos
                </button>
              </div>
            </div>
          ) : (
            /* Form input */
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                // Impede o envio acidental por RETURN/Enter (leitores de código de barras ou teclado)
                if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-5"
            >

              {/* Section 0: Destino / Filial de Entrega (quando configurado) */}
              {activeDestinations.length > 0 && (
                <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                      Unidade de Destino / Local de Descarga <span className="text-rose-500">*</span>
                    </h3>
                    {selectedBranch?.isDefault && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-white border border-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" /> Unidade Padrão
                      </span>
                    )}
                  </div>

                  {activeDestinations.length === 1 ? (
                    <div className="bg-white border border-indigo-200 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{activeDestinations[0].name}</span>
                        {activeDestinations[0].code && (
                          <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                            {activeDestinations[0].code}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        {activeDestinations[0].address}
                        {activeDestinations[0].city ? ` - ${activeDestinations[0].city}/${activeDestinations[0].state || ''}` : ''}
                      </p>
                      {activeDestinations[0].receptionInstructions && (
                        <p className="text-[10px] text-indigo-800 bg-indigo-50/80 p-1.5 rounded-lg border border-indigo-100 mt-1">
                          📌 {activeDestinations[0].receptionInstructions}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={formData.destinationBranchId}
                        onChange={e => setFormData({ ...formData, destinationBranchId: e.target.value })}
                        className="w-full px-3 py-2.5 text-xs sm:text-sm font-semibold bg-white border border-indigo-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                      >
                        {activeDestinations.map((branch, bIdx) => (
                          <option key={`client-new-dest-${branch.id || ''}-${bIdx}`} value={branch.id}>
                            {branch.name} {branch.code ? `(${branch.code})` : ''} {branch.city ? `- ${branch.city}/${branch.state || ''}` : ''}
                          </option>
                        ))}
                      </select>

                      {selectedBranch && (
                        <div className="bg-white/90 border border-indigo-200 rounded-xl p-2.5 text-[11px] text-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800">
                              📍 {selectedBranch.address || 'Endereço principal da unidade'}
                              {selectedBranch.city ? ` • ${selectedBranch.city}/${selectedBranch.state || ''}` : ''}
                            </span>
                            {selectedBranch.cnpj && (
                              <span className="font-mono text-[10px] text-slate-500">CNPJ: {selectedBranch.cnpj}</span>
                            )}
                          </div>
                          {selectedBranch.receptionInstructions && (
                            <p className="text-[10px] text-indigo-900 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
                              ℹ️ Portaria: {selectedBranch.receptionInstructions}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Section 1: Documentação e Pedido de Compra */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  1. Documentação & Pedido de Compra
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Campo Nota Fiscal (OPCIONAL) */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nº(s) das Notas Fiscais (NFs) <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
                      </label>
                      {formData.invoiceNumber && formData.invoiceNumber.split(/[,;\n\/]+/).filter(Boolean).length > 1 && (
                        <span className="text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full">
                          📦 {formData.invoiceNumber.split(/[,;\n\/]+/).filter(Boolean).length} NFs no agendamento
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: 849201 (Opcional - caso já emitida)"
                      value={formData.invoiceNumber}
                      onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Caso a NF ainda não tenha sido emitida, o agendamento pode ser solicitado e a NF informada posteriormente.
                    </p>
                  </div>

                  {/* Campo Pedido de Compra (PO / Ordem de Fornecimento) */}
                  <div className="sm:col-span-2 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Pedido de Compra (PO / Ordem de Fornecimento)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {formData.purchaseOrder && formData.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length > 1 && (
                          <span className="text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full">
                            🏷️ {formData.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length} Pedidos identificados
                          </span>
                        )}
                        <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded font-semibold uppercase">
                          Obrigatório
                        </span>
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Ex: PC-2026-8841, PO-94821 (separe por vírgula se houver mais de um pedido)"
                      value={formData.purchaseOrder}
                      onChange={e => setFormData({ ...formData, purchaseOrder: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono font-bold text-slate-900 bg-white"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                      🔒 É possível informar múltiplos pedidos de compra separados por vírgula caso vá juntar mais de uma entrega no mesmo agendamento.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Série da NF</label>
                    <input
                      type="text"
                      placeholder="1"
                      value={formData.invoiceSeries}
                      onChange={e => setFormData({ ...formData, invoiceSeries: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Campo Valor Total das Notas Fiscais */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Valor Total das NFs (R$)</span>
                      <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 15450,00"
                      value={formData.invoiceTotalValue}
                      onChange={e => setFormData({ ...formData, invoiceTotalValue: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-emerald-800 font-semibold"
                    />
                  </div>

                  {/* Seção Chaves de Acesso da NF-e (44 dígitos - suporte a múltiplas chaves) */}
                  <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                        <span>Chaves de Acesso da NF-e (44 dígitos)</span>
                      </label>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                        {nfeAccessKeys.filter(k => cleanNfeAccessKey(k).length === 44).length} de {nfeAccessKeys.length} preenchida(s)
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      Cole ou leia com leitor de código de barras (44 dígitos). <strong className="text-blue-700">Novas linhas são criadas e focadas automaticamente</strong>.
                    </p>

                    <div className="space-y-2">
                      {nfeAccessKeys.map((keyVal, idx) => {
                        const cleanKey = cleanNfeAccessKey(keyVal);
                        const isComplete = cleanKey.length === 44;
                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <input
                                ref={el => { nfeInputRefs.current[idx] = el; }}
                                type="text"
                                maxLength={54}
                                placeholder="35260800000000000000550010000000001000000000"
                                value={keyVal}
                                onChange={e => handleNfeKeyChange(idx, e.target.value)}
                                onKeyDown={e => handleNfeKeyDown(e, idx)}
                                className={`w-full pl-8 pr-16 py-1.5 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                  isComplete
                                    ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950'
                                    : cleanKey.length > 0
                                    ? 'border-amber-300 bg-amber-50/30 text-slate-800'
                                    : 'border-slate-300 bg-white text-slate-800'
                                }`}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px]">
                                <span className={isComplete ? 'text-emerald-700 font-bold' : cleanKey.length > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                                  {cleanKey.length}/44
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePasteNfeKey(idx)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white bg-slate-200/60 rounded-md border border-slate-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                              title="Colar Chave da Área de Transferência"
                            >
                              Colar
                            </button>

                            {nfeAccessKeys.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveNfeKey(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                                title="Remover esta chave"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Razão Social / Fornecedor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Eurofarma Laboratórios"
                      value={formData.supplierName}
                      onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ do Fornecedor</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={formData.supplierCnpj}
                      onChange={e => setFormData({ ...formData, supplierCnpj: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Transporte & Veículo & Motorista */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  2. Dados de Transporte & Motorista
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Transportadora</label>
                    <input
                      type="text"
                      placeholder="Ex: Expresso São Miguel"
                      value={formData.carrierName}
                      onChange={e => setFormData({ ...formData, carrierName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Veículo</label>
                    <select
                      value={formData.vehicleType}
                      onChange={e => setFormData({ ...formData, vehicleType: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="TRUCK_34">Truck 3/4</option>
                      <option value="CARRETA">Carreta / Baú</option>
                      <option value="TOCO">Toco</option>
                      <option value="VUC">VUC (Veículo Urbano)</option>
                      <option value="VAN">Van / Utilitário</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Placa do Veículo</label>
                    <input
                      type="text"
                      placeholder="ABC-1E23"
                      value={formData.vehiclePlate}
                      onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                    />
                  </div>

                  {/* Campos do Motorista: Nome, CPF, Telefone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Motorista</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={formData.driverName}
                      onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>CPF do Motorista</span>
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={formData.driverCpf}
                      onChange={e => setFormData({ ...formData, driverCpf: formatCpf(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(11) 98765-4321"
                      value={formData.driverPhone}
                      onChange={e => setFormData({ ...formData, driverPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Carga</label>
                    <select
                      value={formData.cargoType}
                      onChange={e => setFormData({ ...formData, cargoType: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="PALETIZADA">Paletizada (PBR)</option>
                      <option value="BATIDA">Carga Batida (Caixas)</option>
                      <option value="REFRIGERADA">Refrigerada / Climatizada</option>
                      <option value="FRACIONADA">Fracionada / Express</option>
                      <option value="PERIGOSA">Carga Perigosa (Hazmat)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Total (Kg)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.weightKg}
                      onChange={e => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {formData.cargoType === 'BATIDA' || formData.cargoType === 'FRACIONADA'
                        ? 'Total de Volumes (Caixas)'
                        : 'Total de Paletes (PBR / Padrão)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder={formData.cargoType === 'BATIDA' || formData.cargoType === 'FRACIONADA' ? 'Ex: 150 volumes' : 'Ex: 24 paletes'}
                      value={formData.totalVolumes}
                      onChange={e => setFormData({ ...formData, totalVolumes: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Data e Janela de Horário */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    3. Agendamento & Horário
                  </h3>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-600" />
                    Recebimento: {formatAllowedDaysSummary(branchAllowedDays)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Data Pretendida <span className="text-[11px] text-blue-600 font-normal">(A partir de amanhã)</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {getDayName(selectedDayOfWeek)}
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      min={minDateStr}
                      value={formData.scheduledDate}
                      onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
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
                          <strong>{selectedBranch?.name}</strong> não recebe entregas aos{' '}
                          <strong>{getDayName(selectedDayOfWeek)}s</strong>.
                          <div className="mt-1 flex items-center gap-1">
                            <span>Próximo dia disponível:</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, scheduledDate: getNextAllowedDate(minDateStr, branchAllowedDays) }))}
                              className="font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
                            >
                              Ajustar para {getNextAllowedDate(minDateStr, branchAllowedDays)}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-1">
                        📅 Agendamentos devem ser solicitados com no mínimo 1 dia de antecedência (D+1).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Janela de Horário ({selectedBranch?.name || 'Unidade'})
                    </label>
                    <select
                      value={formData.timeSlot}
                      onChange={e => setFormData({ ...formData, timeSlot: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                    >
                      {branchAvailableSlots.map((slot, sIdx) => {
                        const count = slotOccupancy[slot] || 0;
                        const max = getSlotMaxSuppliers(slot);
                        const isFull = count >= max;
                        return (
                          <option key={`client-new-slot-${slot}-${sIdx}`} value={slot} disabled={isFull}>
                            {slot} {isFull ? '(Indisponível)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Horários de atendimento para a unidade selecionada.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Janela Pré-Aprovada & Observações */}
              <div className="space-y-3">
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="isPreApprovedContract"
                    checked={formData.isPreApprovedContract}
                    onChange={e => setFormData({ ...formData, isPreApprovedContract: e.target.checked })}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isPreApprovedContract" className="cursor-pointer select-none">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      ⭐ Janela Pré-Aprovada (Contrato Recorrente / Fornecedor VIP)
                    </span>
                    <span className="text-[11px] text-indigo-800/90 block mt-0.5">
                      Marque se esta entrega for respaldada por contrato fixo de suprimentos. O agendamento será <strong>aprovado automaticamente</strong> sem aguardar análise manual de recebimento.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Instruções de Recebimento / Observações</label>
                  <textarea
                    rows={2}
                    placeholder="Instruções de acesso ao parque fabril, exigência de EPI, observações de temperatura..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer Area: Notice/Error on Left + Action Buttons on Right */}
              <div className="pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    onClick={handleReset}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <span>Confirmar Solicitação</span>
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
