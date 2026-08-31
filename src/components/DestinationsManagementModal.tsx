import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  Mail,
  ShieldAlert,
  Search,
  Check,
  X,
  Sparkles,
  Info,
  Navigation,
  FileText
} from 'lucide-react';
import { DestinationBranch } from '../types';

interface DestinationsManagementModalProps {
  isOpen?: boolean;
  destinations: DestinationBranch[];
  onSave?: (newDestinations: DestinationBranch[]) => Promise<void> | void;
  onSaveDestinations?: (newDestinations: DestinationBranch[]) => Promise<void> | void;
  onClose: () => void;
}

export const DestinationsManagementModal: React.FC<DestinationsManagementModalProps> = ({
  isOpen = true,
  destinations,
  onSave,
  onSaveDestinations,
  onClose,
}) => {
  const [list, setList] = useState<DestinationBranch[]>(destinations);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBranch, setEditingBranch] = useState<DestinationBranch | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (Array.isArray(destinations)) {
      setList(destinations);
    }
  }, [destinations]);

  const handleSaveCallback = (updatedList: DestinationBranch[]) => {
    if (typeof onSave === 'function') {
      onSave(updatedList);
    } else if (typeof onSaveDestinations === 'function') {
      onSaveDestinations(updatedList);
    }
  };

  // Form State
  const [formData, setFormData] = useState<Partial<DestinationBranch>>({
    name: '',
    code: '',
    cnpj: '',
    address: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    zipCode: '',
    contactPhone: '',
    contactEmail: '',
    receptionInstructions: '',
    active: true,
    isDefault: false,
  });

  const [formError, setFormError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: `FILIAL-0${list.length + 1}`,
      cnpj: '',
      address: '',
      neighborhood: '',
      city: '',
      state: 'SP',
      zipCode: '',
      contactPhone: '',
      contactEmail: '',
      receptionInstructions: 'Apresentar DANFE e documento com foto do motorista na guarita principal. Uso obrigatório de EPIs.',
      active: true,
      isDefault: list.length === 0,
    });
    setFormError(null);
    setIsCreatingNew(true);
  };

  const startEdit = (branch: DestinationBranch) => {
    setIsCreatingNew(false);
    setEditingBranch(branch);
    setFormData({ ...branch });
    setFormError(null);
  };

  const cancelForm = () => {
    setIsCreatingNew(false);
    setEditingBranch(null);
    setFormError(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setFormError('Por favor, informe o nome da unidade ou filial.');
      return;
    }

    let updatedList: DestinationBranch[] = [];

    if (isCreatingNew) {
      const newBranch: DestinationBranch = {
        id: `DEST-${Date.now()}`,
        name: formData.name.trim(),
        code: formData.code?.trim() || `FILIAL-0${list.length + 1}`,
        cnpj: formData.cnpj?.trim() || '',
        address: formData.address?.trim() || '',
        neighborhood: formData.neighborhood?.trim() || '',
        city: formData.city?.trim() || '',
        state: formData.state?.trim() || 'SP',
        zipCode: formData.zipCode?.trim() || '',
        contactPhone: formData.contactPhone?.trim() || '',
        contactEmail: formData.contactEmail?.trim() || '',
        receptionInstructions: formData.receptionInstructions?.trim() || '',
        active: formData.active ?? true,
        isDefault: Boolean(formData.isDefault),
        docks: [
          { id: 'DOCA-01', name: 'Doca 01 (Paletizada)', type: 'PALETIZADA', capacityPerSlot: 2, isOperational: true, dailyLimit: 140, limitUnit: 'pallets' },
          { id: 'DOCA-02', name: 'Doca 02 (Refrigerada)', type: 'REFRIGERADA', capacityPerSlot: 1, isOperational: true, dailyLimit: 40, limitUnit: 'pallets' },
          { id: 'DOCA-03', name: 'Doca 03 (Batidos/Fracionados)', type: 'BATIDA', capacityPerSlot: 2, isOperational: true, dailyLimit: 200, limitUnit: 'volumes' },
          { id: 'DOCA-04', name: 'Doca 04 (Express/VUCs)', type: 'FRACIONADA', capacityPerSlot: 3, isOperational: true, dailyLimit: 50, limitUnit: 'volumes' },
        ],
        timeSlots: [
          '07:00 - 08:30',
          '08:30 - 10:00',
          '10:00 - 11:30',
          '13:00 - 14:30',
          '14:30 - 16:00',
          '16:00 - 17:30',
        ],
        slotSupplierLimits: {
          '07:00 - 08:30': 3,
          '08:30 - 10:00': 3,
          '10:00 - 11:30': 3,
          '13:00 - 14:30': 3,
          '14:30 - 16:00': 3,
          '16:00 - 17:30': 3,
        },
        dailyPalletLimit: 200,
        dailyVolumeLimit: 500,
      };

      if (newBranch.isDefault) {
        updatedList = list.map(b => ({ ...b, isDefault: false }));
        updatedList.push(newBranch);
      } else {
        updatedList = [...list, newBranch];
      }
    } else if (editingBranch) {
      updatedList = list.map(b => {
        if (b.id === editingBranch.id) {
          return {
            ...b,
            name: formData.name!.trim(),
            code: formData.code?.trim() || b.code,
            cnpj: formData.cnpj?.trim() || '',
            address: formData.address?.trim() || '',
            neighborhood: formData.neighborhood?.trim() || '',
            city: formData.city?.trim() || '',
            state: formData.state?.trim() || 'SP',
            zipCode: formData.zipCode?.trim() || '',
            contactPhone: formData.contactPhone?.trim() || '',
            contactEmail: formData.contactEmail?.trim() || '',
            receptionInstructions: formData.receptionInstructions?.trim() || '',
            active: formData.active ?? b.active,
            isDefault: Boolean(formData.isDefault),
          };
        }
        if (formData.isDefault) {
          return { ...b, isDefault: false };
        }
        return b;
      });
    }

    // Ensure at least one default
    const hasDefault = updatedList.some(b => b.isDefault && b.active);
    if (!hasDefault && updatedList.length > 0) {
      updatedList[0].isDefault = true;
    }

    setList(updatedList);
    handleSaveCallback(updatedList);
    setIsCreatingNew(false);
    setEditingBranch(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleActive = (id: string) => {
    const updated = list.map(b => {
      if (b.id === id) {
        const nextActive = !b.active;
        return { ...b, active: nextActive, isDefault: nextActive ? b.isDefault : false };
      }
      return b;
    });

    // If default was deactivated, elect new default
    const hasActiveDefault = updated.some(b => b.isDefault && b.active);
    if (!hasActiveDefault) {
      const firstActive = updated.find(b => b.active);
      if (firstActive) firstActive.isDefault = true;
    }

    setList(updated);
    handleSaveCallback(updated);
  };

  const handleSetDefault = (id: string) => {
    const updated = list.map(b => ({
      ...b,
      isDefault: b.id === id,
      active: b.id === id ? true : b.active, // automatically activate if set as default
    }));
    setList(updated);
    handleSaveCallback(updated);
  };

  const handleDelete = (id: string) => {
    const target = list.find(b => b.id === id);
    if (window.confirm(`Deseja realmente excluir a filial "${target?.name}"?`)) {
      let updated = list.filter(b => b.id !== id);
      if (target?.isDefault && updated.length > 0) {
        updated[0].isDefault = true;
      }
      setList(updated);
      handleSaveCallback(updated);
    }
  };

  const filteredList = list.filter(b => {
    const q = searchTerm.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.code && b.code.toLowerCase().includes(q)) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.state && b.state.toLowerCase().includes(q)) ||
      (b.cnpj && b.cnpj.includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <MapPin className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Destinos de Entrega & Filiais
                </h2>
                <span className="bg-indigo-900/80 text-indigo-200 border border-indigo-700/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Multi-Unidades
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configure os locais de descarga, filiais, centros de distribuição e matriz para agendamentos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Notification feedback */}
          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Alterações salvas e sincronizadas com sucesso com o servidor!</span>
            </div>
          )}

          {/* Form Modal / Section if creating or editing */}
          {(isCreatingNew || editingBranch) ? (
            <div className="bg-slate-50 border border-indigo-200 rounded-2xl p-5 shadow-sm animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>{isCreatingNew ? 'Nova Filial / Centro de Distribuição' : `Editar Unidade: ${editingBranch?.name}`}</span>
                </div>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>

              {formError && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome da Unidade / Filial <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Matriz - CD Central ou Filial Sul - Curitiba"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código da Unidade
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: CD-01, FILIAL-02"
                      value={formData.code || ''}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 uppercase font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNPJ da Filial
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj || ''}
                      onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telefone / Ramal da Portaria
                    </label>
                    <input
                      type="text"
                      placeholder="(11) 4002-8922"
                      value={formData.contactPhone || ''}
                      onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-mail de Contato / Expedição
                    </label>
                    <input
                      type="email"
                      placeholder="portaria.cd@empresa.com.br"
                      value={formData.contactEmail || ''}
                      onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Endereço Completo (Logradouro e Número)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Av. das Indústrias, 1500 - Galpão B"
                      value={formData.address || ''}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      placeholder="Distrito Industrial"
                      value={formData.neighborhood || ''}
                      onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      placeholder="São Paulo"
                      value={formData.city || ''}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estado (UF)
                    </label>
                    <input
                      type="text"
                      placeholder="SP, RJ, PR..."
                      maxLength={2}
                      value={formData.state || ''}
                      onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 uppercase font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={formData.zipCode || ''}
                      onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Instruções Especiais de Recebimento & Acesso
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Instruções para o motorista ao chegar na unidade (ex: portaria exclusiva para pesados, crachá, EPIs obrigatórios)..."
                    value={formData.receptionInstructions || ''}
                    onChange={e => setFormData({ ...formData, receptionInstructions: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active ?? true}
                      onChange={e => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Unidade Ativa (Disponível para agendamento)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault ?? false}
                      onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Definir como Unidade Padrão (Pré-selecionada no agendamento)
                    </span>
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isCreatingNew ? 'Cadastrar Destino' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Search & Add Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome da filial, cidade, código ou CNPJ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {!isCreatingNew && !editingBranch && (
              <button
                onClick={startCreate}
                className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Nova Filial</span>
              </button>
            )}
          </div>

          {/* Branches Cards List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
              <span>Unidades Cadastradas ({filteredList.length})</span>
              <span>Status & Ações</span>
            </div>

            {filteredList.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2">
                <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma unidade encontrada</p>
                <p className="text-xs text-slate-500">Clique em "Adicionar Nova Filial" para cadastrar uma nova unidade de destino.</p>
              </div>
            ) : (
              filteredList.map((branch, bIdx) => (
                <div
                  key={`dest-card-${branch.id || ''}-${bIdx}`}
                  className={`bg-white border rounded-2xl p-4 transition-all shadow-xs hover:shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    branch.isDefault
                      ? 'border-indigo-300 bg-indigo-50/20 ring-1 ring-indigo-200'
                      : branch.active
                      ? 'border-slate-200 hover:border-slate-300'
                      : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  {/* Left info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {branch.name}
                      </span>
                      {branch.code && (
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-md">
                          {branch.code}
                        </span>
                      )}
                      {branch.isDefault && (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Unidade Padrão
                        </span>
                      )}
                      {branch.active ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <XCircle className="w-3 h-3" /> Inativa
                        </span>
                      )}
                    </div>

                    {/* Address & City */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-wrap">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>
                        {branch.address ? branch.address : 'Endereço não cadastrado'}
                        {branch.city ? ` - ${branch.city}/${branch.state || ''}` : ''}
                        {branch.zipCode ? ` (CEP: ${branch.zipCode})` : ''}
                      </span>
                    </div>

                    {/* CNPJ & Contacts */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      {branch.cnpj && (
                        <span className="font-mono">CNPJ: <strong>{branch.cnpj}</strong></span>
                      )}
                      {branch.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> {branch.contactPhone}
                        </span>
                      )}
                      {branch.contactEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" /> {branch.contactEmail}
                        </span>
                      )}
                    </div>

                    {branch.receptionInstructions && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-1">
                        Instruções: "{branch.receptionInstructions}"
                      </p>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                    {!branch.isDefault && branch.active && (
                      <button
                        onClick={() => handleSetDefault(branch.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                        title="Tornar esta filial a padrão para novos agendamentos"
                      >
                        Tornar Padrão
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleActive(branch.id)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        branch.active
                          ? 'text-slate-600 bg-white hover:bg-slate-100 border-slate-300'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                      }`}
                      title={branch.active ? 'Desativar filial temporariamente' : 'Ativar filial para agendamentos'}
                    >
                      {branch.active ? 'Desativar' : 'Ativar'}
                    </button>

                    <button
                      onClick={() => startEdit(branch)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="Editar dados da filial"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(branch.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="Excluir filial"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Informational helper banner */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Como funcionam as Filiais no Agendamento:</span>
              <p className="text-indigo-900/80 leading-relaxed">
                Ao cadastrar novas filiais ou centros de distribuição, o formulário de agendamento de fornecedores exibirá um seletor permitindo ao transportador ou fornecedor escolher em qual unidade a carga será entregue. O comprovante de agendamento e o rastreamento exibirão o endereço e orientações da filial escolhida.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100/80 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Total de unidades: <strong>{list.length}</strong> (Ativas: <strong>{list.filter(b => b.active).length}</strong>)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
