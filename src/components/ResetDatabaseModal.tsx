import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  Database,
  CheckCircle2,
  ShieldAlert,
  HardDrive,
  Users,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { authFetch } from '../services/api';
import { SystemUser } from '../types';

interface ResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentsCount: number;
  onClearAppointments: (adminPassword: string) => Promise<void>;
  onFactoryReset: (adminPassword: string) => Promise<void>;
  onResetUsers: (adminPassword: string) => Promise<void>;
  currentSystemUser?: SystemUser | null;
}

export const ResetDatabaseModal: React.FC<ResetDatabaseModalProps> = ({
  isOpen,
  onClose,
  appointmentsCount,
  onClearAppointments,
  onFactoryReset,
  onResetUsers,
  currentSystemUser,
}) => {
  const [selectedAction, setSelectedAction] = useState<'CLEAR_APPTS' | 'FACTORY_RESET' | 'RESET_USERS' | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAction(null);
      setAdminPassword('');
      setShowPassword(false);
      setFormError(null);
      setSuccessMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleExecute = async () => {
    if (!selectedAction) return;

    if (!adminPassword.trim()) {
      setFormError('Informe a senha ou PIN de Administrador Geral para autorizar a operação.');
      return;
    }

    setLoading(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      // 1. Verify General Admin Password first
      const verifyRes = await authFetch('/api/auth/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword.trim() }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => null);
        setFormError(errData?.error || 'Senha ou PIN de Administrador Geral incorreto.');
        setLoading(false);
        return;
      }

      // 2. Execute selected action with the verified admin password
      if (selectedAction === 'CLEAR_APPTS') {
        await onClearAppointments(adminPassword.trim());
        setSuccessMessage('Todos os agendamentos foram excluídos. A base está 100% limpa.');
      } else if (selectedAction === 'FACTORY_RESET') {
        await onFactoryReset(adminPassword.trim());
        setSuccessMessage('Base de dados, fornecedores e notificações foram zeradas com sucesso.');
      } else if (selectedAction === 'RESET_USERS') {
        await onResetUsers(adminPassword.trim());
        setSuccessMessage('Base de usuários zerada com sucesso. O sistema retornou ao estado inicial.');
      }

      setTimeout(() => {
        setSuccessMessage(null);
        setSelectedAction(null);
        setAdminPassword('');
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Ocorreu um erro ao processar a operação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        
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
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
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
              onClick={() => {
                if (!loading) {
                  setSelectedAction('CLEAR_APPTS');
                  setFormError(null);
                }
              }}
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
              onClick={() => {
                if (!loading) {
                  setSelectedAction('FACTORY_RESET');
                  setFormError(null);
                }
              }}
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
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Zerar Base Completa (Agendamentos, Fornecedores e Notificações)
                  </h4>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                    Avançado
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Limpa todos os agendamentos, lista de fornecedores cadastrados (suppliers.json), pastas por CNPJ e o histórico de notificações do sistema.
                </p>
              </div>
            </div>

            {/* Option 3: Reset Users (Replaces Seed Mock Data) */}
            <div
              onClick={() => {
                if (!loading) {
                  setSelectedAction('RESET_USERS');
                  setFormError(null);
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedAction === 'RESET_USERS'
                  ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                selectedAction === 'RESET_USERS' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Zerar base de Usuários
                  </h4>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Acessos & Contas
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Remove todos os administradores e operadores cadastrados. O sistema retornará ao estado de configuração inicial para cadastro de um novo Administrador Geral.
                </p>
              </div>
            </div>

          </div>

          {/* Mandatory General Admin Password Confirmation Box */}
          <div className={`p-4 rounded-xl border transition-all ${
            selectedAction
              ? 'bg-slate-50 border-slate-300 ring-1 ring-slate-300'
              : 'bg-slate-50/50 border-slate-200 opacity-80'
          }`}>
            <div className="flex items-start gap-2.5 mb-2">
              <div className="p-1.5 bg-slate-900 text-white rounded-lg shrink-0 mt-0.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Confirmação do Administrador Geral</span>
                  <span className="text-[10px] font-normal text-rose-600 font-semibold">(Obrigatório)</span>
                </h5>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Para autorizar qualquer alteração na base, confirme a senha ou PIN de um usuário com perfil <strong>Administrador Geral</strong>.
                </p>
              </div>
            </div>

            {currentSystemUser && (
              <div className="mb-2.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Operador atual: <strong>{currentSystemUser.name}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                  {currentSystemUser.role === 'ADMIN' ? 'Admin Geral' : 'Operador'}
                </span>
              </div>
            )}

            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => {
                  setAdminPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && selectedAction && adminPassword.trim() && !loading) {
                    handleExecute();
                  }
                }}
                placeholder="Digite a senha ou PIN do Administrador Geral"
                disabled={loading}
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {formError && (
              <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* Warning notice */}
          {selectedAction && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Atenção:</strong> Esta operação é irreversível e removerá os dados salvos no servidor local e em memória.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!selectedAction || !adminPassword.trim() || loading}
            onClick={handleExecute}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedAction === 'RESET_USERS'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {loading ? (
              <span>Validando e Processando...</span>
            ) : selectedAction === 'CLEAR_APPTS' ? (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Zerar Agendamentos</span>
              </>
            ) : selectedAction === 'FACTORY_RESET' ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Confirmar Limpeza Completa</span>
              </>
            ) : selectedAction === 'RESET_USERS' ? (
              <>
                <Users className="w-4 h-4" />
                <span>Confirmar Zerar Base de Usuários</span>
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
