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
  Calendar,
  CalendarDays,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { Dock, DestinationBranch } from '../types';
import {
  DAY_NAMES_PT,
  DAY_SHORT_NAMES_PT,
  DEFAULT_ALLOWED_DAYS,
  formatAllowedDaysSummary,
} from '../utils/dateUtils';

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
  const [activeTab, setActiveTab] = useState<'docks' | 'slots' | 'days'>('docks');

  // Sanitize destinations so every branch is guaranteed to have docks, slots, and allowedDaysOfWeek
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
          allowedDaysOfWeek: [1, 2, 3, 4, 5],
        },
      ];
    }
    return branches.map(b => ({
      ...b,
      docks: b.docks ? b.docks.map(d => ({ ...d })) : [],
      timeSlots: b.timeSlots ? [...b.timeSlots] : [],
      slotSupplierLimits: b.slotSupplierLimits ? { ...b.slotSupplierLimits } : {},
      allowedDaysOfWeek: (b.allowedDaysOfWeek && Array.isArray(b.allowedDaysOfWeek) && b.allowedDaysOfWeek.length > 0)
        ? b.allowedDaysOfWeek
        : [1, 2, 3, 4, 5],
    }));
  };

  const [destinationsList, setDestinationsList] = useState<DestinationBranch[]>(() => sanitizeBranches(destinations));
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // New slot input state
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotLimit, setNewSlotLimit] = useState(3);
  const [bulkLimit, setBulkLimit] = useState<number>(3);

  // New dock input state
  const [newDockCustomId, setNewDockCustomId] = useState('');
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

  // Next suggested sequential dock number for the branch (starting from 1)
  const getNextSequentialDockNumber = (branchDocks: Dock[] = []): number => {
    const existingNumbers = branchDocks
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

  // Add dock to current branch (sequential ID starting from 1)
  const handleAddDock = () => {
    if (!currentBranch) return;

    const nextSeqNum = getNextSequentialDockNumber(currentBranch.docks || []);
    const formattedNum = String(nextSeqNum).padStart(2, '0');
    const autoId = `DOCA-${formattedNum}`;
    const typeLabel =
      newDockType === 'BATIDA'
        ? 'Batidos'
        : newDockType === 'REFRIGERADA'
        ? 'Refrigerada'
        : newDockType === 'FRACIONADA'
        ? 'Express/VUC'
        : newDockType === 'PERIGOSA'
        ? 'Perigosa'
        : 'Paletizada';
    const autoName = `Doca ${formattedNum} (${typeLabel})`;

    const finalId = (newDockCustomId.trim() || autoId).toUpperCase();
    const finalName = newDockName.trim() || autoName;

    // Check duplicate IDs within the same branch
    const isDuplicate = (currentBranch.docks || []).some(d => d.id.toUpperCase() === finalId);
    if (isDuplicate) {
      alert(`Já existe uma doca com o código/ID "${finalId}" cadastrada nesta filial. Por favor, utilize outro código.`);
      return;
    }

    const newDock: Dock = {
      id: finalId,
      name: finalName,
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
    setNewDockCustomId('');
    setNewDockDailyLimit(140);
    setNewDockLimitUnit('pallets');
    setNewDockCapacity(2);
  };

  // Renumber all docks in current branch sequentially (DOCA-01, DOCA-02...)
  const handleRenumberDocks = () => {
    if (!currentBranch) return;
    const currentDocks = currentBranch.docks || [];
    if (currentDocks.length === 0) return;

    if (
      window.confirm(
        `Deseja renumerar as ${currentDocks.length} docas da filial "${currentBranch.name}" em ordem sequencial a partir de 1 (DOCA-01, DOCA-02...)?`
      )
    ) {
      const renumbered = currentDocks.map((d, index) => {
        const seq = String(index + 1).padStart(2, '0');
        let updatedName = d.name;
        if (/^(Doca|DOCA)[ -]*\d+/i.test(updatedName)) {
          updatedName = updatedName.replace(/^(Doca|DOCA)[ -]*\d+/i, `Doca ${seq}`);
        } else {
          updatedName = `Doca ${seq} - ${d.name}`;
        }
        return {
          ...d,
          id: `DOCA-${seq}`,
          name: updatedName,
        };
      });

      setDestinationsList(prev =>
        prev.map(b => (b.id === currentBranch.id ? { ...b, docks: renumbered } : b))
      );
    }
  };

  // Remove dock from current branch by index
  const handleRemoveDock = (dockIndex: number) => {
    if (!currentBranch) return;
    if (activeDockList.length <= 1) {
      alert('É necessário manter pelo menos uma doca cadastrada nesta filial.');
      return;
    }

    const targetDock = activeDockList[dockIndex];
    const dockName = targetDock?.name || targetDock?.id || `Doca #${dockIndex + 1}`;

    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          const currentDocks = b.docks || [];
          const nextDocks = currentDocks.filter((_, idx) => idx !== dockIndex);
          return { ...b, docks: nextDocks };
        }
        return b;
      })
    );
  };

  // Update dock field in current branch by index
  const handleUpdateDockByIndex = <K extends keyof Dock>(dockIndex: number, field: K, value: Dock[K]) => {
    if (!currentBranch) return;
    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          const updatedDocks = [...(b.docks || [])];
          if (updatedDocks[dockIndex]) {
            updatedDocks[dockIndex] = { ...updatedDocks[dockIndex], [field]: value };
          }
          return { ...b, docks: updatedDocks };
        }
        return b;
      })
    );
  };

  // Toggle dock operational
  const handleToggleDockOperational = (dockIndex: number) => {
    if (!currentBranch) return;
    setDestinationsList(prev =>
      prev.map(b => {
        if (b.id === currentBranch.id) {
          const updatedDocks = [...(b.docks || [])];
          if (updatedDocks[dockIndex]) {
            updatedDocks[dockIndex] = {
              ...updatedDocks[dockIndex],
              isOperational: !updatedDocks[dockIndex].isOperational,
            };
          }
          return { ...b, docks: updatedDocks };
        }
        return b;
      })
    );
  };

  // Toggle allowed day of week for current branch
  const handleToggleDay = (dayIndex: number) => {
    if (!currentBranch) return;
    const currentAllowed = currentBranch.allowedDaysOfWeek && currentBranch.allowedDaysOfWeek.length > 0
      ? currentBranch.allowedDaysOfWeek
      : [1, 2, 3, 4, 5];

    let newAllowed: number[];
    if (currentAllowed.includes(dayIndex)) {
      if (currentAllowed.length <= 1) {
        alert('A filial precisa ter pelo menos 1 dia da semana habilitado para agendamento.');
        return;
      }
      newAllowed = currentAllowed.filter(d => d !== dayIndex);
    } else {
      newAllowed = [...currentAllowed, dayIndex].sort((a, b) => a - b);
    }

    setDestinationsList(prev =>
      prev.map(b => (b.id === currentBranch.id ? { ...b, allowedDaysOfWeek: newAllowed } : b))
    );
  };

  // Set day preset (e.g. Seg-Sex, Seg-Sáb, Todos)
  const handleSetDayPreset = (preset: number[]) => {
    if (!currentBranch) return;
    setDestinationsList(prev =>
      prev.map(b => (b.id === currentBranch.id ? { ...b, allowedDaysOfWeek: [...preset] } : b))
    );
  };

  // Apply current branch operating days to ALL branches
  const handleApplyDaysToAllBranches = () => {
    if (!currentBranch) return;
    const currentAllowed = currentBranch.allowedDaysOfWeek && currentBranch.allowedDaysOfWeek.length > 0
      ? currentBranch.allowedDaysOfWeek
      : [1, 2, 3, 4, 5];

    if (window.confirm(`Deseja replicar a escala de dias (${formatAllowedDaysSummary(currentAllowed)}) de "${currentBranch.name}" para TODAS as filiais cadastradas?`)) {
      setDestinationsList(prev =>
        prev.map(b => ({
          ...b,
          allowedDaysOfWeek: [...currentAllowed],
        }))
      );
    }
  };

  // Copy docks, slots and days from another branch
  const handleExecuteCopy = () => {
    if (!copySourceBranchId || !currentBranch) return;
    const source = destinationsList.find(b => b.id === copySourceBranchId);
    if (!source) return;

    if (window.confirm(`Deseja copiar as docas, janelas e dias de atendimento de "${source.name}" para "${currentBranch.name}"? As configurações atuais desta unidade serão substituídas.`)) {
      setDestinationsList(prev =>
        prev.map(b => {
          if (b.id === currentBranch.id) {
            return {
              ...b,
              docks: JSON.parse(JSON.stringify(source.docks || DEFAULT_FALLBACK_DOCKS)),
              timeSlots: [...(source.timeSlots || DEFAULT_FALLBACK_SLOTS)],
              slotSupplierLimits: { ...(source.slotSupplierLimits || DEFAULT_FALLBACK_LIMITS) },
              allowedDaysOfWeek: source.allowedDaysOfWeek ? [...source.allowedDaysOfWeek] : [1, 2, 3, 4, 5],
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
            {destinationsList.map((branch, bIdx) => {
              const isSelected = selectedBranchId === branch.id;
              return (
                <button
                  key={`branch-tab-${branch.id || ''}-${bIdx}`}
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
                  .map((b, bIdx) => (
                    <option key={`copy-src-${b.id || ''}-${bIdx}`} value={b.id}>
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
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 sm:px-6 pt-3 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('docks')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
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
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'slots'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Janelas & Vagas por Horário ({activeSlotsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('days')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'days'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Dias de Atendimento ({currentBranch?.allowedDaysOfWeek?.length || 5}/7)
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>Docas Cadastradas ({activeDockList.length})</span>
                    <span className="text-[11px] font-normal text-slate-500 lowercase">
                      (identificação sequencial a partir de 1)
                    </span>
                  </h3>

                  {activeDockList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRenumberDocks}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
                      title="Organizar e renumerar todas as docas desta unidade em ordem sequencial (DOCA-01, DOCA-02, DOCA-03...)"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Padronizar Sequência (DOCA-01, 02...)</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeDockList.map((dock, index) => (
                    <div
                      key={`dock-item-${dock.id || 'dock'}-${index}`}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        dock.isOperational
                          ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                          : 'bg-rose-50/40 border-rose-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={dock.id}
                            onChange={e => handleUpdateDockByIndex(index, 'id', e.target.value.toUpperCase())}
                            className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md w-24 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white uppercase shrink-0 transition-colors"
                            title="Código/ID de designação da doca (Ex: DOCA-01)"
                            placeholder="DOCA-01"
                          />
                          <input
                            type="text"
                            value={dock.name}
                            onChange={e => handleUpdateDockByIndex(index, 'name', e.target.value)}
                            className="text-xs font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 w-full"
                            title="Nome descritivo da doca"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleDockOperational(index)}
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
                            onClick={() => handleRemoveDock(index)}
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
                            onChange={e => handleUpdateDockByIndex(index, 'type', e.target.value as any)}
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
                              onChange={e => handleUpdateDockByIndex(index, 'dailyLimit', Number(e.target.value) || 1)}
                              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <select
                              value={dock.limitUnit || 'pallets'}
                              onChange={e => handleUpdateDockByIndex(index, 'limitUnit', e.target.value as any)}
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
              {(() => {
                const nextSeqNum = getNextSequentialDockNumber(activeDockList);
                const suggestedId = `DOCA-${String(nextSeqNum).padStart(2, '0')}`;
                const typeLabel =
                  newDockType === 'BATIDA'
                    ? 'Batidos'
                    : newDockType === 'REFRIGERADA'
                    ? 'Refrigerada'
                    : newDockType === 'FRACIONADA'
                    ? 'Express/VUC'
                    : newDockType === 'PERIGOSA'
                    ? 'Perigosa'
                    : 'Paletizada';
                const suggestedName = `Doca ${String(nextSeqNum).padStart(2, '0')} (${typeLabel})`;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-600" /> Cadastrar Nova Doca em {currentBranch?.name}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Próximo ID sugerido:{' '}
                        <strong className="font-mono text-blue-700">{suggestedId}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Código / ID
                        </label>
                        <input
                          type="text"
                          placeholder={suggestedId}
                          value={newDockCustomId}
                          onChange={e => setNewDockCustomId(e.target.value.toUpperCase())}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                          title={`Código identificador da doca. Padrão: ${suggestedId}`}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Nome da Doca</label>
                        <input
                          type="text"
                          placeholder={`Ex: ${suggestedName}`}
                          value={newDockName}
                          onChange={e => setNewDockName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
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

                      <div className="sm:col-span-2">
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
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3 rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
                        >
                          + Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                  {activeSlotsList.map((slot, sIdx) => {
                    const limit = activeSlotLimitsMap[slot] ?? 3;
                    return (
                      <div
                        key={`slot-item-${slot}-${sIdx}`}
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

          {/* TAB 3: OPERATING DAYS / CALENDAR RESTRICTIONS */}
          {activeTab === 'days' && (
            <div className="space-y-6">
              {/* Informative Guidance */}
              <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 leading-relaxed">
                  <p className="font-bold text-indigo-950 mb-0.5">
                    Dias Autorizados para Recebimento: {currentBranch?.name}
                  </p>
                  Defina quais dias da semana os fornecedores podem solicitar agendamentos de entrega para esta unidade. Dias desmarcados (como Sábados e Domingos) ficarão automaticamente indisponíveis e bloqueados no formulário de solicitação de agendamento e reagendamento do fornecedor.
                </div>
              </div>

              {/* Quick Presets and Batch Action */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Modelos Rápidos de Escala:
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Escala ativa: <strong className="text-indigo-600">{formatAllowedDaysSummary(currentBranch?.allowedDaysOfWeek || [1, 2, 3, 4, 5])}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([1, 2, 3, 4, 5])}
                    className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Segunda a Sexta-feira (Sem fins de semana)"
                  >
                    Segunda a Sexta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([1, 2, 3, 4, 5, 6])}
                    className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Segunda a Sábado"
                  >
                    Segunda a Sábado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([0, 1, 2, 3, 4, 5, 6])}
                    className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Todos os 7 dias"
                  >
                    Todos os Dias (24/7)
                  </button>
                  
                  {destinationsList.length > 1 && (
                    <button
                      type="button"
                      onClick={handleApplyDaysToAllBranches}
                      className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                      title="Aplicar esta mesma escala de dias para todas as filiais cadastradas"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Replicar p/ Todas Filiais</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 7 Days Interactive Toggle Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                  <span>Selecione os Dias da Semana Permitidos</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {(currentBranch?.allowedDaysOfWeek || [1, 2, 3, 4, 5]).length} de 7 dias liberados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                    const allowedList = currentBranch?.allowedDaysOfWeek || [1, 2, 3, 4, 5];
                    const isAllowed = allowedList.includes(dayIndex);
                    const isWeekend = dayIndex === 0 || dayIndex === 6;

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => handleToggleDay(dayIndex)}
                        className={`border-2 rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between select-none ${
                          isAllowed
                            ? 'bg-white border-blue-500 shadow-sm hover:border-blue-600 hover:shadow-md'
                            : 'bg-slate-50 border-slate-200 opacity-70 hover:opacity-90 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-9 h-9 rounded-xl font-bold font-mono text-xs flex items-center justify-center ${
                                isAllowed
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {DAY_SHORT_NAMES_PT[dayIndex].toUpperCase()}
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                {DAY_NAMES_PT[dayIndex]}
                              </h4>
                              <span className="text-[10px] text-slate-500">
                                {isWeekend ? 'Fim de Semana' : 'Dia Útil'}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                              isAllowed
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {isAllowed ? <Check className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isAllowed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isAllowed ? '✓ Aberto p/ Agendar' : '✕ Bloqueado'}
                          </span>

                          <span className="text-[10px] text-slate-400">
                            {isAllowed ? 'Clique p/ bloquear' : 'Clique p/ liberar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security Policy Reminder */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold text-amber-950 mb-0.5">
                    Regra de Validação Automática de Portaria
                  </p>
                  Agendamentos do tipo <strong>Encaixe / No Pátio</strong> (gerados presencialmente pela equipe de Prevenção de Perdas) continuam permitidos a qualquer momento para fins de contingência emergencial.
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
