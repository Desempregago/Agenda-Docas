import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Truck, FileText, CheckCircle2, AlertTriangle, Zap, MapPin, KeyRound, Plus, Trash2, DollarSign, User, Building2, Sparkles, Loader2 } from 'lucide-react';
import { Appointment, Dock, DestinationBranch } from '../types';
import { formatCpf, formatCnpj, parseCurrencyInput, cleanNfeAccessKey, extractNfeKeysFromText } from '../utils/formatters';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAppt: Appointment) => void;
  docks?: Dock[];
  destinations?: DestinationBranch[];
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  destinations = [],
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const activeDestinations = destinations.filter(d => d.active);
  const defaultDestination = activeDestinations.find(d => d.isDefault) || activeDestinations[0];

  const [formData, setFormData] = useState({
    destinationBranchId: defaultDestination?.id || '',
    purchaseOrder: '',
    invoiceNumber: '',
    invoiceDueDate: '',
    invoiceSeries: '1',
    invoiceTotalValue: '' as string | number,
    supplierName: '',
    supplierCnpj: '',
    carrierName: '',
    driverName: '',
    driverCpf: '',
    driverPhone: '',
    vehiclePlate: '',
    vehicleType: 'TRUCK_34' as const,
    cargoType: 'PALETIZADA' as const,
    weightKg: 2000,
    totalVolumes: 15,
    notes: 'REGISTRO DE PORTARIA - ENCAIXE DE VEÍCULO NÃO AGENDADO',
  });

  const [nfeAccessKeys, setNfeAccessKeys] = useState<string[]>(['']);
  const nfeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Estados para validação automática de CNPJ contra o banco de fornecedores (suppliers.json)
  const [isSearchingSupplier, setIsSearchingSupplier] = useState<boolean>(false);
  const [isSupplierRecognized, setIsSupplierRecognized] = useState<boolean>(false);
  const [recognizedSupplier, setRecognizedSupplier] = useState<{ name: string; tradeName?: string; appointmentCount?: number } | null>(null);

  // Consulta CNPJ no banco de fornecedores em tempo real (como no login)
  useEffect(() => {
    const cleanDigits = formData.supplierCnpj.replace(/\D/g, '');
    if (cleanDigits.length >= 11) {
      let isMounted = true;
      setIsSearchingSupplier(true);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suppliers/lookup/${cleanDigits}`);
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.found && data.supplier) {
              setFormData(prev => ({
                ...prev,
                supplierName: data.supplier.name || data.supplier.tradeName || prev.supplierName,
              }));
              setIsSupplierRecognized(true);
              setRecognizedSupplier(data.supplier);
            } else if (isMounted) {
              setIsSupplierRecognized(false);
              setRecognizedSupplier(null);
            }
          } else if (isMounted) {
            setIsSupplierRecognized(false);
            setRecognizedSupplier(null);
          }
        } catch (_) {
          if (isMounted) {
            setIsSupplierRecognized(false);
            setRecognizedSupplier(null);
          }
        } finally {
          if (isMounted) setIsSearchingSupplier(false);
        }
      }, 250);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setIsSupplierRecognized(false);
      setIsSearchingSupplier(false);
      setRecognizedSupplier(null);
    }
  }, [formData.supplierCnpj]);

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
      // Ao atingir 44 dígitos, cria a próxima (se for a última) e desce o cursor imediatamente
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

  useEffect(() => {
    if (!formData.destinationBranchId && defaultDestination) {
      setFormData(prev => ({ ...prev, destinationBranchId: defaultDestination.id }));
    }
  }, [defaultDestination, formData.destinationBranchId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.invoiceNumber.trim()) {
      setError('Informe o número da Nota Fiscal (NF).');
      return;
    }
    if (!formData.supplierName.trim()) {
      setError('Informe o nome/razão social do fornecedor.');
      return;
    }

    setLoading(true);

    try {
      const validNfeKeys = nfeAccessKeys.map(k => cleanNfeAccessKey(k)).filter(Boolean);
      const parsedVal = typeof formData.invoiceTotalValue === 'string'
        ? parseCurrencyInput(formData.invoiceTotalValue)
        : formData.invoiceTotalValue;

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          invoiceTotalValue: parsedVal > 0 ? parsedVal : undefined,
          nfeAccessKeys: validNfeKeys,
          nfeAccessKey: validNfeKeys[0] || undefined,
          scheduledDate: todayStr,
          timeSlot: 'ENCAIXE IMEDIATO (PORTARIA)',
          isWalkIn: true,
          status: 'NO_PATIO', // Coloca direto no Pátio/Portaria
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao registrar encaixe na portaria.');
      }

      const created: Appointment = await res.json();
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar veículo não agendado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/30 border border-amber-300/40 rounded-xl text-amber-200">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Encaixe de Emergência / Veículo Não Agendado
              </h2>
              <p className="text-xs text-amber-100">
                Registro rápido na guarita para liberação imediata no pátio e docas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Impede o envio acidental por RETURN/Enter (leitores de código de barras ou teclado)
            if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              Esta ação cria um protocolo de emergência do tipo <strong>"Encaixe Portaria"</strong> com status <strong>"Na Portaria / Pátio"</strong>. O veículo entra na fila do pátio e a alocação da doca será feita pela operação de recebimento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeDestinations.length > 1 && (
              <div className="sm:col-span-2 bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                  Unidade / Filial de Entrada:
                </label>
                <select
                  value={formData.destinationBranchId}
                  onChange={e => setFormData({ ...formData, destinationBranchId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white border border-amber-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {activeDestinations.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.code ? `(${branch.code})` : ''} {branch.city ? `- ${branch.city}/${branch.state || ''}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Pedido(s) de Compra (PO / Ordem de Fornecimento)
                </label>
                {formData.purchaseOrder && formData.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length > 1 && (
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    🏷️ {formData.purchaseOrder.split(/[,;\n\/]+/).filter(Boolean).length} Pedidos identificados
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ex: PC-8841, PO-94821 (separe por vírgula se houver mais de um)"
                value={formData.purchaseOrder}
                onChange={e => setFormData({ ...formData, purchaseOrder: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Nº(s) das Notas Fiscais (NFs) <span className="text-rose-500">*</span>
                </label>
                {formData.invoiceNumber.split(/[,;\n\/]+/).filter(Boolean).length > 1 && (
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                    📦 {formData.invoiceNumber.split(/[,;\n\/]+/).filter(Boolean).length} NFs identificadas
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                placeholder="Ex: 90214, 90215, 90216 (separe por vírgula se houver mais de uma NF)"
                value={formData.invoiceNumber}
                onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                💡 Se o motorista trouxer mais de uma nota na mesma carga, digite os números separados por vírgula.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Valor Total das NFs (R$)</span>
                <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 12500,00"
                value={formData.invoiceTotalValue}
                onChange={e => setFormData({ ...formData, invoiceTotalValue: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-emerald-800 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data de Validade / Vencimento do Boleto <span className="text-amber-700 font-normal">(Opcional)</span>
              </label>
              <input
                type="date"
                value={formData.invoiceDueDate}
                onChange={e => setFormData({ ...formData, invoiceDueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-slate-800"
              />
            </div>

            {/* Chaves de Acesso da NF-e (44 dígitos) */}
            <div className="sm:col-span-2 bg-amber-50/50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>Chaves de Acesso da NF-e (44 dígitos)</span>
                </label>
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded-md">
                  {nfeAccessKeys.filter(k => cleanNfeAccessKey(k).length === 44).length} de {nfeAccessKeys.length} preenchida(s)
                </span>
              </div>

              <p className="text-[10px] text-amber-900/80">
                Cole ou leia com leitor de código de barras (44 dígitos). <strong className="text-amber-950">Novas linhas são criadas e focadas automaticamente</strong>.
              </p>

              <div className="space-y-1.5">
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
                          className={`w-full pl-8 pr-16 py-1.5 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none ${
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
                        className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-white bg-slate-200/60 rounded-md border border-slate-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Placa do Veículo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="ABC-1E23"
                value={formData.vehiclePlate}
                onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 uppercase font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>CNPJ do Fornecedor</span>
                </label>
                {isSearchingSupplier && (
                  <span className="text-[10px] text-amber-700 flex items-center gap-1 animate-pulse font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando base...
                  </span>
                )}
                {!isSearchingSupplier && isSupplierRecognized && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cadastrado
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  value={formData.supplierCnpj}
                  onChange={e => setFormData({ ...formData, supplierCnpj: formatCnpj(e.target.value) })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-amber-500 font-mono transition-colors ${
                    isSupplierRecognized
                      ? 'border-emerald-400 bg-emerald-50/30 text-slate-900 font-semibold'
                      : 'border-slate-300 bg-white text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Razão Social / Fornecedor</span>
                  <span className="text-rose-500">*</span>
                </label>
                {isSupplierRecognized && (
                  <span className="text-[10px] text-emerald-700 flex items-center gap-0.5 font-medium">
                    <Sparkles className="w-3 h-3 text-emerald-600" /> Auto-preenchido
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex: Fornecedor Avulso Ltda"
                  value={formData.supplierName}
                  onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-amber-500 transition-colors ${
                    isSupplierRecognized
                      ? 'border-emerald-400 bg-emerald-50/30 text-emerald-950 font-semibold pl-3 pr-8'
                      : 'border-slate-300 bg-white text-slate-900'
                  }`}
                />
                {isSupplierRecognized && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
              {isSupplierRecognized && recognizedSupplier?.appointmentCount !== undefined && (
                <p className="text-[10px] text-emerald-700 mt-1">
                  ✨ Fornecedor recorrente ({recognizedSupplier.appointmentCount} agendamento(s) no histórico)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transportadora</label>
              <input
                type="text"
                placeholder="Ex: Frota Própria / Terceiro"
                value={formData.carrierName}
                onChange={e => setFormData({ ...formData, carrierName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Veículo</label>
              <select
                value={formData.vehicleType}
                onChange={e => setFormData({ ...formData, vehicleType: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="TRUCK_34">Truck 3/4</option>
                <option value="CARRETA">Carreta / Baú</option>
                <option value="TOCO">Toco</option>
                <option value="VUC">VUC (Urbano)</option>
                <option value="VAN">Van / Utilitário</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Carga</label>
              <select
                value={formData.cargoType}
                onChange={e => setFormData({ ...formData, cargoType: e.target.value as any })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="PALETIZADA">Paletizada (PBR)</option>
                <option value="BATIDA">Carga Batida</option>
                <option value="FRACIONADA">Fracionada / Express</option>
                <option value="REFRIGERADA">Refrigerada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Motorista</label>
              <input
                type="text"
                placeholder="Ex: Carlos Silva"
                value={formData.driverName}
                onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-700" />
                <span>CPF do Motorista</span>
              </label>
              <input
                type="text"
                placeholder="000.000.000-00"
                maxLength={14}
                value={formData.driverCpf}
                onChange={e => setFormData({ ...formData, driverCpf: formatCpf(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telefone do Motorista</label>
              <input
                type="text"
                placeholder="(11) 99999-0000"
                value={formData.driverPhone}
                onChange={e => setFormData({ ...formData, driverPhone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-2"
            >
              {loading ? 'Registrando...' : '⚡ Confirmar Encaixe na Portaria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
