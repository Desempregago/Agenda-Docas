import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Sliders,
  Check,
  Zap,
  Calendar,
  Edit2,
  Layers,
  Truck,
  Copy,
  MapPin,
  AlertTriangle,
  KeyRound,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { DestinationBranch, Dock } from '../types';
import {
  DAY_NAMES_PT,
  DAY_SHORT_NAMES_PT,
  formatAllowedDaysSummary,
} from '../utils/dateUtils';
import { authFetch, setAuthToken } from '../services/api';

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
  onRequestAdminAuth?: () => void;
  currentSystemUser?: { username: string } | null;
}

export const TimeSlotConfigModal: React.FC<TimeSlotConfigModalProps> = ({
  isOpen,
  docks: _propDocks,
  timeSlots: _propSlots,
  slotLimits: _propLimits = {},
  destinations = [],
  initialBranchId,
  onClose,
  onSaveSlots,
  onSaveSlotLimits,
  onSaveDocks,
  onSaveDestinations,
  onRequestAdminAuth,
  currentSystemUser,
}) => {
  const [activeTab, setActiveTab] = useState<'slots' | 'days' | 'docks'>('slots');

  // Cada loja/filial é gerenciada de forma independente
  const [branchesState, setBranchesState] = useState<DestinationBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Formulário de nova janela
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotLimit, setNewSlotLimit] = useState(3);
  const [bulkLimit, setBulkLimit] = useState<number>(3);

  // Formulário de cópia rápida entre lojas
  const [copySourceBranchId, setCopySourceBranchId] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Formulário de nova doca física
  const [newDockName, setNewDockName] = useState('');
  const [newDockType, setNewDockType] = useState('PALETIZADA');
  const [newDockCapacity, setNewDockCapacity] = useState(2);
  const [newDockDailyLimit, setNewDockDailyLimit] = useState<number>(140);
  const [newDockLimitUnit, setNewDockLimitUnit] = useState<'pallets' | 'volumes'>('pallets');

  // Edição de doca existente
  const [editingDockId, setEditingDockId] = useState<string | null>(null);
  // Rascunho do ID da doca durante edição: mantemos o valor digitado aqui para
  // NÃO alterar o dock.id (nem a key do card) a cada tecla — key diferente
  // remonta o card e o input perde o foco. O novo ID é commitado ao confirmar/sair.
  const [dockIdDraft, setDockIdDraft] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estado de controle de erros de salvamento e re-autenticação em caso de sessão expirada
  // IMPORTANTE: declarado ANTES do early-return de isOpen (ordem de hooks do React não pode mudar entre renders)
  const [saveError, setSaveError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authPinOrPassword, setAuthPinOrPassword] = useState('');
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Inicialização e sincronização ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      // Baseline vazio: usar somente o que o administrador configurou (sem janelas/docas de demonstração)
      const clonedBranches = destinations && destinations.length > 0
        ? destinations.map(d => ({
            ...d,
            timeSlots: d.timeSlots ? [...d.timeSlots] : [],
            slotSupplierLimits: d.slotSupplierLimits ? { ...d.slotSupplierLimits } : {},
            allowedDaysOfWeek: d.allowedDaysOfWeek && d.allowedDaysOfWeek.length > 0 ? [...d.allowedDaysOfWeek] : [1, 2, 3, 4, 5],
            docks: d.docks ? d.docks.map(dock => ({ ...dock })) : [],
          }))
        : [];

      setBranchesState(clonedBranches);

      if (initialBranchId && clonedBranches.some(b => b.id === initialBranchId)) {
        setSelectedBranchId(initialBranchId);
      } else if (clonedBranches.length > 0) {
        setSelectedBranchId(clonedBranches[0].id);
      }
      setSavedSuccess(false);
      setEditingDockId(null);
      setDockIdDraft('');
      setCopyFeedback(null);
    }
  }, [isOpen, destinations, initialBranchId]);

  if (!isOpen) return null;

  // Loja / Filial atualmente selecionada
  const selectedBranch = branchesState.find(b => b.id === selectedBranchId) || branchesState[0];

  const currentSlots: string[] = selectedBranch?.timeSlots || [];
  const currentLimits: Record<string, number> = selectedBranch?.slotSupplierLimits || {};
  const currentOperatingDays: number[] = selectedBranch?.allowedDaysOfWeek || [1, 2, 3, 4, 5];
  const currentDocks: Dock[] = selectedBranch?.docks || [];

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

  // Helper para atualizar o estado da filial selecionada
  const updateSelectedBranch = (updater: (branch: DestinationBranch) => DestinationBranch) => {
    if (!selectedBranch) return;
    setBranchesState(prev => prev.map(b => (b.id === selectedBranch.id ? updater(b) : b)));
  };

  // --- GERENCIAMENTO DE JANELAS (SLOTS) DA LOJA ---
  const handleAddSlot = () => {
    if (!newSlotTime.trim() || !selectedBranch) return;
    const trimmed = newSlotTime.trim();
    if (currentSlots.includes(trimmed)) {
      alert(`A janela "${trimmed}" já está cadastrada para esta loja.`);
      return;
    }
    const limitNum = Number(newSlotLimit) > 0 ? Number(newSlotLimit) : 3;

    updateSelectedBranch(b => ({
      ...b,
      timeSlots: [...(b.timeSlots || []), trimmed].sort(),
      slotSupplierLimits: {
        ...(b.slotSupplierLimits || {}),
        [trimmed]: limitNum,
      },
    }));

    setNewSlotTime('');
    setNewSlotLimit(3);
  };

  const handleUpdateSlotLimit = (slot: string, newLimit: number) => {
    const val = Math.max(1, newLimit);
    updateSelectedBranch(b => ({
      ...b,
      slotSupplierLimits: {
        ...(b.slotSupplierLimits || {}),
        [slot]: val,
      },
    }));
  };

  const handleRemoveSlot = (slotToRemove: string) => {
    updateSelectedBranch(b => {
      const updatedSlots = (b.timeSlots || []).filter(s => s !== slotToRemove);
      const updatedLimits = { ...(b.slotSupplierLimits || {}) };
      delete updatedLimits[slotToRemove];
      return {
        ...b,
        timeSlots: updatedSlots,
        slotSupplierLimits: updatedLimits,
      };
    });
  };

  const handleApplyBulkLimit = () => {
    const val = Math.max(1, bulkLimit);
    updateSelectedBranch(b => {
      const updatedLimits: Record<string, number> = {};
      (b.timeSlots || []).forEach(slot => {
        updatedLimits[slot] = val;
      });
      return {
        ...b,
        slotSupplierLimits: updatedLimits,
      };
    });
  };

  // --- GERENCIAMENTO DE DIAS DE OPERAÇÃO DA LOJA ---
  const handleToggleDay = (dayIndex: number) => {
    updateSelectedBranch(b => {
      const days = b.allowedDaysOfWeek || [1, 2, 3, 4, 5];
      let updatedDays: number[];
      if (days.includes(dayIndex)) {
        if (days.length <= 1) {
          alert('A loja deve ter pelo menos 1 dia da semana liberado para recebimento.');
          return b;
        }
        updatedDays = days.filter(d => d !== dayIndex);
      } else {
        updatedDays = [...days, dayIndex].sort((x, y) => x - y);
      }
      return {
        ...b,
        allowedDaysOfWeek: updatedDays,
      };
    });
  };

  const handleSetPresetDays = (preset: number[]) => {
    updateSelectedBranch(b => ({
      ...b,
      allowedDaysOfWeek: [...preset],
    }));
  };

  // --- GERENCIAMENTO DE DOCAS FÍSICAS DA LOJA ---
  const handleAddDock = () => {
    if (!newDockName.trim() || !selectedBranch) return;
    const newId = `DOCA-${Date.now().toString().slice(-4)}`;
    const newDock: Dock = {
      id: newId,
      name: newDockName.trim(),
      type: newDockType,
      capacityPerSlot: Math.max(1, Number(newDockCapacity) || 1),
      isOperational: true,
      dailyLimit: Math.max(1, Number(newDockDailyLimit) || 100),
      limitUnit: newDockLimitUnit,
      destinationBranchId: selectedBranch.id,
    };

    updateSelectedBranch(b => ({
      ...b,
      docks: [...(b.docks || []), newDock],
    }));

    setNewDockName('');
    setNewDockCapacity(2);
    handleTypeChange('PALETIZADA');
  };

  const handleToggleDockOperational = (dockId: string) => {
    updateSelectedBranch(b => ({
      ...b,
      docks: (b.docks || []).map(dock =>
        dock.id === dockId ? { ...dock, isOperational: !dock.isOperational } : dock
      ),
    }));
  };

  const handleUpdateDockField = (dockId: string, field: keyof Dock, value: any) => {
    if (field === 'id') {
      // O ID é editado via dockIdDraft e só é commitado em commitDockIdEdit —
      // alterar o id a cada tecla remonta o card (key) e derruba o foco do input.
      return;
    }
    updateSelectedBranch(b => ({
      ...b,
      docks: (b.docks || []).map(dock =>
        dock.id === dockId ? { ...dock, [field]: value } : dock
      ),
    }));
  };

  /**
   * Inicia a edição de uma doca.
   */
  const beginDockEdit = (dockId: string) => {
    setEditingDockId(dockId);
    setDockIdDraft(dockId);
  };

  /**
   * Confirma a edição da doca: aplica o novo ID (normalizado e único) e fecha a linha.
   */
  const commitDockIdEdit = () => {
    const oldId = editingDockId;
    if (!oldId) return;
    const sanitized = dockIdDraft.trim().toUpperCase().replace(/\s+/g, '-');
    if (!sanitized || sanitized === oldId) {
      setEditingDockId(null);
      setDockIdDraft('');
      return;
    }
    updateSelectedBranch(b => {
      const duplicate = (b.docks || []).some(d => d.id === sanitized && d.id !== oldId);
      if (duplicate) return b;
      return {
        ...b,
        docks: (b.docks || []).map(dock => (dock.id === oldId ? { ...dock, id: sanitized } : dock)),
      };
    });
    setEditingDockId(null);
    setDockIdDraft('');
  };

  const handleRemoveDock = (dockId: string) => {
    updateSelectedBranch(b => ({
      ...b,
      docks: (b.docks || []).filter(dock => dock.id !== dockId),
    }));
  };

  // --- COPIAR CONFIGURAÇÃO DE OUTRA LOJA ---
  const handleCopyFromBranch = () => {
    if (!copySourceBranchId || !selectedBranch || copySourceBranchId === selectedBranch.id) return;
    const source = branchesState.find(b => b.id === copySourceBranchId);
    if (!source) return;

    updateSelectedBranch(b => ({
      ...b,
      timeSlots: source.timeSlots ? [...source.timeSlots] : [],
      slotSupplierLimits: source.slotSupplierLimits ? { ...source.slotSupplierLimits } : {},
      allowedDaysOfWeek: source.allowedDaysOfWeek ? [...source.allowedDaysOfWeek] : [1, 2, 3, 4, 5],
      docks: source.docks ? source.docks.map(d => ({ ...d, id: `${d.id}-${b.code || 'LOJA'}`, destinationBranchId: b.id })) : [],
    }));

    setCopyFeedback(`Configurações de janelas, limites e docas copiadas com sucesso de "${source.name}"!`);
    setTimeout(() => setCopyFeedback(null), 4000);
  };

  // --- RE-AUTENTICAÇÃO INLINE (SEM PERDER ALTERAÇÕES) ---
  const handleInlineAuthenticate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authPinOrPassword.trim()) return;
    setIsReauthenticating(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentSystemUser?.username,
          password: authPinOrPassword.trim(),
          pin: authPinOrPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        if (data.user) {
          try {
            localStorage.setItem('agendadocas_system_user', JSON.stringify(data.user));
          } catch (_) {}
        }
        setNeedsAuth(false);
        setAuthPinOrPassword('');
        setSaveError(null);
        // Tenta salvar novamente com o novo token
        await handleSaveAll(data.token);
      } else {
        setAuthError(data.error || 'Credenciais inválidas. Digite sua senha ou PIN.');
      }
    } catch (err) {
      setAuthError('Falha ao conectar com o servidor para autenticação.');
    } finally {
      setIsReauthenticating(false);
    }
  };

  // --- SALVAR ALTERAÇÕES NO SERVIDOR ---
  const handleSaveAll = async (overrideToken?: string) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (overrideToken) {
        headers['Authorization'] = `Bearer ${overrideToken}`;
      }

      // 1. Salvar lista completa de destinos atualizados no backend
      const res = await authFetch('/api/destinations', {
        method: 'PUT',
        headers,
        body: JSON.stringify(branchesState),
      });

      if (res.ok) {
        setNeedsAuth(false);
        setSaveError(null);

        if (typeof onSaveDestinations === 'function') {
          // Passa skipRemote=true se a função aceitar para evitar requisição PUT duplicada
          await (onSaveDestinations as any)(branchesState, true);
        }

        // Sincroniza callbacks de compatibilidade
        if (selectedBranch?.timeSlots) {
          onSaveSlots(selectedBranch.timeSlots);
        }
        if (selectedBranch?.slotSupplierLimits) {
          onSaveSlotLimits?.(selectedBranch.slotSupplierLimits);
        }
        if (selectedBranch?.docks) {
          const allDocks = branchesState.flatMap(b => Array.isArray(b.docks) ? b.docks : []);
          onSaveDocks(allDocks.length > 0 ? allDocks : selectedBranch.docks);
        }

        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 800);
      } else {
        const errorData = await res.json().catch(() => null);
        if (res.status === 401) {
          setNeedsAuth(true);
          const msg = 'Sua sessão expirou ou não está autenticada. Autentique-se como Administrador ou Operador para salvar.';
          setSaveError(msg);
        } else if (res.status === 403) {
          const msg = 'Você não possui permissão para alterar as configurações desta loja.';
          setSaveError(msg);
          alert(msg);
        } else {
          const msg = errorData?.error || 'Erro ao persistir as configurações no servidor.';
          setSaveError(msg);
          alert(msg);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      const msg = 'Falha na comunicação com o servidor. Verifique sua conexão.';
      setSaveError(msg);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] flex flex-col">
        
        {/* Header Superior */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-2xl border border-blue-500/40">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Configuração Operacional Manual por Loja</h2>
              <p className="text-xs text-slate-300">
                Cada loja/filial possui sua escala de funcionamento, janelas de atendimento e docas configuradas individualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Seleção de Loja / Filial */}
        <div className="bg-slate-800 border-b border-slate-700 px-5 sm:px-6 py-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Loja em Configuração Manual:
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => {
                    setSelectedBranchId(e.target.value);
                    setCopyFeedback(null);
                  }}
                  className="bg-slate-900 border border-slate-600 text-white text-xs sm:text-sm font-bold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[240px] cursor-pointer"
                >
                  {branchesState.map(branch => (
                    <option key={`branch-opt-${branch.id}`} value={branch.id}>
                      {branch.name} {branch.code ? `(${branch.code})` : ''} {branch.isDefault ? '★ Padrão' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Informações Resumidas da Loja Selecionada */}
            {selectedBranch && (
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700/60 w-full sm:w-auto justify-between sm:justify-start">
                <span className="flex items-center gap-1 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  {selectedBranch.city || 'Cidade'}/{selectedBranch.state || 'UF'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-semibold text-blue-300">
                  {currentSlots.length} janelas
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-semibold text-emerald-300">
                  {currentDocks.length} docas
                </span>
              </div>
            )}
          </div>

          {/* Banner de Cópia Rápida entre Lojas (Opcional para facilitar operação) */}
          {branchesState.length > 1 && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copiar configuração de outra loja para agilizar:</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={copySourceBranchId}
                  onChange={e => setCopySourceBranchId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="">Selecione loja de origem...</option>
                  {branchesState
                    .filter(b => b.id !== selectedBranchId)
                    .map(b => (
                      <option key={`copy-opt-${b.id}`} value={b.id}>
                        {b.name} ({b.code || b.city})
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleCopyFromBranch}
                  disabled={!copySourceBranchId}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Clonar para esta Loja
                </button>
              </div>
            </div>
          )}

          {copyFeedback && (
            <div className="mt-2 p-2 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{copyFeedback}</span>
            </div>
          )}
        </div>

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
            <span>Janelas & Capacidades ({currentSlots.length})</span>
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
            <span>Escala Semanal ({currentOperatingDays.length} dias)</span>
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
            <span>Docas Físicas ({currentDocks.length})</span>
          </button>
        </div>

        {/* Body do Modal com scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {branchesState.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma unidade/filial cadastrada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Este painel configura janelas, limites e docas de cada unidade individualmente.
                Primeiro cadastre uma unidade em "Configurar Unidades de Destino & Filiais".
              </p>
            </div>
          ) : (
          <>

          {/* ABA 1: JANELAS DE HORÁRIO E LIMITES DE FORNECEDORES */}
          {activeTab === 'slots' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Card de Adição de Nova Janela para a Loja */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Cadastrar Nova Janela para "{selectedBranch?.name || 'Loja'}"
                </span>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      placeholder="Ex: 08:00 - 09:30 ou 13:30 - 15:00"
                      value={newSlotTime}
                      onChange={e => setNewSlotTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Vagas/Fornecedores:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newSlotLimit}
                      onChange={e => setNewSlotLimit(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddSlot}
                    disabled={!newSlotTime.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Janela</span>
                  </button>
                </div>
              </div>

              {/* Ajuste em Lote de Capacidade */}
              {currentSlots.length > 0 && (
                <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                    <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Ajustar capacidade de todas as janelas desta loja para:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bulkLimit}
                      onChange={e => setBulkLimit(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 bg-white border border-blue-300 rounded-lg text-xs font-bold text-center text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-xs text-blue-800 font-medium">vagas</span>
                    <button
                      onClick={handleApplyBulkLimit}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Aplicar em Lote
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Janelas da Loja */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Janela de Atendimento ({selectedBranch?.name})</span>
                  <span>Capacidade de Fornecedores / Veículos</span>
                </div>

                {currentSlots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Nenhuma janela cadastrada para esta loja</p>
                    <p className="text-xs text-slate-500 mt-1">Utilize o campo acima para adicionar as janelas de horário em que esta unidade recebe mercadorias.</p>
                  </div>
                ) : (
                  currentSlots.map((slot, sIdx) => (
                    <div
                      key={`slot-card-${slot}-${sIdx}`}
                      className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{slot}</span>
                          <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Loja: {selectedBranch?.code || selectedBranch?.name}
                          </span>
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
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-500">vagas</span>
                        </div>

                        <button
                          onClick={() => handleRemoveSlot(slot)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Excluir Janela desta Loja"
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

          {/* ABA 2: ESCALA SEMANAL / DIAS DE OPERAÇÃO DA LOJA */}
          {activeTab === 'days' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Dias Permitidos para Recebimento em "{selectedBranch?.name}"
                    </h3>
                    <p className="text-xs text-slate-500">
                      Selecione em quais dias da semana esta unidade está autorizada a receber entregas
                    </p>
                  </div>

                  {/* Botões de Escala Pré-definida */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleSetPresetDays([1, 2, 3, 4, 5])}
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                    >
                      Seg - Sex (5d)
                    </button>
                    <button
                      onClick={() => handleSetPresetDays([1, 2, 3, 4, 5, 6])}
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                    >
                      Seg - Sáb (6d)
                    </button>
                    <button
                      onClick={() => handleSetPresetDays([0, 1, 2, 3, 4, 5, 6])}
                      className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
                    >
                      Todos (7d)
                    </button>
                  </div>
                </div>

                {/* Grade de Seleção dos 7 dias */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
                  {DAY_NAMES_PT.map((name, idx) => {
                    const isAllowed = currentOperatingDays.includes(idx);
                    return (
                      <button
                        key={`day-btn-${idx}`}
                        type="button"
                        onClick={() => handleToggleDay(idx)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          isAllowed
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                          {DAY_SHORT_NAMES_PT[idx]}
                        </span>
                        <span className="text-xs font-bold line-clamp-1">
                          {name.split('-')[0]}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isAllowed ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isAllowed ? 'Ativo' : 'Fechado'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Resumo da Escala */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Escala desta Loja:</span>
                  <span className="font-bold text-blue-700">
                    {formatAllowedDaysSummary(currentOperatingDays)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: DOCAS FÍSICAS DA LOJA */}
          {activeTab === 'docks' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Formulário de Adicionar Nova Doca na Loja */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Cadastrar Nova Doca para "{selectedBranch?.name || 'Loja'}"
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Identificação / Nome da Doca
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Doca 01 - Cargas Paletizadas"
                      value={newDockName}
                      onChange={e => setNewDockName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tipo de Carga
                    </label>
                    <select
                      value={newDockType}
                      onChange={e => handleTypeChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="PALETIZADA">PALETIZADA</option>
                      <option value="BATIDA">BATIDA</option>
                      <option value="REFRIGERADA">REFRIGERADA</option>
                      <option value="FRACIONADA">FRACIONADA</option>
                      <option value="PERIGOSA">PERIGOSA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Veículos / Janela
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newDockCapacity}
                      onChange={e => setNewDockCapacity(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Limite Diário Máximo
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={newDockDailyLimit}
                      onChange={e => setNewDockDailyLimit(parseInt(e.target.value) || 100)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Unidade de Medida
                    </label>
                    <select
                      value={newDockLimitUnit}
                      onChange={e => setNewDockLimitUnit(e.target.value as 'pallets' | 'volumes')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="pallets">Paletes</option>
                      <option value="volumes">Volumes / Caixas</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleAddDock}
                      disabled={!newDockName.trim()}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Doca</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Docas Físicas da Loja */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Docas Físicas desta Loja ({currentDocks.length})</span>
                  <span>Modulação & Limites</span>
                </div>

                {currentDocks.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                    <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Nenhuma doca física cadastrada nesta loja</p>
                    <p className="text-xs text-slate-500 mt-1">Cadastre as docas físicas receptoras da unidade no formulário acima.</p>
                  </div>
                ) : (
                  currentDocks.map((dock, dIdx) => (
                    <div
                      key={`dock-card-${dock.id}-${dIdx}`}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-xl border ${
                              dock.isOperational
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-rose-50 text-rose-600 border-rose-200'
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>

                          <div>
                            {editingDockId === dock.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={dock.name}
                                  onChange={e => handleUpdateDockField(dock.id, 'name', e.target.value)}
                                  className="px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-bold"
                                />
                                <input
                                  type="text"
                                  value={dockIdDraft}
                                  onChange={e => setDockIdDraft(e.target.value)}
                                  onBlur={commitDockIdEdit}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitDockIdEdit();
                                    }
                                  }}
                                  className="px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-mono font-bold w-28"
                                  title="ID único da doca — usado na alocação de agendamentos. Pressione Enter ou saia do campo para confirmar."
                                />
                                <select
                                  value={dock.type}
                                  onChange={e => handleUpdateDockField(dock.id, 'type', e.target.value)}
                                  className="px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-bold"
                                >
                                  <option value="PALETIZADA">PALETIZADA</option>
                                  <option value="BATIDA">BATIDA</option>
                                  <option value="REFRIGERADA">REFRIGERADA</option>
                                  <option value="FRACIONADA">FRACIONADA</option>
                                  <option value="PERIGOSA">PERIGOSA</option>
                                </select>
                                <button
                                  onClick={() => {
                                    commitDockIdEdit();
                                    setEditingDockId(null);
                                  }}
                                  className="p-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                                  title="Concluir edição"
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
                                  onClick={() => beginDockEdit(dock.id)}
                                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                                  title="Editar nome, ID e tipo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleToggleDockOperational(dock.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              dock.isOperational
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                            }`}
                          >
                            {dock.isOperational ? 'Ativa' : 'Em Manutenção'}
                          </button>

                          <button
                            onClick={() => handleRemoveDock(dock.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Excluir Doca desta Loja"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Configurações Modulares da Doca */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-slate-600">Veículos / Janela:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={dock.capacityPerSlot}
                            onChange={e =>
                              handleUpdateDockField(dock.id, 'capacityPerSlot', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-14 px-2 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-800"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-slate-600">Limite Diário:</span>
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={dock.dailyLimit || 100}
                            onChange={e =>
                              handleUpdateDockField(dock.id, 'dailyLimit', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-16 px-2 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-800"
                          />
                          <span className="text-[11px] text-slate-500 font-medium">
                            {dock.limitUnit || 'pallets'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          </>
          )}

        </div>

        {/* Alerta de erro ou requisição de autenticação sem perda de dados */}
        {saveError && (
          <div className="bg-rose-50 border-t border-rose-200 px-6 py-3 shrink-0">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-800">
                <p className="font-bold">{saveError}</p>
                {needsAuth && (
                  <form onSubmit={handleInlineAuthenticate} className="mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Sua senha ou PIN..."
                        value={authPinOrPassword}
                        onChange={e => setAuthPinOrPassword(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 focus:outline-blue-500 w-44 font-medium"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isReauthenticating || !authPinOrPassword.trim()}
                      className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isReauthenticating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Autenticar & Salvar</span>
                        </>
                      )}
                    </button>
                    {onRequestAdminAuth && (
                      <button
                        type="button"
                        onClick={onRequestAdminAuth}
                        className="text-xs text-blue-700 hover:underline font-semibold ml-1 cursor-pointer"
                      >
                        Abrir tela de login completa
                      </button>
                    )}
                    {authError && (
                      <span className="text-xs text-rose-600 font-semibold block w-full mt-1">
                        {authError}
                      </span>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rodapé / Ações */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Configurações manuais da loja salvas com sucesso!
              </span>
            ) : (
              <span>
                Configurando <strong>"{selectedBranch?.name || 'Loja Selecionada'}"</strong> individualmente
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving || savedSuccess}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Configurações Aplicadas!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Configurações da Loja'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
