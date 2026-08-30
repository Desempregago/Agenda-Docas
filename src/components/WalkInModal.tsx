import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Truck, FileText, CheckCircle2, AlertTriangle, Zap, MapPin } from 'lucide-react';
import { Appointment, Dock, DestinationBranch } from '../types';

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
    supplierName: '',
    supplierCnpj: '',
    carrierName: '',
    driverName: '',
    driverPhone: '',
    vehiclePlate: '',
    vehicleType: 'TRUCK_34' as const,
    cargoType: 'PALETIZADA' as const,
    weightKg: 2000,
    totalVolumes: 15,
    notes: 'REGISTRO DE PORTARIA - ENCAIXE DE VEÍCULO NÃO AGENDADO',
  });

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
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Razão Social / Fornecedor <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Fornecedor Avulso Ltda"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motorista</label>
              <input
                type="text"
                placeholder="Nome do motorista"
                value={formData.driverName}
                onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
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
