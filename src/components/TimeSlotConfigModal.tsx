import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Info,
  Sliders,
  Check,
  Users,
  MapPin,
  Copy,
  ArrowRightLeft,
} from 'lucide-react';
import { Dock, DestinationBranch } from '../types';

interface TimeSlotConfigModalProps {
  isOpen: boolean;
  docks: Dock[];
  timeSlots: string[];
  slotLimits?: Record<string, number>;
  destinations?: DestinationBranch[];
  onClose: () => void;
  onSaveSlots: (newSlots: string[]) => void;
  onSaveSlotLimits?: (newLimits: Record<string, number>) => void;
  onSaveDocks: (updatedDocks: Dock[]) => void;
  onSaveDestinations?: (newDestinations: DestinationBranch[]) => void;
}

const DEFAULT_FALLBACK_DOCKS: Dock[] = [];

const DEFAULT_FALLBACK_SLOTS: string[] = [];

const DEFAULT_FALLBACK_LIMITS: Record<string, number> = {};

export const TimeSlotConfigModal: React.FC<TimeSlotConfigModalProps> = ({
  isOpen,
  docks,
  timeSlots,
  slotLimits = {},
  destinations = [],
  onClose,
  onSaveSlots,
  onSaveSlotLimits,
  onSaveDocks,
  onSaveDestinations,
}) => {
  const [activeTab, setActiveTab] = useState<'docks' | 'slots'>('docks');

  // Sanitize destinations so every branch is guaranteed to have docks and slots
  const sanitizeBranches = (branches: DestinationBranch[]): DestinationBranch[] => {
    if (!branches || branches.length === 0) {
      return [
        {
          id: 'DEST-01',
          name: 'Unidade Principal',
          code: 'CD-01',
          active: true,
          isDefault: true,
          docks: docks.length > 0 ? docks.map(d => ({ ...d })) : [],
          timeSlots: timeSlots.length > 0 ? [...timeSlots] : [],
          slotSupplierLimits: Object.keys(slotLimits).length > 0 ? { ...slotLimits } : {},
        },
      ];
    }
    return branches.map(b => ({
      ...b,
      docks: b.docks ? b.docks.map(d => ({ ...d })) : [],
      timeSlots: b.timeSlots ? [...b.timeSlots] : [],
      slotSupplierLimits: b.slotSupplierLimits ? { ...b.slotSupplierLimits } : {},
    }));
  };

  const [destinationsList, setDestinationsList] = useState<DestinationBranch[]>(() => sanitizeBranches(destinations));
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // New slot input state
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotLimit, setNewSlotLimit] = useState(3);
  const [bulkLimit, setBulkLimit] = useState<number>(3);

  // New dock input state
  const [newDockName, setNewDockName] = useState('');
  const [newDockType, setNewDockType] = useState('PALETIZADA');
  const [newDockCapacity, setNewDockCapacity] = useState(2);
  const [newDockDailyLimit, setNewDockDailyLimit] = useState(140);
  const [newDockLimitUnit, setNewDockLimitUnit] = useState<'pallets' | 'volumes'>('pallets');

  // Copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceBranchId, setCopySourceBranchId] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize or re-sync when opened
  useEffect(() => {
    if (isOpen) {
      const sanitized = sanitizeBranches(destinations);
      setDestinationsList(sanitized);
      const defaultBranch = sanitized.find(b => b.isDefault) || sanitized[0];
      if (defaultBranch) {
        setSelectedBranchId(defaultBranch.id);
      }
      setSavedSuccess(false);
      setShowCopyModal(false);
    }
  }, [isOpen, destinations]);

  if (!isOpen) return null;

  const currentBranch = destinationsList.find(b => b.id === selectedBranchId) || destinationsList[0];
  const activeDockList = currentBranch?.docks || [];
  const activeSlotsList = currentBranch?.timeSlots || [];
  const activeSlotLimitsMap = currentBranch?.slotSupplierLimits || {};

  const handleTypeChange = (type: string) => {
    setNewDockType(type);
    if (type === 'BATIDA' || type === 'FRACIONADA') {
      setNewDockLimitUnit('volumes');
      setNewDockDailyLimit(type === 'BATIDA' ? 200 : 50);
    } else {
      setNewDockLimitUnit('pallets');
      setNewDockDailyLimit(type === 'REFRIGERADA' ? 40 : 140);
    }
  };

  // Add slot to current branch
  const handleAddSlot = () => {
    if (!newSlotTime.trim() || !currentBranch) return;
    const trimmed = newSlotTime.trim();
    if (activeSlotsList.includes(trimmed)) {
      alert(`A janela "${trimmed}" já está cadastrada nesta filial.`);
      return;
    }
    const updatedSlots = [...activeSlotsList, trimmed].sort();
    const updatedLimits = {
      ...activeSlotLimitsMap,
      [trimmed]: Number(newSlotLimit) > 0 ? Number(newSlotLimit) : 3,
    };

    setDestinationsList(prev =>
      prev.map(b => (b.id === currentBranch.id ? { ...b, timeSlots: updatedSlots, slotSupplierLimits: updatedLimits } : b))
    );
    setNewSlotTime('');
    setNewSlotLimit(3);
  };

  // Update slot limit for current branch
  const handleUpdateSlotLimit = (slot: string, limitVal: number) => {
    if (!currentBranch) return;
    const safeLimit = Math.max(1, Math.min(100, Number(limitVal) || 1));
    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          return {
            ...b,
            slotSupplierLimits: {
              ...(b.slotSupplierLimits || {}),
              [slot]: safeLimit,
            },
          };
        }
        return b;
      })
    );
  };

  // Remove slot from current branch
  const handleRemoveSlot = (slotToRemove: string) => {
    if (!currentBranch) return;
    if (activeSlotsList.length <= 1) {
      alert('É necessário manter ao menos 1 janela de horário ativa para receber agendamentos.');
      return;
    }

    if (window.confirm(`Deseja remover a janela "${slotToRemove}" da filial "${currentBranch.name}"?`)) {
      setDestinationsList(prev =>
        prev.map(b => {
          if (b.id === currentBranch.id) {
            const nextSlots = (b.timeSlots || []).filter(s => s !== slotToRemove);
            const nextLimits = { ...(b.slotSupplierLimits || {}) };
            delete nextLimits[slotToRemove];
            return { ...b, timeSlots: nextSlots, slotSupplierLimits: nextLimits };
          }
          return b;
        })
      );
    }
  };

  // Apply bulk limit to all slots of current branch
  const handleApplyBulkLimit = () => {
    if (!currentBranch) return;
    const safe = Math.max(1, Math.min(100, Number(bulkLimit) || 1));
    const updated: Record<string, number> = {};
    activeSlotsList.forEach(s => {
      updated[s] = safe;
    });
    setDestinationsList(prev =>
      prev.map(b => (b.id === currentBranch.id ? { ...b, slotSupplierLimits: updated } : b))
    );
  };

  // Add dock to current branch
  const handleAddDock = () => {
    if (!newDockName.trim() || !currentBranch) return;

    const newDock: Dock = {
      id: `DOCA-${Date.now().toString().slice(-4)}`,
      name: newDockName.trim(),
      type: newDockType,
      capacityPerSlot: Number(newDockCapacity) || 1,
      isOperational: true,
      dailyLimit: Number(newDockDailyLimit) > 0 ? Number(newDockDailyLimit) : 100,
      limitUnit: newDockLimitUnit,
    };

    setDestinationsList(prev =>
      prev.map(b => (b.id === currentBranch.id ? { ...b, docks: [...(b.docks || []), newDock] } : b))
    );
    setNewDockName('');
    setNewDockDailyLimit(140);
    setNewDockLimitUnit('pallets');
    setNewDockCapacity(2);
  };

  // Remove dock from current branch
  const handleRemoveDock = (dockId: string) => {
    if (!currentBranch) return;
    const dockName = activeDockList.find(d => d.id === dockId)?.name || dockId;
    if (activeDockList.length <= 1) {
      alert('É necessário manter pelo menos uma doca cadastrada nesta filial.');
      return;
    }

    if (window.confirm(`Deseja realmente excluir a "${dockName}" (${dockId}) da filial "${currentBranch.name}"?`)) {
      setDestinationsList(prev =>
        prev.map(b => {
          if (b.id === currentBranch.id) {
            const nextDocks = (b.docks || []).filter(d => d.id !== dockId);
            return { ...b, docks: nextDocks };
          }
          return b;
        })
      );
    }
  };

  // Update dock field in current branch
  const handleUpdateDockField = <K extends keyof Dock>(dockId: string, field: K, value: Dock[K]) => {
    if (!currentBranch) return;
    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          const updatedDocks = (b.docks || []).map(d => (d.id === dockId ? { ...d, [field]: value } : d));
          return { ...b, docks: updatedDocks };
        }
        return b;
      })
    );
  };

  // Toggle dock operational
  const handleToggleDockOperational = (dockId: string) => {
    if (!currentBranch) return;
    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          const updatedDocks = (b.docks || []).map(d => (d.id === dockId ? { ...d, isOperational: !d.isOperational } : d));
          return { ...b, docks: updatedDocks };
        }
        return b;
      })
    );
  };

  // Copy docks and slots from another branch
  const handleExecuteCopy = () => {
    if (!copySourceBranchId || !currentBranch) return;
    const source = destinationsList.find(b => b.id === copySourceBranchId);
    if (!source) return;

    if (window.confirm(`Deseja copiar as docas e janelas de "${source.name}" para "${currentBranch.name}"? As configurações atuais desta unidade serão substituídas.`)) {
      setDestinationsList(prev =>
        prev.map(b => {
          if (b.id === currentBranch.id) {
            return {
              ...b,
              docks: JSON.parse(JSON.stringify(source.docks || DEFAULT_FALLBACK_DOCKS)),
              timeSlots: [...(source.timeSlots || DEFAULT_FALLBACK_SLOTS)],
              slotSupplierLimits: { ...(source.slotSupplierLimits || DEFAULT_FALLBACK_LIMITS) },
            };
          }
          return b;
        })
      );
      setShowCopyModal(false);
    }
  };

  // Save all destinations directly
  const handleSaveAll = async () => {
    if (onSaveDestinations && destinationsList.length > 0) {
      onSaveDestinations(destinationsList);
    }

    // Sync current active branch docks and slots with App state
    if (currentBranch) {
      if (currentBranch.docks && currentBranch.docks.length > 0) {
        onSaveDocks(currentBranch.docks);
      }
      if (currentBranch.timeSlots && currentBranch.timeSlots.length > 0) {
        onSaveSlots(currentBranch.timeSlots);
      }
      if (currentBranch.slotSupplierLimits && onSaveSlotLimits) {
        onSaveSlotLimits(currentBranch.slotSupplierLimits);
      }
    }

    try {
      await fetch('/api/destinations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destinationsList),
      });
      localStorage.setItem('agendadocas_destinations', JSON.stringify(destinationsList));
    } catch (_) {}

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-2xl border border-blue-500/40">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Configuração de Docas & Janelas por Filial</h2>
              <p className="text-xs text-slate-300">
                Gerencie docas operacionais, limites de capacidade e horários exclusivos de cada unidade de entrega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch Selector Bar */}
        <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 shrink-0">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Selecione a Filial:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 flex-1 justify-start sm:justify-end">
            {destinationsList.map(branch => {
              const isSelected = selectedBranchId === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{branch.name}</span>
                  {branch.code && (
                    <span className="text-[10px] bg-slate-900/60 px-1.5 py-0.2 rounded font-mono">
                      {branch.code}
                    </span>
                  )}
                </button>
              );
            })}

            {destinationsList.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const otherBranch = destinationsList.find(b => b.id !== currentBranch?.id);
                  if (otherBranch) setCopySourceBranchId(otherBranch.id);
                  setShowCopyModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1 shrink-0 ml-1 cursor-pointer"
                title="Copiar configuração de docas e horários de outra unidade"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copiar de outra</span>
              </button>
            )}
          </div>
        </div>

        {/* Copy from branch Modal / Popover */}
        {showCopyModal && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2.5">
              <Copy className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-indigo-950">
                  Duplicar Configuração para: {currentBranch?.name}
                </h4>
                <p className="text-[11px] text-indigo-700">
                  Selecione a filial de origem para copiar suas docas e janelas de horário diretamente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={copySourceBranchId}
                onChange={e => setCopySourceBranchId(e.target.value)}
                className="bg-white border border-indigo-300 rounded-xl px-2.5 py-1.5 text-xs text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {destinationsList
                  .filter(b => b.id !== currentBranch?.id)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      Origem: {b.name} ({b.code || b.id})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleExecuteCopy}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-2.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 sm:px-6 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('docks')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'docks'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Docas da Unidade ({activeDockList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'slots'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Janelas & Vagas por Horário ({activeSlotsList.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {savedSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Configurações salvas e sincronizadas com sucesso para a filial {currentBranch?.name}!</span>
            </div>
          )}

          {/* TAB 1: DOCKS & DAILY CAPACITIES */}
          {activeTab === 'docks' && (
            <div className="space-y-6">
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <p className="font-bold text-blue-950 mb-0.5">
                    Docas da Unidade: {currentBranch?.name}
                  </p>
                  Defina a capacidade máxima diária (em <strong>Pallets</strong> ou <strong>Volumes</strong>) de cada doca desta filial. O sistema bloqueará automaticamente novos agendamentos nesta unidade caso a carga solicitada exceda o limite operacional da doca para a data selecionada.
                </div>
              </div>

              {/* Docks List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Docas Cadastradas ({activeDockList.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Ocupação validada exclusivamente nesta unidade
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeDockList.map(dock => (
                    <div
                      key={dock.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        dock.isOperational
                          ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                          : 'bg-rose-50/40 border-rose-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md shrink-0">
                            {dock.id}
                          </span>
                          <input
                            type="text"
                            value={dock.name}
                            onChange={e => handleUpdateDockField(dock.id, 'name', e.target.value)}
                            className="text-xs font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 w-full"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleDockOperational(dock.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                              dock.isOperational
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {dock.isOperational ? '● Operacional' : '○ Manutenção'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDock(dock.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Excluir doca ${dock.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Controls Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Tipo de Carga</label>
                          <select
                            value={dock.type}
                            onChange={e => handleUpdateDockField(dock.id, 'type', e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="PALETIZADA">PALETIZADA</option>
                            <option value="BATIDA">BATIDA / FRACIONADA</option>
                            <option value="REFRIGERADA">REFRIGERADA</option>
                            <option value="FRACIONADA">FRACIONADA / VUC</option>
                            <option value="PERIGOSA">PRODUTO PERIGOSO</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Limite Diário Máximo
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="9999"
                              value={dock.dailyLimit || 140}
                              onChange={e => handleUpdateDockField(dock.id, 'dailyLimit', Number(e.target.value) || 1)}
                              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <select
                              value={dock.limitUnit || 'pallets'}
                              onChange={e => handleUpdateDockField(dock.id, 'limitUnit', e.target.value as any)}
                              className="text-[10px] font-semibold bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700"
                            >
                              <option value="pallets">Pallets</option>
                              <option value="volumes">Volumes</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Dock Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" /> Cadastrar Nova Doca em {currentBranch?.name}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Nome da Doca</label>
                    <input
                      type="text"
                      placeholder="Ex: Doca 05 (Carga Seca)"
                      value={newDockName}
                      onChange={e => setNewDockName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Tipo de Carga</label>
                    <select
                      value={newDockType}
                      onChange={e => handleTypeChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PALETIZADA">PALETIZADA</option>
                      <option value="BATIDA">BATIDA</option>
                      <option value="REFRIGERADA">REFRIGERADA</option>
                      <option value="FRACIONADA">FRACIONADA</option>
                      <option value="PERIGOSA">PERIGOSA</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Limite Diário</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={newDockDailyLimit}
                        onChange={e => setNewDockDailyLimit(Number(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{newDockLimitUnit}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddDock}
                      disabled={!newDockName.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIME SLOTS & SUPPLIER LIMITS */}
          {activeTab === 'slots' && (
            <div className="space-y-6">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <Users className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <p className="font-bold text-amber-950 mb-0.5">
                    Janelas de Horário da Filial: {currentBranch?.name}
                  </p>
                  Defina quantos veículos/fornecedores podem agendar simultaneamente em cada janela de horário nesta filial. Quando o limite for atingido para a data escolhida, a janela ficará bloqueada exclusivamente para esta unidade.
                </div>
              </div>

              {/* Bulk Update Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">Ajuste Rápido em Massa:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Definir limite de</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkLimit}
                    onChange={e => setBulkLimit(Number(e.target.value) || 1)}
                    className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-slate-600">vagas para todos os horários</span>
                  <button
                    type="button"
                    onClick={handleApplyBulkLimit}
                    className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {/* Slots List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Janelas de Horário ({activeSlotsList.length})</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Limite máximo de fornecedores por horário nesta filial
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeSlotsList.map(slot => {
                    const limit = activeSlotLimitsMap[slot] ?? 3;
                    return (
                      <div
                        key={slot}
                        className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-mono font-bold text-xs text-slate-900">{slot}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Limite:</span>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={limit}
                              onChange={e => handleUpdateSlotLimit(slot, Number(e.target.value) || 1)}
                              className="w-10 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded px-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-slate-500">veículos</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(slot)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remover horário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Slot */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">Nova Janela para {currentBranch?.name}:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Ex: 11:30 - 13:00"
                    value={newSlotTime}
                    onChange={e => setNewSlotTime(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1">
                    <span className="text-[10px] font-bold text-slate-500">Vagas:</span>
                    <input
                      type="number"
                      min="1"
                      value={newSlotLimit}
                      onChange={e => setNewSlotLimit(Number(e.target.value) || 1)}
                      className="w-10 text-xs font-mono font-bold text-center bg-slate-50 rounded px-1"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    disabled={!newSlotTime.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    + Adicionar Janela
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 sm:px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Unidade em edição: <strong className="text-slate-800">{currentBranch?.name}</strong> ({activeDockList.length} docas, {activeSlotsList.length} janelas)
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
