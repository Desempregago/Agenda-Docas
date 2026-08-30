import React, { useState } from 'react';
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Database,
  CheckCircle2,
  Layers,
  Sparkles,
  ShieldAlert,
  HardDrive,
} from 'lucide-react';

interface ResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentsCount: number;
  onClearAppointments: () => Promise<void>;
  onFactoryReset: () => Promise<void>;
  onLoadMockData: () => Promise<void>;
}

export const ResetDatabaseModal: React.FC<ResetDatabaseModalProps> = ({
  isOpen,
  onClose,
  appointmentsCount,
  onClearAppointments,
  onFactoryReset,
  onLoadMockData,
}) => {
  const [selectedAction, setSelectedAction] = useState<'CLEAR_APPTS' | 'FACTORY_RESET' | 'SEED_MOCK' | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!selectedAction) return;
    setLoading(true);
    setSuccessMessage(null);
    try {
      if (selectedAction === 'CLEAR_APPTS') {
        await onClearAppointments();
        setSuccessMessage('Todos os agendamentos foram excluídos. A base está 100% limpa.');
      } else if (selectedAction === 'FACTORY_RESET') {
        await onFactoryReset();
        setSuccessMessage('Base de dados e notificações foram zeradas com sucesso.');
      } else if (selectedAction === 'SEED_MOCK') {
        await onLoadMockData();
        setSuccessMessage('Dados de teste carregados com sucesso.');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        setSelectedAction(null);
        onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600/30 text-rose-400 rounded-xl border border-rose-500/40">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Zerar / Gerenciar Base de Dados</h2>
              <p className="text-xs text-slate-300">
                Limpeza de registros, restauração e controle de dados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          
          {/* Status badge */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span className="font-semibold">Agendamentos Atualmente Cadastrados:</span>
            </div>
            <span className="font-mono font-bold text-sm bg-slate-200 text-slate-900 px-2.5 py-0.5 rounded-lg">
              {appointmentsCount} registro(s)
            </span>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-semibold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Escolha uma operação:
            </label>

            {/* Option 1: Clear Appointments */}
            <div
              onClick={() => setSelectedAction('CLEAR_APPTS')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedAction === 'CLEAR_APPTS'
                  ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                selectedAction === 'CLEAR_APPTS' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Zerar Apenas Agendamentos
                  </h4>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Exclui todos os {appointmentsCount} agendamentos, liberando instantaneamente 100% da capacidade de todas as docas. Mantém os usuários cadastrados e configurações de docas intactos.
                </p>
              </div>
            </div>

            {/* Option 2: Factory Reset */}
            <div
              onClick={() => setSelectedAction('FACTORY_RESET')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedAction === 'FACTORY_RESET'
                  ? 'border-red-600 bg-red-50 ring-2 ring-red-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                selectedAction === 'FACTORY_RESET' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'
              }`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Zerar Base Completa (Agendamentos, Fornecedores e Notificações)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Limpa todos os agendamentos, lista de fornecedores cadastrados (suppliers.json), pastas por CNPJ e o histórico de notificações do sistema.
                </p>
              </div>
            </div>

            {/* Option 3: Seed Mock Data */}
            <div
              onClick={() => setSelectedAction('SEED_MOCK')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedAction === 'SEED_MOCK'
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                selectedAction === 'SEED_MOCK' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Carregar Dados de Demonstração (5 agendamentos)
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Carrega agendamentos de exemplo com múltiplos fornecedores, notas fiscais e status variados para testar o painel de docas.
                </p>
              </div>
            </div>

          </div>

          {/* Warning */}
          {selectedAction && selectedAction !== 'SEED_MOCK' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Atenção:</strong> Esta ação apagará os registros gravados no servidor local e no banco de dados. Tenha certeza antes de confirmar.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!selectedAction || loading}
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedAction === 'SEED_MOCK'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {loading ? (
              <span>Processando...</span>
            ) : selectedAction === 'CLEAR_APPTS' ? (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Zerar Agendamentos</span>
              </>
            ) : selectedAction === 'FACTORY_RESET' ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Confirmar Limpeza Geral</span>
              </>
            ) : selectedAction === 'SEED_MOCK' ? (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Carregar Dados de Teste</span>
              </>
            ) : (
              <span>Selecione uma opção</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
