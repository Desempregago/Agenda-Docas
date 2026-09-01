import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  Truck, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound, 
  Trash2, 
  DollarSign, 
  Calendar, 
  Building2, 
  User, 
  ArrowRightCircle, 
  AlertCircle,
  Copy,
  Info,
  Phone
} from 'lucide-react';
import { Appointment, Dock, SystemUser } from '../types';
import { formatCurrencyBRL, parseCurrencyInput, formatNfeAccessKey, cleanNfeAccessKey, extractNfeKeysFromText, formatCpf, formatPhone } from '../utils/formatters';

interface DoubleCheckUnloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  docks: Dock[];
  currentSystemUser?: SystemUser | null;
  onConfirmRelease: (
    apptId: string,
    data: {
      dockId: string;
      nfeAccessKeys: string[];
      invoiceNumbers?: string[];
      invoiceTotalValue?: number;
      invoiceDueDate?: string;
      notes?: string;
      preventionCheckedBy?: string;
      driverName?: string;
      driverCpf?: string;
      driverPhone?: string;
      vehiclePlate?: string;
      vehicleType?: 'TRUCK_34' | 'TOCO' | 'VUC' | 'CARRETA' | 'VAN';
      carrierName?: string;
    }
  ) => Promise<void> | void;
}

export const DoubleCheckUnloadModal: React.FC<DoubleCheckUnloadModalProps> = ({
  isOpen,
  onClose,
  appointment,
  docks,
  currentSystemUser,
  onConfirmRelease,
}) => {
  if (!isOpen || !appointment) return null;

  // Chaves originalmente cadastradas na solicitação de agendamento
  const originalKeys = (appointment.nfeAccessKeys || [])
    .map(k => cleanNfeAccessKey(k))
    .filter(k => k.length === 44);
  const hadInitialKeys = originalKeys.length > 0;

  // Doca pré-selecionada: se o agendamento já tiver doca, usa; senão busca a primeira doca operacional compatível com o tipo de carga
  const getInitialDockId = () => {
    if (appointment.dockId) return appointment.dockId;
    const matchingOperationalDock = docks.find(d => d.isOperational && d.type === appointment.cargoType);
    if (matchingOperationalDock) return matchingOperationalDock.id;
    const firstOperational = docks.find(d => d.isOperational);
    if (firstOperational) return firstOperational.id;
    return docks[0]?.id ?? 'DOCA-01';
  };

  const [selectedDockId, setSelectedDockId] = useState<string>(getInitialDockId);
  
  // As chaves para leitura física começam vazias para conferência cega/double check
  const [nfeAccessKeys, setNfeAccessKeys] = useState<string[]>(['']);
  
  const [invoiceNumbersInput, setInvoiceNumbersInput] = useState<string>(
    appointment.invoiceNumbers && appointment.invoiceNumbers.length > 0 
      ? appointment.invoiceNumbers.join(', ') 
      : (appointment.invoiceNumber || '')
  );
  const [invoiceTotalValueInput, setInvoiceTotalValueInput] = useState<string>(
    appointment.invoiceTotalValue !== undefined && appointment.invoiceTotalValue !== null
      ? formatCurrencyBRL(appointment.invoiceTotalValue).replace('R$', '').trim()
      : ''
  );
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>(appointment.invoiceDueDate || '');
  const [notes, setNotes] = useState<string>(appointment.notes || '');
  const [operatorName, setOperatorName] = useState<string>(currentSystemUser?.name || 'Prevenção de Perdas');

  // Dados do Motorista e Veículo para conferência e preenchimento na guarita/double check
  const [driverName, setDriverName] = useState<string>(appointment.driverName || '');
  const [driverCpf, setDriverCpf] = useState<string>(appointment.driverCpf || '');
  const [driverPhone, setDriverPhone] = useState<string>(appointment.driverPhone || '');
  const [vehiclePlate, setVehiclePlate] = useState<string>(appointment.vehiclePlate || '');
  const [vehicleType, setVehicleType] = useState<'TRUCK_34' | 'TOCO' | 'VUC' | 'CARRETA' | 'VAN'>(appointment.vehicleType || 'TRUCK_34');
  const [carrierName, setCarrierName] = useState<string>(appointment.carrierName || '');

  const [error, setError] = useState<string | null>(null);
  const [warningConfirm, setWarningConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const nfeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sincroniza estado quando o agendamento muda (mantém chaves vazias para leitura física)
  useEffect(() => {
    if (appointment) {
      setNfeAccessKeys(['']);
      setSelectedDockId(getInitialDockId());
      setInvoiceNumbersInput(
        appointment.invoiceNumbers && appointment.invoiceNumbers.length > 0 
          ? appointment.invoiceNumbers.join(', ') 
          : (appointment.invoiceNumber || '')
      );
      setInvoiceTotalValueInput(
        appointment.invoiceTotalValue !== undefined && appointment.invoiceTotalValue !== null
          ? formatCurrencyBRL(appointment.invoiceTotalValue).replace('R$', '').trim()
          : ''
      );
      setInvoiceDueDate(appointment.invoiceDueDate || '');
      setNotes(appointment.notes || '');
      setDriverName(appointment.driverName || '');
      setDriverCpf(appointment.driverCpf || '');
      setDriverPhone(appointment.driverPhone || '');
      setVehiclePlate(appointment.vehiclePlate || '');
      setVehicleType(appointment.vehicleType || 'TRUCK_34');
      setCarrierName(appointment.carrierName || '');
      setError(null);
      setWarningConfirm(null);
    }
  }, [appointment, docks]);

  // Manipulação de chaves NF-e com leitura óptica e auto-avanço
  const handleNfeKeyChange = (index: number, val: string) => {
    setError(null);
    setWarningConfirm(null);
    const extracted = extractNfeKeysFromText(val);
    if (extracted.length > 1) {
      setNfeAccessKeys(prev => {
        const next = [...prev];
        next.splice(index, 1, ...extracted);
        if (next.length < 20 && !next[next.length - 1]) {
          // Já tem linha vazia
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

      // Se preencheu 44 dígitos, se for na última linha cria nova linha vazia e desce o foco; se já tiver próxima, desce o foco
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

  const handleRemoveNfeKey = (index: number) => {
    setError(null);
    setWarningConfirm(null);
    if (nfeAccessKeys.length <= 1) {
      setNfeAccessKeys(['']);
      return;
    }
    setNfeAccessKeys(prev => prev.filter((_, i) => i !== index));
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
            if (next.length < 20 && !next[next.length - 1]) {
              // já tem linha vazia
            } else if (next.length < 20) {
              next.push('');
            }
            return next.slice(0, 20);
          });
        } else {
          handleNfeKeyChange(index, text);
        }
      }
    } catch (_) {}
  };

  // Batimento das chaves escaneadas com as chaves cadastradas no agendamento
  const enteredValidKeys = nfeAccessKeys
    .map(k => cleanNfeAccessKey(k))
    .filter(k => k.length === 44);

  // Chaves cadastradas que já foram validadas no Double Check
  const matchedOriginalKeys = originalKeys.filter(origKey => enteredValidKeys.includes(origKey));
  const missingOriginalKeys = originalKeys.filter(origKey => !enteredValidKeys.includes(origKey));
  const extraEnteredKeys = enteredValidKeys.filter(entKey => !originalKeys.includes(entKey));

  const allScheduledKeysMatched = hadInitialKeys && originalKeys.length > 0 && missingOriginalKeys.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação de chaves bipadas
    if (enteredValidKeys.length === 0) {
      setError('É obrigatório escanear ou digitar pelo menos uma Chave de Acesso da NF-e (44 dígitos) para conferência física.');
      return;
    }

    const parsedTotalValue = invoiceTotalValueInput.trim() ? parseCurrencyInput(invoiceTotalValueInput) : undefined;
    
    // Se o agendamento não tinha chaves originalmente, exige conferência do valor e boleto
    if (!hadInitialKeys && (parsedTotalValue === undefined || parsedTotalValue <= 0)) {
      setError('Como este agendamento não possuía chaves prévias, informe o Valor Total das Notas Fiscais (R$) para o Double Check da Prevenção.');
      return;
    }

    if (!hadInitialKeys && !invoiceDueDate) {
      setError('Como este agendamento não possuía chaves prévias, informe a Data de Validade / Vencimento do Boleto.');
      return;
    }

    // Se havia chaves cadastradas e nem todas foram validadas, exige confirmação expressa do operador
    if (hadInitialKeys && missingOriginalKeys.length > 0 && !warningConfirm) {
      setWarningConfirm(
        `Atenção: Existem ${missingOriginalKeys.length} chave(s) cadastrada(s) no agendamento que NÃO foram bipadas na conferência física. Deseja confirmar a liberação mesmo assim?`
      );
      return;
    }

    const parsedInvoices = invoiceNumbersInput
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      await onConfirmRelease(appointment.id, {
        dockId: selectedDockId,
        nfeAccessKeys: enteredValidKeys,
        invoiceNumbers: parsedInvoices.length > 0 ? parsedInvoices : undefined,
        invoiceTotalValue: parsedTotalValue,
        invoiceDueDate: invoiceDueDate || undefined,
        notes: notes.trim() || undefined,
        preventionCheckedBy: operatorName.trim() || (currentSystemUser?.name || 'Prevenção de Perdas'),
        driverName: driverName.trim() || undefined,
        driverCpf: driverCpf.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() ? vehiclePlate.trim().toUpperCase() : undefined,
        vehicleType,
        carrierName: carrierName.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar liberação para descarga.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validKeyCount = enteredValidKeys.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-4">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Double Check de Prevenção & Liberação
                </h2>
                <span className="text-[10px] font-mono bg-purple-400/20 text-purple-200 px-2 py-0.5 rounded-md border border-purple-400/30">
                  {appointment.protocol}
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Conferência física e documental das NF-e para autorizar o acesso à doca de descarga.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo do Veículo & Fornecedor */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Fornecedor</span>
            <span className="font-bold text-slate-900 truncate block" title={appointment.supplierName}>
              {appointment.supplierName}
            </span>
            <span className="text-[10px] font-mono text-slate-500">{appointment.supplierCnpj}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Pedido de Compra (PO)</span>
            <span className="font-bold text-blue-700 font-mono truncate block">
              {appointment.purchaseOrders && appointment.purchaseOrders.length > 0 
                ? appointment.purchaseOrders.join(', ') 
                : appointment.purchaseOrder}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Veículo / Placa</span>
            <span className="font-bold text-slate-900 font-mono block">
              {vehiclePlate.trim() || appointment.vehiclePlate || 'NÃO INFORMADA'}
            </span>
            <span className="text-[10px] text-slate-500">{vehicleType || appointment.vehicleType}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Motorista</span>
            <span className="font-bold text-slate-900 truncate block">
              {driverName.trim() || appointment.driverName || 'Pendente de preenchimento'}
            </span>
            {(driverCpf.trim() || appointment.driverCpf) && (
              <span className="text-[10px] font-mono text-slate-500">{driverCpf.trim() || appointment.driverCpf}</span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Impede envio por Enter acidental (leitores de código de barras ou teclado)
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="p-5 space-y-4 max-h-[75vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <strong className="font-semibold block">Atenção na Liberação:</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {warningConfirm && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-2">
                <div>
                  <strong className="font-bold block text-amber-950">Aviso de Divergência no Double Check:</strong>
                  <span>{warningConfirm}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWarningConfirm(null)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 text-[11px] cursor-pointer"
                  >
                    Revisar Chaves
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWarningConfirm(null);
                      // Continua submissão
                      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                      handleSubmit(fakeEvent);
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-xs"
                  >
                    Confirmar Mesmo Assim
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Banner de Validação / Batimento Double Check */}
          {hadInitialKeys ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-slate-900">
                    Conferência das Chaves do Agendamento ({matchedOriginalKeys.length}/{originalKeys.length} Validadas)
                  </span>
                </div>
                {allScheduledKeysMatched ? (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Double Check 100% Batido
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    {missingOriginalKeys.length} chave(s) pendente(s) de leitura
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-600">
                Bipe as DANFEs físicas entregues pelo motorista abaixo. O sistema validará automaticamente se correspondem às chaves cadastradas no agendamento:
              </p>

              {/* Lista de batimento em tempo real */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {originalKeys.map((origKey, idx) => {
                  const isMatched = enteredValidKeys.includes(origKey);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                        isMatched
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isMatched ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 flex items-center justify-center text-[9px] font-bold text-slate-400">
                            {idx + 1}
                          </div>
                        )}
                        <span className="font-mono text-[11px] truncate select-all">
                          {formatNfeAccessKey(origKey)}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ml-2 ${
                          isMatched
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isMatched ? 'Validada (Bipada)' : 'Pendente de Leitura'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {extraEnteredKeys.length > 0 && (
                <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>
                    <strong>{extraEnteredKeys.length} nota(s) adicional(is)</strong> bipada(s) que não constavam no agendamento original.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <strong className="font-semibold block text-amber-900">
                  ⚠️ Agendamento sem chaves de acesso prévias vinculadas!
                </strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  A equipe de Prevenção de Perdas deve coletar e registrar obrigatoriamente as <strong>Chaves da NF-e (44 dígitos)</strong>, o <strong>Valor Total das Notas</strong> e a <strong>Validade do Boleto</strong> para autorizar a descarga.
                </p>
              </div>
            </div>
          )}

          {/* Seção 1: Chaves de Acesso da NF-e (44 dígitos com leitor de código de barras) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-purple-700" />
                <span>Leitura Física das Chaves de Acesso (44 dígitos)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-purple-900 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md">
                {validKeyCount} de {nfeAccessKeys.filter(k => k.trim()).length || 1} lida(s)
              </span>
            </div>

            <p className="text-[10px] text-slate-500">
              Bipe com leitor de código de barras ou digite. <strong className="text-purple-700">Novas linhas são criadas e focadas automaticamente</strong> ao atingir 44 dígitos.
            </p>

            <div className="space-y-2">
              {nfeAccessKeys.map((keyVal, idx) => {
                const cleanKey = cleanNfeAccessKey(keyVal);
                const isComplete = cleanKey.length === 44;
                const isMatchedWithScheduled = hadInitialKeys && originalKeys.includes(cleanKey);

                return (
                  <div key={idx} className="relative flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                        #{idx + 1}
                      </span>
                      <input
                        ref={el => { nfeInputRefs.current[idx] = el; }}
                        type="text"
                        maxLength={54}
                        placeholder="Bipe ou digite a chave de 44 dígitos da DANFE..."
                        value={formatNfeAccessKey(keyVal)}
                        onChange={e => handleNfeKeyChange(idx, e.target.value)}
                        onKeyDown={e => handleNfeKeyDown(e, idx)}
                        className={`w-full pl-8 pr-20 py-1.5 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${
                          isComplete
                            ? isMatchedWithScheduled
                              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-semibold'
                              : hadInitialKeys
                              ? 'border-purple-400 bg-purple-50/40 text-purple-950 font-semibold'
                              : 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-semibold'
                            : cleanKey.length > 0
                            ? 'border-amber-300 bg-amber-50/30 text-amber-900'
                            : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className={`text-[10px] font-mono px-1 rounded ${isComplete ? 'text-emerald-700 font-bold bg-emerald-100' : 'text-slate-400'}`}>
                          {cleanKey.length}/44
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePasteNfeKey(idx)}
                          className="text-[10px] text-purple-600 hover:text-purple-800 font-bold bg-purple-50 hover:bg-purple-100 px-1 py-0.5 rounded cursor-pointer transition-colors"
                          title="Colar da área de transferência"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {nfeAccessKeys.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNfeKey(idx)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remover chave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção 2: Valor Total das Notas & Validade do Boleto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Valor Total das Notas Fiscais */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Valor Total das Notas (R$)</span>
                {!hadInitialKeys && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  R$
                </span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={invoiceTotalValueInput}
                  onChange={e => {
                    const cleanVal = e.target.value.replace(/\D/g, '');
                    if (!cleanVal) {
                      setInvoiceTotalValueInput('');
                      return;
                    }
                    const num = parseInt(cleanVal, 10) / 100;
                    setInvoiceTotalValueInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Soma total do valor fiscal constante nas DANFEs.
              </span>
            </div>

            {/* Validade / Vencimento do Boleto */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Validade / Vencimento do Boleto</span>
                {!hadInitialKeys && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="date"
                value={invoiceDueDate}
                onChange={e => setInvoiceDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block">
                Data limite para conferência e liquidação financeira.
              </span>
            </div>
          </div>

          {/* Seção 3: Identificação do Motorista & Veículo (Conferência / Registro de Acesso) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-purple-700" />
                <span>Dados do Motorista & Veículo</span>
              </label>
              {!appointment.driverName && !appointment.driverCpf ? (
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  Não informados na solicitação inicial
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
                  Conferir ou atualizar
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Nome do Motorista */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>Nome do Motorista</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Alberto da Silva"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* CPF do Motorista */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  CPF do Motorista
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={driverCpf}
                  onChange={e => setDriverCpf(formatCpf(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Telefone / WhatsApp */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>Telefone / WhatsApp</span>
                </label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  value={driverPhone}
                  onChange={e => setDriverPhone(formatPhone(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Placa do Veículo */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Placa do Veículo
                </label>
                <input
                  type="text"
                  placeholder="ABC-1234 ou ABC1D23"
                  maxLength={8}
                  value={vehiclePlate}
                  onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Tipo de Veículo */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tipo de Veículo
                </label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="CARRETA">Carreta (Pesada)</option>
                  <option value="TRUCK_34">Truck 3/4</option>
                  <option value="TOCO">Toco</option>
                  <option value="VUC">VUC / Urbano</option>
                  <option value="VAN">Van / Furgão</option>
                </select>
              </div>

              {/* Transportadora */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Transportadora (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Nome da Transportadora"
                  value={carrierName}
                  onChange={e => setCarrierName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Doca de Destino & Números de NFs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Doca de Descarga */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Doca de Descarga</span>
              </label>
              <select
                value={selectedDockId}
                onChange={e => setSelectedDockId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {docks.map((dock, dIdx) => (
                  <option key={`double-check-dock-${dock.id || ''}-${dIdx}`} value={dock.id} disabled={!dock.isOperational}>
                    {dock.name} ({dock.type}) {!dock.isOperational ? '- Inoperante' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Números das Notas Fiscais (opcional / conferência) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Número(s) das NF-e</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 10450, 10451"
                value={invoiceNumbersInput}
                onChange={e => setInvoiceNumbersInput(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Seção 5: Operador da Prevenção & Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-700" />
                <span>Operador Responsável (Prevenção)</span>
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                placeholder="Nome / Matrícula do Operador"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Observações da Liberação (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Lacre conferido nº 98412, sem avarias externas"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || validKeyCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Liberando...' : 'Confirmar Double Check & Liberar Descarga'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
