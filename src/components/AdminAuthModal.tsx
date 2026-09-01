import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, KeyRound, AlertCircle, X, CheckCircle2, User, UserPlus, Sparkles, Building2 } from 'lucide-react';
import { SystemUser } from '../types';
import { authFetch, setAuthToken } from '../services/api';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (user: SystemUser, token?: string) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate,
}) => {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Setup form fields (for initial admin setup if no users exist in database)
  const [setupName, setSetupName] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupDepartment, setSetupDepartment] = useState('Coordenação de Logística');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPin, setSetupPin] = useState('');

  // Check auth status on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setPassword('');
      setLoading(true);

      authFetch('/api/auth/status')
        .then(res => res.json())
        .then(data => {
          if (!data.hasUsers) {
            setIsSetupMode(true);
          } else {
            setIsSetupMode(false);
          }
        })
        .catch(() => {
          setIsSetupMode(false);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Login Authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || undefined,
          password: password.trim(),
          pin: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        if (data.token) {
          setAuthToken(data.token);
        }
        setErrorMessage(null);
        setPassword('');
        setUsername('');
        onAuthenticate(data.user, data.token);
        onClose();
      } else {
        if (data.needsSetup) {
          setIsSetupMode(true);
          setErrorMessage('Nenhum usuário cadastrado no banco. Configure o administrador inicial.');
        } else {
          setErrorMessage(data.error || 'Credenciais de acesso incorretas.');
        }
      }
    } catch (_) {
      setErrorMessage('Falha ao comunicar com o servidor de autenticação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Initial Setup of Admin in Database
  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    if (!setupPassword.trim() && !setupPin.trim()) {
      setErrorMessage('Defina uma senha ou PIN de acesso para o administrador.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await authFetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: setupName.trim(),
          username: setupUsername.trim(),
          email: setupEmail.trim() || undefined,
          department: setupDepartment.trim(),
          password: setupPassword.trim() || undefined,
          pin: setupPin.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        if (data.token) {
          setAuthToken(data.token);
        }
        setErrorMessage(null);
        onAuthenticate(data.user, data.token);
        onClose();
      } else {
        setErrorMessage(data.error || 'Erro ao registrar administrador inicial.');
      }
    } catch (_) {
      setErrorMessage('Falha de rede ao configurar administrador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              {isSetupMode ? <Sparkles className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isSetupMode ? 'Configuração Inicial de Acesso' : 'Acesso Restrito - Área Operacional'}
              </h3>
              <p className="text-xs text-slate-300">
                {isSetupMode
                  ? 'Cadastre o primeiro Administrador no banco de dados'
                  : 'Autentique-se com seu login de operador ou PIN cadastrado'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body: Login OR Setup */}
        {!isSetupMode ? (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                Usuário / Matrícula / E-mail
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Ex: joao.silva ou 10240"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                Senha de Acesso ou PIN Cadastrado *
              </label>
              <input
                type="password"
                required
                placeholder="Digite a senha ou PIN..."
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 text-xs text-slate-600 hover:text-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Autenticando...' : 'Entrar'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSetupAdmin} className="p-6 space-y-3.5">
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Primeiro Acesso ao Sistema
              </span>
              <p className="text-[11px] text-blue-700">
                Nenhum usuário foi encontrado no banco. Cadastre as credenciais do Administrador Geral para assumir o controle do sistema.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Marcelo Oliveira"
                value={setupName}
                onChange={e => setSetupName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Usuário / Login *</label>
                <input
                  type="text"
                  required
                  placeholder="marcelo.admin"
                  value={setupUsername}
                  onChange={e => setSetupUsername(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Setor</label>
                <input
                  type="text"
                  placeholder="Logística / CD"
                  value={setupDepartment}
                  onChange={e => setSetupDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo</label>
              <input
                type="email"
                placeholder="marcelo@empresa.com.br"
                value={setupEmail}
                onChange={e => setSetupEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha Master *</label>
                <input
                  type="password"
                  placeholder="Crie uma senha..."
                  value={setupPassword}
                  onChange={e => setSetupPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PIN Rápido (Opcional)</label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Ex: 9988"
                  value={setupPin}
                  onChange={e => setSetupPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 text-xs text-slate-600 hover:text-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Cadastrando...' : 'Criar & Acessar'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
