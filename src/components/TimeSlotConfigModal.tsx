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
  ShieldAlert,
  Zap,
  Calendar,
} from 'lucide-react';
import { Dock } from '../types';
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
  onClose: () => void;
  onSaveSlots: (newSlots: string[]) => void;
  onSaveSlotLimits?: (newLimits: Record<string, number>) => void;
  onSaveDocks: (updatedDocks: Dock[]) => void;
}

export const TimeSlotConfigModal: React.FC<TimeSlotConfigModalProps> = ({
  isOpen,
  docks,
  timeSlots,
  slotLimits = {},
  onClose,
  onSaveSlots,
  onSaveSlotLimits,
  onSaveDocks,
}) => {
  const [activeTab, setActiveTab] = useState<'docks' | 'slots' | 'days'>('docks');

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
  const [newDockDailyLimit, setNewDockDailyLimit] = useState(140);
  const [newDockLimitUnit, setNewDockLimitUnit] = useState<'pallets' | 'volumes'>('pallets');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize or re-sync when opened
  useEffect(() => {
    if (isOpen) {
      setActiveDocks(docks ? docks.map(d => ({ ...d })) : []);
      setActiveSlots(timeSlots ? [...timeSlots] : []);
      setActiveLimits(slotLimits ? { ...slotLimits } : {});
      setSavedSuccess(false);

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
  }, [isOpen, docks, timeSlots, slotLimits]);

  if (!isOpen) return null;

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

  // Add slot
  const handleAddSlot = () => {
    if (!newSlotTime.trim()) return;
    const trimmed = newSlotTime.trim();
    if (activeSlots.includes(trimmed)) {
      alert(`A janela "${trimmed}" já está cadastrada.`);
      return;
    }
    const updatedSlots = [...activeSlots, trimmed].sort();
    const updatedLimits = {
      ...activeLimits,
      [trimmed]: Number(newSlotLimit) > 0 ? Number(newSlotLimit) : 3,
    };

    setActiveSlots(updatedSlots);
    setActiveLimits(updatedLimits);
    setNewSlotTime('');
    setNewSlotLimit(3);
  };

  // Update slot limit
  const handleUpdateSlotLimit = (slot: string, limitVal: number) => {
    const safeLimit = Math.max(1, Math.min(100, Number(limitVal) || 1));
    setActiveLimits(prev => ({
      ...prev,
      [slot]: safeLimit,
    }));
  };

  // Remove slot
  const handleRemoveSlot = (slotToRemove: string) => {
    if (activeSlots.length <= 1) {
      alert('É necessário manter ao menos 1 janela de horário ativa para receber agendamentos.');
      return;
    }

    if (window.confirm(`Deseja remover a janela "${slotToRemove}"?`)) {
      const nextSlots = activeSlots.filter(s => s !== slotToRemove);
      const nextLimits = { ...activeLimits };
      delete nextLimits[slotToRemove];
      setActiveSlots(nextSlots);
      setActiveLimits(nextLimits);
    }
  };

  // Apply bulk limit to all slots
  const handleApplyBulkLimit = () => {
    const safe = Math.max(1, Math.min(100, Number(bulkLimit) || 1));
    const updated: Record<string, number> = {};
    activeSlots.forEach(s => {
      updated[s] = safe;
    });
    setActiveLimits(updated);
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
  };

  // Set day preset (e.g. Seg-Sex, Seg-Sáb, Todos)
  const handleSetDayPreset = (preset: number[]) => {
    setActiveOperatingDays([...preset]);
  };

  // Save all centralized settings
  const handleSaveAll = async () => {
    onSaveDocks(activeDocks);
    onSaveSlots(activeSlots);
    if (onSaveSlotLimits) {
      onSaveSlotLimits(activeLimits);
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
              <h2 className="text-base sm:text-lg font-bold">Configuração Operacional: Docas, Janelas & Dias</h2>
              <p className="text-xs text-slate-300">
                Gerencie as docas físicas, capacidade por janela e dias de atendimento do sistema
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

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex items-center gap-2 shrink-0">
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

          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'slots'
                ? 'bg-white text-blue-600 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Janelas & Capacidades ({activeSlots.length})</span>
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
            <span>Dias de Atendimento ({activeOperatingDays.length} dias)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: DOCAS */}
          {activeTab === 'docks' && (
            <div className="space-y-6">
              {/* Add Dock Form */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 sm:p-5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Adicionar Nova Doca Física</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Carga</label>
                    <select
                      value={newDockType}
                      onChange={e => handleTypeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                      placeholder={`Ex: Doca ${String(getNextSequentialDockNumber(activeDocks)).padStart(2, '0')}`}
                      value={newDockName}
                      onChange={e => setNewDockName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Capacidade Simultânea</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newDockCapacity}
                      onChange={e => setNewDockCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddDock}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Doca</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Docks List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Docas Cadastradas ({activeDocks.length})</span>
                  <span>Operação & Status</span>
                </div>

                {activeDocks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Nenhuma doca cadastrada</p>
                    <p className="text-xs text-slate-500">Utilize o formulário acima para adicionar uma doca.</p>
                  </div>
                ) : (
                  activeDocks.map((dock, idx) => (
                    <div
                      key={`dock-${dock.id}-${idx}`}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                        dock.isOperational
                          ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                          : 'bg-rose-50/50 border-rose-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${
                          dock.isOperational
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-rose-100 text-rose-600 border-rose-300'
                        }`}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{dock.name}</span>
                            <span className="font-mono text-[10px] font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                              {dock.id}
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">
                              {dock.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Capacidade: <strong>{dock.capacityPerSlot} caminhão(ões)/janela</strong>
                            {dock.dailyLimit && (
                              <span> • Limite Diário: <strong>{dock.dailyLimit} {dock.limitUnit || 'volumes'}</strong></span>
                            )}
                          </p>
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
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: JANELAS & LIMITES */}
          {activeTab === 'slots' && (
            <div className="space-y-6">
              {/* Add Slot and Bulk Limit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Form Add */}
                <div className="md:col-span-2 bg-blue-50/50 border border-blue-200 rounded-2xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Adicionar Nova Janela de Horário</span>
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
                    <p className="text-[11px] text-slate-500 mb-3">Defina a mesma capacidade para todas as janelas.</p>
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
                  <span>Janelas Ativas ({activeSlots.length})</span>
                  <span>Capacidade de Fornecedores</span>
                </div>

                {activeSlots.map((slot, sIdx) => (
                  <div
                    key={`slot-card-${slot}-${sIdx}`}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-800 text-sm">{slot}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Máximo:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={activeLimits[slot] ?? 3}
                          onChange={e => handleUpdateSlotLimit(slot, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500">veículos</span>
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
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DIAS DE ATENDIMENTO */}
          {activeTab === 'days' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Escala Semanal de Recebimento de Cargas</span>
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Selecione os dias da semana em que as docas estarão abertas para receber agendamentos.
                </p>

                {/* Presets */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([1, 2, 3, 4, 5])}
                    className="px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    Segunda a Sexta (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([1, 2, 3, 4, 5, 6])}
                    className="px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    Segunda a Sábado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDayPreset([0, 1, 2, 3, 4, 5, 6])}
                    className="px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
                  >
                    Todos os Dias (24/7)
                  </button>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {DAY_NAMES_PT.map((dayName, idx) => {
                    const isSelected = activeOperatingDays.includes(idx);
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
                  <span className="font-bold">Resumo da escala ativa: </span>
                  <span>{formatAllowedDaysSummary(activeOperatingDays)}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100/80 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas nos arquivos do servidor!
              </span>
            ) : (
              'As alterações serão salvas diretamente em /data/docks.json, timeslots.json e slot_supplier_limits.json'
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
