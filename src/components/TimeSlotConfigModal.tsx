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
  Zap,
  Calendar,
  Edit2,
  Layers,
  Truck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DestinationBranch, Dock } from '../types';
import {
  DAY_NAMES_PT,
  DAY_SHORT_NAMES_PT,
  DEFAULT_ALLOWED_DAYS,
  formatAllowedDaysSummary,
} from '../utils/dateUtils';
import { authFetch } from '../services/api';

interface TimeSlotConfigModalProps {
  isOpen: boolean;
  docks: Dock[];
  timeSlots: string[];
  slotLimits?: Record<string, number>;
  destinations?: DestinationBranch[];
  initialBranchId?: string;
  onClose: () => void;
  onSaveSlots: (newSlots: string[]) => void;
  onSaveSlotLimits?: (newLimits: Record<string, number>) => void;
  onSaveDocks: (updatedDocks: Dock[]) => void;
  onSaveDestinations?: (updatedDestinations: DestinationBranch[]) => Promise<void> | void;
}

export const TimeSlotConfigModal: React.FC<TimeSlotConfigModalProps> = ({
  isOpen,
  docks,
  timeSlots,
  slotLimits = {},
  destinations = [],
  initialBranchId,
  onClose,
  onSaveSlots,
  onSaveSlotLimits,
  onSaveDocks,
  onSaveDestinations,
}) => {
  const [activeTab, setActiveTab] = useState<'docks' | 'slots' | 'days'>('slots');

  // Filial selection state: 'GLOBAL' or branch ID
  const [selectedBranchId, setSelectedBranchId] = useState<string | 'GLOBAL'>('GLOBAL');
  const [branchesState, setBranchesState] = useState<DestinationBranch[]>([]);

  const [activeDocks, setActiveDocks] = useState<Dock[]>([]);
  const [activeSlots, setActiveSlots] = useState<string[]>([]);
  const [activeLimits, setActiveLimits] = useState<Record<string, number>>({});
  const [activeOperatingDays, setActiveOperatingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // New slot input state
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotLimit, setNewSlotLimit] = useState(3);
  const [bulkLimit, setBulkLimit] = useState<number>(3);

  // New dock input state
  const [newDockName, setNewDockName] = useState('');
  const [newDockType, setNewDockType] = useState('PALETIZADA');
  const [newDockCapacity, setNewDockCapacity] = useState(2);
  const [newDockDailyLimit, setNewDockDailyLimit] = useState<number>(140);
  const [newDockLimitUnit, setNewDockLimitUnit] = useState<'pallets' | 'volumes'>('pallets');

  // Editing state for existing docks
  const [editingDockId, setEditingDockId] = useState<string | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize or re-sync when opened
  useEffect(() => {
    if (isOpen) {
      setActiveDocks(docks ? docks.map(d => ({ ...d })) : []);
      setActiveSlots(timeSlots ? [...timeSlots] : []);
      setActiveLimits(slotLimits ? { ...slotLimits } : {});
      setBranchesState(destinations ? destinations.map(d => ({ ...d })) : []);
      if (initialBranchId) {
        setSelectedBranchId(initialBranchId);
      } else {
        setSelectedBranchId('GLOBAL');
      }
      setSavedSuccess(false);
      setEditingDockId(null);

      // Load operating days from API
      authFetch('/api/operating-days')
        .then(res => (res.ok ? res.json() : [1, 2, 3, 4, 5]))
        .then(days => {
          if (Array.isArray(days) && days.length > 0) {
            setActiveOperatingDays(days);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, docks, timeSlots, slotLimits, destinations, initialBranchId]);

  if (!isOpen) return null;

  const isGlobal = selectedBranchId === 'GLOBAL';
  const selectedBranch = branchesState.find(b => b.id === selectedBranchId);

  const hasBranchCustomSlots = Boolean(selectedBranch?.timeSlots && selectedBranch.timeSlots.length > 0);
  const currentSlots = isGlobal
    ? activeSlots
    : (hasBranchCustomSlots ? selectedBranch!.timeSlots! : activeSlots);

  const currentLimits = isGlobal
    ? activeLimits
    : (hasBranchCustomSlots ? (selectedBranch!.slotSupplierLimits || {}) : activeLimits);

  const hasBranchCustomDays = Boolean(selectedBranch?.allowedDaysOfWeek && selectedBranch.allowedDaysOfWeek.length > 0);
  const currentOperatingDays = isGlobal
    ? activeOperatingDays
    : (hasBranchCustomDays ? selectedBranch!.allowedDaysOfWeek! : activeOperatingDays);

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

  // Personalizar slots da filial (copia do padrão global se ainda não tiver)
  const handleEnableBranchCustomSlots = () => {
    if (isGlobal || !selectedBranch) return;
    setBranchesState(prev => prev.map(b => {
      if (b.id !== selectedBranchId) return b;
      return {
        ...b,
        timeSlots: [...activeSlots],
        slotSupplierLimits: { ...activeLimits },
      };
    }));
  };

  // Restaurar janelas da filial para o padrão global
  const handleResetBranchSlotsToGlobal = () => {
    if (isGlobal || !selectedBranch) return;
    if (window.confirm(`Deseja remover as janelas personalizadas de "${selectedBranch.name}" e voltar a usar as janelas do Padrão Geral?`)) {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        const copy = { ...b };
        delete copy.timeSlots;
        delete copy.slotSupplierLimits;
        return copy;
      }));
    }
  };

  // Restaurar dias da filial para o padrão global
  const handleResetBranchDaysToGlobal = () => {
    if (isGlobal || !selectedBranch) return;
    setBranchesState(prev => prev.map(b => {
      if (b.id !== selectedBranchId) return b;
      const copy = { ...b };
      delete copy.allowedDaysOfWeek;
      return copy;
    }));
  };

  // Add slot
  const handleAddSlot = () => {
    if (!newSlotTime.trim()) return;
    const trimmed = newSlotTime.trim();
    if (currentSlots.includes(trimmed)) {
      alert(`A janela "${trimmed}" já está cadastrada.`);
      return;
    }
    const limitNum = Number(newSlotLimit) > 0 ? Number(newSlotLimit) : 3;

    if (isGlobal) {
      const updatedSlots = [...activeSlots, trimmed].sort();
      const updatedLimits = {
        ...activeLimits,
        [trimmed]: limitNum,
      };
      setActiveSlots(updatedSlots);
      setActiveLimits(updatedLimits);
    } else {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        const baseSlots = (b.timeSlots && b.timeSlots.length > 0) ? b.timeSlots : activeSlots;
        const baseLimits = b.slotSupplierLimits || activeLimits;
        return {
          ...b,
          timeSlots: [...baseSlots, trimmed].sort(),
          slotSupplierLimits: {
            ...baseLimits,
            [trimmed]: limitNum,
          },
        };
      }));
    }
    setNewSlotTime('');
    setNewSlotLimit(3);
  };

  // Update slot limit
  const handleUpdateSlotLimit = (slot: string, limitVal: number) => {
    const safeLimit = Math.max(1, Math.min(100, Number(limitVal) || 1));
    if (isGlobal) {
      setActiveLimits(prev => ({
        ...prev,
        [slot]: safeLimit,
      }));
    } else {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        const baseSlots = (b.timeSlots && b.timeSlots.length > 0) ? b.timeSlots : activeSlots;
        const baseLimits = b.slotSupplierLimits || activeLimits;
        return {
          ...b,
          timeSlots: [...baseSlots],
          slotSupplierLimits: {
            ...baseLimits,
            [slot]: safeLimit,
          },
        };
      }));
    }
  };

  // Remove slot
  const handleRemoveSlot = (slotToRemove: string) => {
    if (currentSlots.length <= 1) {
      alert('É necessário manter ao menos 1 janela de horário ativa para receber agendamentos.');
      return;
    }

    if (window.confirm(`Deseja remover a janela "${slotToRemove}"?`)) {
      if (isGlobal) {
        const nextSlots = activeSlots.filter(s => s !== slotToRemove);
        const nextLimits = { ...activeLimits };
        delete nextLimits[slotToRemove];
        setActiveSlots(nextSlots);
        setActiveLimits(nextLimits);
      } else {
        setBranchesState(prev => prev.map(b => {
          if (b.id !== selectedBranchId) return b;
          const baseSlots = (b.timeSlots && b.timeSlots.length > 0) ? b.timeSlots : activeSlots;
          const baseLimits = { ...(b.slotSupplierLimits || activeLimits) };
          delete baseLimits[slotToRemove];
          return {
            ...b,
            timeSlots: baseSlots.filter(s => s !== slotToRemove),
            slotSupplierLimits: baseLimits,
          };
        }));
      }
    }
  };

  // Apply bulk limit to all slots
  const handleApplyBulkLimit = () => {
    const safe = Math.max(1, Math.min(100, Number(bulkLimit) || 1));
    if (isGlobal) {
      const updated: Record<string, number> = {};
      activeSlots.forEach(s => {
        updated[s] = safe;
      });
      setActiveLimits(updated);
    } else {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        const baseSlots = (b.timeSlots && b.timeSlots.length > 0) ? b.timeSlots : activeSlots;
        const updated: Record<string, number> = {};
        baseSlots.forEach(s => {
          updated[s] = safe;
        });
        return {
          ...b,
          timeSlots: [...baseSlots],
          slotSupplierLimits: updated,
        };
      }));
    }
  };

  // Next suggested sequential dock number (starting from 1)
  const getNextSequentialDockNumber = (currentDocks: Dock[] = []): number => {
    const existingNumbers = currentDocks
      .map(d => {
        const matchId = (d.id || '').match(/\d+/);
        if (matchId) return parseInt(matchId[0], 10);
        const matchName = (d.name || '').match(/\d+/);
        if (matchName) return parseInt(matchName[0], 10);
        return 0;
      })
      .filter(n => !isNaN(n) && n > 0);

    if (existingNumbers.length === 0) return 1;
    return Math.max(...existingNumbers) + 1;
  };

  // Add dock (sequential ID starting from 1)
  const handleAddDock = () => {
    const nextSeqNum = getNextSequentialDockNumber(activeDocks);
    const formattedNum = String(nextSeqNum).padStart(2, '0');
    const autoId = `DOCA-${formattedNum}`;
    const typeLabel =
      newDockType === 'BATIDA'
        ? 'Batidos'
        : newDockType === 'REFRIGERADA'
        ? 'Refrigerada'
        : newDockType === 'FRACIONADA'
        ? 'Express/VUC'
        : 'Paletizada';

    const dockName = newDockName.trim() || `Doca ${formattedNum} (${typeLabel})`;

    const newDock: Dock = {
      id: autoId,
      name: dockName,
      type: newDockType as any,
      capacityPerSlot: Number(newDockCapacity) || 1,
      isOperational: true,
      dailyLimit: Number(newDockDailyLimit) > 0 ? Number(newDockDailyLimit) : undefined,
      limitUnit: newDockLimitUnit,
    };

    setActiveDocks(prev => [...prev, newDock]);
    setNewDockName('');
    setNewDockCapacity(2);
  };

  // Update specific fields of a dock
  const handleUpdateDockField = (dockId: string, field: keyof Dock, value: any) => {
    setActiveDocks(prev =>
      prev.map(d => {
        if (d.id !== dockId) return d;
        return {
          ...d,
          [field]: value,
        };
      })
    );
  };

  // Remove dock
  const handleRemoveDock = (dockId: string) => {
    if (activeDocks.length <= 1) {
      alert('É necessário manter ao menos 1 doca física cadastrada no sistema.');
      return;
    }
    if (window.confirm(`Deseja excluir permanentemente a doca "${dockId}"?`)) {
      setActiveDocks(prev => prev.filter(d => d.id !== dockId));
    }
  };

  // Toggle dock operational status
  const handleToggleDockOperational = (dockId: string) => {
    setActiveDocks(prev =>
      prev.map(d => (d.id === dockId ? { ...d, isOperational: !d.isOperational } : d))
    );
  };

  // Toggle day of week
  const handleToggleDayOfWeek = (dayIndex: number) => {
    if (isGlobal) {
      let newAllowed: number[];
      if (activeOperatingDays.includes(dayIndex)) {
        if (activeOperatingDays.length <= 1) {
          alert('É necessário ter pelo menos 1 dia da semana habilitado para recebimento.');
          return;
        }
        newAllowed = activeOperatingDays.filter(d => d !== dayIndex);
      } else {
        newAllowed = [...activeOperatingDays, dayIndex].sort((a, b) => a - b);
      }
      setActiveOperatingDays(newAllowed);
    } else {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        const baseDays = (b.allowedDaysOfWeek && b.allowedDaysOfWeek.length > 0)
          ? b.allowedDaysOfWeek
          : activeOperatingDays;
        let nextDays: number[];
        if (baseDays.includes(dayIndex)) {
          if (baseDays.length <= 1) {
            alert('É necessário ter pelo menos 1 dia da semana habilitado para recebimento nesta filial.');
            return b;
          }
          nextDays = baseDays.filter(d => d !== dayIndex);
        } else {
          nextDays = [...baseDays, dayIndex].sort((a, b) => a - b);
        }
        return {
          ...b,
          allowedDaysOfWeek: nextDays,
        };
      }));
    }
  };

  // Set day preset (e.g. Seg-Sex, Seg-Sáb, Todos)
  const handleSetDayPreset = (preset: number[]) => {
    if (isGlobal) {
      setActiveOperatingDays([...preset]);
    } else {
      setBranchesState(prev => prev.map(b => {
        if (b.id !== selectedBranchId) return b;
        return {
          ...b,
          allowedDaysOfWeek: [...preset],
        };
      }));
    }
  };

  // Save all centralized settings
  const handleSaveAll = async () => {
    onSaveDocks(activeDocks);
    onSaveSlots(activeSlots);
    if (onSaveSlotLimits) {
      onSaveSlotLimits(activeLimits);
    }
    if (onSaveDestinations) {
      onSaveDestinations(branchesState);
    }

    try {
      await Promise.all([
        authFetch('/api/docks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeDocks),
        }),
        authFetch('/api/timeslots', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeSlots),
        }),
        authFetch('/api/slot-limits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeLimits),
        }),
        authFetch('/api/operating-days', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeOperatingDays),
        }),
        authFetch('/api/destinations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branchesState),
        }),
      ]);
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
              <h2 className="text-base sm:text-lg font-bold">Configuração Operacional: Janelas, Limites & Docas</h2>
              <p className="text-xs text-slate-300">
                Gerencie limites de fornecedores por filial, janelas de horário personalizadas e escala semanal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch / Filial Selection Bar */}
        {branchesState.length > 0 && (
          <div className="bg-slate-100/90 border-b border-slate-200 px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-700">Configurando:</span>
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold text-slate-800 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
              >
                <option value="GLOBAL">🌐 Configuração Padrão Geral (Todas as Filiais)</option>
                {branchesState.map(branch => (
                  <option key={`opt-branch-${branch.id}`} value={branch.id}>
                    🏢 {branch.name} {branch.code ? `(${branch.code})` : ''} {branch.isDefault ? '— Matriz Padrão' : ''}
                  </option>
                ))}
              </select>
            </div>

            {!isGlobal && (
              <div className="flex items-center gap-2">
                {hasBranchCustomSlots ? (
                  <span className="text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Janelas Exclusivas Desta Filial ({currentSlots.length})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full">
                    Herdando Janelas do Padrão Geral
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'slots'
                ? 'bg-white text-blue-600 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Janelas & Limites ({currentSlots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('days')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'days'
                ? 'bg-white text-blue-600 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Dias de Atendimento ({currentOperatingDays.length} dias)</span>
          </button>

          <button
            onClick={() => setActiveTab('docks')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'docks'
                ? 'bg-white text-blue-600 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Docas Físicas ({activeDocks.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: JANELAS & CAPACIDADE DE FORNECEDORES */}
          {activeTab === 'slots' && (
            <div className="space-y-6">
              
              {/* Context notification when configuring a specific branch */}
              {!isGlobal && selectedBranch && (
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  hasBranchCustomSlots 
                    ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">
                        Janelas e Limites de Fornecedores: {selectedBranch.name}
                      </h4>
                      <p className="text-xs opacity-80">
                        {hasBranchCustomSlots
                          ? 'Esta filial está com janelas de horário e limites específicos cadastrados.'
                          : 'Esta filial está utilizando as janelas e limites globais. Clique para personalizar.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!hasBranchCustomSlots ? (
                      <button
                        onClick={handleEnableBranchCustomSlots}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Personalizar Janelas para esta Filial</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleResetBranchSlotsToGlobal}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Restaurar Padrão Geral</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Add Slot and Bulk Limit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Form Add */}
                <div className="md:col-span-2 bg-blue-50/50 border border-blue-200 rounded-2xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Adicionar Nova Janela de Horário {!isGlobal && selectedBranch ? `(${selectedBranch.name})` : ''}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Horário (Início - Fim)</label>
                      <input
                        type="text"
                        placeholder="Ex: 08:00 - 09:30"
                        value={newSlotTime}
                        onChange={e => setNewSlotTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Limite Fornecedores</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={newSlotLimit}
                          onChange={e => setNewSlotLimit(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                          onClick={handleAddSlot}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bulk Limit */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Limite em Massa</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-3">Defina a mesma capacidade para todas as janelas {!isGlobal ? 'desta filial' : 'do sistema'}.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bulkLimit}
                      onChange={e => setBulkLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={handleApplyBulkLimit}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Aplicar a Todas
                    </button>
                  </div>
                </div>
              </div>

              {/* Slots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Janelas Ativas ({currentSlots.length}) {!isGlobal && selectedBranch ? `- ${selectedBranch.name}` : '- Padrão Geral'}</span>
                  <span>Capacidade de Fornecedores por Janela</span>
                </div>

                {currentSlots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Nenhuma janela cadastrada</p>
                    <p className="text-xs text-slate-500">Utilize o formulário acima para adicionar uma janela.</p>
                  </div>
                ) : (
                  currentSlots.map((slot, sIdx) => (
                    <div
                      key={`slot-card-${slot}-${sIdx}`}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{slot}</span>
                          {!isGlobal && hasBranchCustomSlots && (
                            <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              Filial: {selectedBranch?.code || 'Específico'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">Limite Fornecedores:</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={currentLimits[slot] ?? 3}
                            onChange={e => handleUpdateSlotLimit(slot, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-500">vagas</span>
                        </div>

                        <button
                          onClick={() => handleRemoveSlot(slot)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Excluir Janela"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIAS DE ATENDIMENTO */}
          {activeTab === 'days' && (
            <div className="space-y-6">
              
              {/* Context notification when configuring branch days */}
              {!isGlobal && selectedBranch && (
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  hasBranchCustomDays 
                    ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">
                        Escala Semanal da Filial: {selectedBranch.name}
                      </h4>
                      <p className="text-xs opacity-80">
                        {hasBranchCustomDays
                          ? 'Esta filial está com dias de funcionamento personalizados.'
                          : 'Esta filial está utilizando a escala semanal do Padrão Geral.'}
                      </p>
                    </div>
                  </div>

                  {hasBranchCustomDays && (
                    <button
                      onClick={handleResetBranchDaysToGlobal}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Restaurar Escala Geral</span>
                    </button>
                  )}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Dias da Semana Habilitados para Recebimento {!isGlobal && selectedBranch ? `(${selectedBranch.name})` : ''}</span>
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Fornecedores não poderão agendar entregas em dias desmarcados. O calendário bloqueará automaticamente essas datas.
                </p>

                {/* Presets */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500">Atalhos rápidos:</span>
                  <button
                    onClick={() => handleSetDayPreset(DEFAULT_ALLOWED_DAYS)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Segunda a Sexta (Padrão)
                  </button>
                  <button
                    onClick={() => handleSetDayPreset([1, 2, 3, 4, 5, 6])}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Segunda a Sábado
                  </button>
                  <button
                    onClick={() => handleSetDayPreset([0, 1, 2, 3, 4, 5, 6])}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Todos os Dias
                  </button>
                </div>

                {/* 7 Days Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {DAY_NAMES_PT.map((dayName, idx) => {
                    const isSelected = currentOperatingDays.includes(idx);
                    return (
                      <button
                        key={`day-btn-${idx}`}
                        type="button"
                        onClick={() => handleToggleDayOfWeek(idx)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 opacity-60'
                        }`}
                      >
                        <span className="text-xs">{DAY_SHORT_NAMES_PT[idx]}</span>
                        <span className="text-[10px] opacity-90">{dayName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="text-xs text-blue-900">
                  <span className="font-bold">Resumo da escala ativa {!isGlobal && selectedBranch ? `(${selectedBranch.name})` : ''}: </span>
                  <span>{formatAllowedDaysSummary(currentOperatingDays)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOCAS E LIMITES DE CARGA */}
          {activeTab === 'docks' && (
            <div className="space-y-6">
              {/* Add Dock Form */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 sm:p-5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Adicionar Nova Doca Física</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Carga</label>
                    <select
                      value={newDockType}
                      onChange={e => handleTypeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="PALETIZADA">Paletizada (Padrão)</option>
                      <option value="REFRIGERADA">Refrigerada / Climatizada</option>
                      <option value="BATIDA">Carga Batida / Granel</option>
                      <option value="FRACIONADA">Express / VUC / Fracionada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome / Identificação</label>
                    <input
                      type="text"
                      placeholder={`Ex: Mercearia ou Doca ${String(getNextSequentialDockNumber(activeDocks)).padStart(2, '0')}`}
                      value={newDockName}
                      onChange={e => setNewDockName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Veículos/Janela</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newDockCapacity}
                      onChange={e => setNewDockCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Limite Diário ({newDockLimitUnit === 'pallets' ? 'Paletes' : 'Volumes'})
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={newDockDailyLimit}
                        onChange={e => setNewDockDailyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <select
                        value={newDockLimitUnit}
                        onChange={e => setNewDockLimitUnit(e.target.value as any)}
                        className="px-2 py-2 bg-slate-100 border border-slate-300 rounded-xl text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="pallets">pallets</option>
                        <option value="volumes">volumes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddDock}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer h-[38px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Docks List with Direct Inline Modulation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Docas Cadastradas & Modulação de Limites ({activeDocks.length})</span>
                  <span>Modulação em Tempo Real</span>
                </div>

                {activeDocks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Nenhuma doca cadastrada</p>
                    <p className="text-xs text-slate-500">Utilize o formulário acima para adicionar uma doca.</p>
                  </div>
                ) : (
                  activeDocks.map((dock, idx) => {
                    const isEditing = editingDockId === dock.id;

                    return (
                      <div
                        key={`dock-${dock.id}-${idx}`}
                        className={`p-4 rounded-2xl border transition-all ${
                          dock.isOperational
                            ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                            : 'bg-rose-50/50 border-rose-200 opacity-80'
                        }`}
                      >
                        {/* Top Line: Header & Operational Switch */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${
                              dock.isOperational
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-rose-100 text-rose-600 border-rose-300'
                            }`}>
                              <Building2 className="w-5 h-5" />
                            </div>

                            <div>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={dock.name}
                                    onChange={e => handleUpdateDockField(dock.id, 'name', e.target.value)}
                                    placeholder="Nome da Doca"
                                    className="px-2 py-1 border border-blue-400 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <select
                                    value={dock.type}
                                    onChange={e => handleUpdateDockField(dock.id, 'type', e.target.value)}
                                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                                  >
                                    <option value="PALETIZADA">PALETIZADA</option>
                                    <option value="REFRIGERADA">REFRIGERADA</option>
                                    <option value="BATIDA">BATIDA</option>
                                    <option value="FRACIONADA">FRACIONADA</option>
                                  </select>
                                  <button
                                    onClick={() => setEditingDockId(null)}
                                    className="p-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                                    title="Concluir edição de nome"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-sm">{dock.name}</span>
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                                    {dock.id}
                                  </span>
                                  <span className="text-[10px] font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">
                                    {dock.type}
                                  </span>
                                  <button
                                    onClick={() => setEditingDockId(dock.id)}
                                    className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                                    title="Editar nome e tipo da doca"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleDockOperational(dock.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                dock.isOperational
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                              }`}
                            >
                              {dock.isOperational ? 'Ativa / Operacional' : 'Em Manutenção'}
                            </button>

                            <button
                              onClick={() => handleRemoveDock(dock.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Excluir Doca"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom Line: Direct Modular Limit Inputs */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                          {/* Modulação de Capacidade de Veículos */}
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Veículos / Janela:</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={dock.capacityPerSlot}
                                onChange={e =>
                                  handleUpdateDockField(
                                    dock.id,
                                    'capacityPerSlot',
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  )
                                }
                                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                              />
                              <span className="text-[11px] text-slate-500">veíc.</span>
                            </div>
                          </div>

                          {/* Modulação de Limite Diário de Carga */}
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Limite Diário de Carga:</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={9999}
                                value={dock.dailyLimit || 100}
                                onChange={e =>
                                  handleUpdateDockField(
                                    dock.id,
                                    'dailyLimit',
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  )
                                }
                                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                              />
                            </div>
                          </div>

                          {/* Unidade do Limite */}
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <span>Unidade de Medida:</span>
                            </div>
                            <select
                              value={dock.limitUnit || 'pallets'}
                              onChange={e => handleUpdateDockField(dock.id, 'limitUnit', e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer"
                            >
                              <option value="pallets">pallets (Paletes)</option>
                              <option value="volumes">volumes (Caixas)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100/80 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas nos arquivos do servidor e filiais!
              </span>
            ) : (
              'As alterações de janelas e limites serão salvas para a unidade selecionada e no servidor'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Todas as Configurações</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
