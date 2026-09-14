import React, { useState, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { KeyRound, X, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { SystemUser } from '../types';
import { authFetch } from '../services/api';

interface MyAccountModalProps {
  isOpen: boolean;
  currentUser: SystemUser | null;
  onClose: () => void;
  onUserUpdated?: (updatedUser: SystemUser) => void;
  onShowToast?: (title: string, desc: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * "Minha Conta" — allows the logged-in operator/admin to change their own
 * password or PIN. Re-authentication with the current secret is required;
 * identity comes from the server session, never from this form.
 */
export const MyAccountModal: React.FC<MyAccountModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onUserUpdated,
  onShowToast
}) => {
  useBodyScrollLock(isOpen);
  const [currentSecret, setCurrentSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulário sempre limpo a cada abertura (nada persiste entre sessões).
  useEffect(() => {
    if (isOpen) {
      setCurrentSecret('');
      setNewSecret('');
      setConfirmSecret('');
      setShowSecrets(false);
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const newIsPin = /^\d{4,8}$/.test(newSecret);
  const newIsValid = newSecret.length >= 6 || newIsPin;
  const confirmMatches = newSecret === confirmSecret;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentSecret.trim()) {
      setError('Informe sua senha ou PIN atual.');
      return;
    }
    if (!newIsValid) {
      setError('A nova senha deve ter no mínimo 6 caracteres — ou ser um PIN numérico de 4 a 8 dígitos.');
      return;
    }
    if (!confirmMatches) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }
    if (newSecret === currentSecret) {
      setError('A nova credencial deve ser diferente da atual.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSecret: currentSecret.trim(), newSecret: newSecret.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        if (data.user) onUserUpdated?.(data.user);
        onShowToast?.('Credencial Atualizada', 'Sua senha de acesso foi alterada com sucesso.', 'success');
        setTimeout(() => onClose(), 1400);
      } else {
        setError(data.error || 'Não foi possível alterar a credencial.');
      }
    } catch (_) {
      setError('Erro ao comunicar com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputType = showSecrets ? 'text' : 'password';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Minha Conta</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser ? `${currentUser.name} (@${currentUser.username})` : 'Alterar minha credencial de acesso'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-bold text-slate-900">Credencial atualizada!</p>
              <p className="text-xs text-slate-500">Use a nova credencial no próximo login.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-xl p-3">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <span>
                  Para sua segurança, confirme sua senha ou PIN atual antes de definir um novo.
                  A nova credencial pode ser uma senha (mín. 6 caracteres) ou um PIN numérico (4–8 dígitos).
                </span>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Credencial atual</span>
                <input
                  type={inputType}
                  value={currentSecret}
                  onChange={e => setCurrentSecret(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900"
                  placeholder="Sua senha ou PIN atual"
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nova credencial</span>
                <input
                  type={inputType}
                  value={newSecret}
                  onChange={e => setNewSecret(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900"
                  placeholder="Nova senha (mín. 6) ou PIN (4–8 dígitos)"
                  autoComplete="new-password"
                  disabled={submitting}
                />
                {newSecret.length > 0 && (
                  <span className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${newIsPin ? 'bg-indigo-50 text-indigo-700' : newSecret.length >= 6 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {newIsPin ? 'Formato de PIN detectado' : newSecret.length >= 6 ? 'Senha válida' : `Mínimo de 6 caracteres (${newSecret.length}/6)`}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Confirmar nova credencial</span>
                <input
                  type={inputType}
                  value={confirmSecret}
                  onChange={e => setConfirmSecret(e.target.value)}
                  className={`mt-1 w-full px-3.5 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 ${confirmSecret.length > 0 && !confirmMatches ? 'border-rose-400' : 'border-slate-300'}`}
                  placeholder="Repita a nova credencial"
                  autoComplete="new-password"
                  disabled={submitting}
                />
                {confirmSecret.length > 0 && (
                  <span className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${confirmMatches ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {confirmMatches ? 'Confere ✓' : 'Não confere'}
                  </span>
                )}
              </label>

              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSecrets}
                  onChange={e => setShowSecrets(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                Mostrar credenciais
              </label>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 font-medium">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Alterando…
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      Alterar credencial
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
