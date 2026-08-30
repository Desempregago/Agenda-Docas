import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, LogIn, Building2, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export interface SupplierSession {
  cnpj: string;
  name: string;
}

interface SupplierLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (session: SupplierSession) => void;
  availableSuppliers?: { name: string; cnpj: string }[];
}

export const SupplierLoginModal: React.FC<SupplierLoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [cnpjInput, setCnpjInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isRecognized, setIsRecognized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Format CNPJ as user types: 00.000.000/0000-00
  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

  // Lookup CNPJ in server database when CNPJ is complete
  useEffect(() => {
    const cleanDigits = cnpjInput.replace(/\D/g, '');
    if (cleanDigits.length >= 11) {
      let isMounted = true;
      setIsSearching(true);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suppliers/lookup/${cleanDigits}`);
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.found && data.supplier) {
              setNameInput(data.supplier.name);
              setIsRecognized(true);
              setError('');
            }
          } else if (isMounted) {
            setIsRecognized(false);
          }
        } catch (_) {
          if (isMounted) setIsRecognized(false);
        } finally {
          if (isMounted) setIsSearching(false);
        }
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setIsRecognized(false);
      setIsSearching(false);
    }
  }, [cnpjInput]);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnpjInput.trim()) {
      setError('Por favor, informe o CNPJ da sua empresa.');
      return;
    }
    if (!nameInput.trim()) {
      setError('Por favor, informe a Razão Social da sua empresa.');
      return;
    }
    setError('');
    onLogin({
      cnpj: cnpjInput.trim(),
      name: nameInput.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Portal do Fornecedor
              </h2>
              <p className="text-xs text-slate-300">
                Acesso seguro e gestão de agendamentos de carga
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Form Manual Login */}
          <form onSubmit={handleCustomSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  CNPJ do Fornecedor / Transportadora
                </label>
                {isSearching && (
                  <span className="text-[11px] text-blue-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={cnpjInput}
                onChange={e => setCnpjInput(formatCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Razão Social / Nome da Empresa
                </label>
                {isRecognized && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fornecedor Reconhecido
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder={isRecognized ? nameInput : "Ex: Eurofarma Laboratórios S.A."}
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border transition-all ${
                  isRecognized
                    ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-semibold focus:ring-2 focus:ring-emerald-500'
                    : 'border-slate-300 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400'
                }`}
              />
              {!isRecognized && cnpjInput.length > 5 && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Ao acessar pela primeira vez, sua empresa será cadastrada automaticamente.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <LogIn className="w-4 h-4" />
              {isRecognized ? 'Entrar com meu Cadastro' : 'Autenticar & Cadastrar Fornecedor'}
            </button>
          </form>

          {/* Security footnote */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-600 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              O login com CNPJ isola seus dados e agendamentos. Apenas as notas fiscais e status vinculados à sua empresa ficarão visíveis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
