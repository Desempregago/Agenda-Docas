import React, { useState } from 'react';
import { Settings, Image, Upload, RotateCcw, X, Check, Building, Palette, Sparkles, Server, HardDrive } from 'lucide-react';

export interface BrandSettings {
  appName: string;
  appSubtitle: string;
  logoUrl?: string;
  primaryColor: string; // Tailwind color theme identifier
}

export interface BrandColorOption {
  id: string;
  name: string;
  bg: string;
  gradient: string;
  border: string;
  badge: string;
  accent: string;
}

export const BRAND_COLOR_OPTIONS: BrandColorOption[] = [
  {
    id: 'blue',
    name: 'Azul Padrão',
    bg: 'bg-blue-600',
    gradient: 'from-blue-600 to-indigo-600',
    border: 'border-blue-500/50',
    badge: 'bg-blue-900/80 text-blue-200 border-blue-700/60',
    accent: 'text-blue-400',
  },
  {
    id: 'indigo',
    name: 'Índigo Marítimo',
    bg: 'bg-indigo-600',
    gradient: 'from-indigo-600 to-purple-600',
    border: 'border-indigo-500/50',
    badge: 'bg-indigo-900/80 text-indigo-200 border-indigo-700/60',
    accent: 'text-indigo-400',
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    bg: 'bg-emerald-600',
    gradient: 'from-emerald-600 to-teal-600',
    border: 'border-emerald-500/50',
    badge: 'bg-emerald-900/80 text-emerald-200 border-emerald-700/60',
    accent: 'text-emerald-400',
  },
  {
    id: 'slate',
    name: 'Cinza Grafite',
    bg: 'bg-slate-700',
    gradient: 'from-slate-700 to-slate-900',
    border: 'border-slate-500/50',
    badge: 'bg-slate-800 text-slate-200 border-slate-600/60',
    accent: 'text-slate-300',
  },
  {
    id: 'amber',
    name: 'Âmbar Dourado',
    bg: 'bg-amber-600',
    gradient: 'from-amber-600 to-orange-600',
    border: 'border-amber-500/50',
    badge: 'bg-amber-950/80 text-amber-200 border-amber-700/60',
    accent: 'text-amber-400',
  },
  {
    id: 'rose',
    name: 'Rubi Carmim',
    bg: 'bg-rose-600',
    gradient: 'from-rose-600 to-pink-600',
    border: 'border-rose-500/50',
    badge: 'bg-rose-950/80 text-rose-200 border-rose-700/60',
    accent: 'text-rose-400',
  },
];

export const getBrandTheme = (colorId?: string): BrandColorOption => {
  const match = BRAND_COLOR_OPTIONS.find(c => c.id === colorId);
  return match || BRAND_COLOR_OPTIONS[0];
};

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  appName: 'Agendamento',
  appSubtitle: 'Agendamento de Cargas e Gestão Operacional de Docas',
  logoUrl: '',
  primaryColor: 'blue',
};

interface BrandingSettingsModalProps {
  isOpen: boolean;
  settings: BrandSettings;
  onClose: () => void;
  onSave: (newSettings: BrandSettings) => void;
}

export const BrandingSettingsModal: React.FC<BrandingSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<BrandSettings>(settings);
  const [previewLogo, setPreviewLogo] = useState<string>(settings.logoUrl || '');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem selecionada deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewLogo(result);
        setForm(prev => ({ ...prev, logoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setCopiedSuccess(true);
    setTimeout(() => {
      setCopiedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setForm(DEFAULT_BRAND_SETTINGS);
    setPreviewLogo('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Personalização de Marca e Logo</h2>
              <p className="text-xs text-slate-300">
                Altere o nome da empresa, slogans e logotipo exibidos no cabeçalho e sistema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {/* Brand Name & Subtitle */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome da Plataforma / Empresa
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={form.appName}
                  onChange={e => setForm({ ...form, appName: e.target.value })}
                  placeholder="Ex: AgendaDocas, LogiPort, Docas Express..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold text-slate-900"
                />
                <Building className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Subtítulo / Descrição Curta
              </label>
              <input
                type="text"
                value={form.appSubtitle}
                onChange={e => setForm({ ...form, appSubtitle: e.target.value })}
                placeholder="Ex: Agendamento de Cargas e Gestão Operacional de Docas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-800"
              />
            </div>
          </div>

          {/* Logo Upload Section */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Logotipo da Empresa (Imagem / Icone)
            </label>

            <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              {/* Logo Preview Container */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${getBrandTheme(form.primaryColor).gradient} border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md transition-all duration-300`}>
                {previewLogo ? (
                  <img src={previewLogo} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                ) : (
                  <div className="text-center p-1">
                    <Sparkles className="w-6 h-6 text-white/90 mx-auto drop-shadow-sm" />
                    <span className="text-[9px] font-bold text-white/90 block mt-0.5">Ícone Padrão</span>
                  </div>
                )}
              </div>

              {/* Upload & URL Controls */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs">
                    <Upload className="w-4 h-4" />
                    <span>Carregar do Computador</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {previewLogo && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLogo('');
                        setForm(prev => ({ ...prev, logoUrl: '' }));
                      }}
                      className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      Remover Imagem
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={form.logoUrl || ''}
                    onChange={e => {
                      setForm({ ...form, logoUrl: e.target.value });
                      setPreviewLogo(e.target.value);
                    }}
                    placeholder="Cole o URL ou caminho relativo (ex: /logo.png ou https://...)"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-700 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Caminhos locais/servidor aceitos (ex: <code className="bg-slate-200 px-1 rounded text-slate-800">/logo.png</code>) ou upload em Base64.
                </p>
              </div>
            </div>
          </div>

          {/* Local On-Premise Architecture Section */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-4 h-4 text-emerald-600" />
                Infraestrutura On-Premise / Servidor Local
              </label>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                100% Local
              </span>
            </div>
            
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  Operação Desconectada da Nuvem
                </p>
                <p>
                  Todos os cadastros, agendamentos e registros de docas são gravados diretamente no banco de dados SQL do seu servidor local.
                </p>
              </div>
            </div>
          </div>

          {/* Color Theme Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Destaque de Cor da Marca (Fundo da Logo e Acentos)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BRAND_COLOR_OPTIONS.map(color => {
                const isSelected = form.primaryColor === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setForm({ ...form, primaryColor: color.id })}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/30 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-4 h-4 rounded-full bg-gradient-to-tr ${color.gradient} shrink-0 shadow-xs border border-white/50`} />
                      <span className="truncate">{color.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Header Preview */}
          <div className="p-3.5 bg-slate-900 rounded-xl text-white space-y-2 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Pré-visualização do Cabeçalho
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Tema: <strong className="text-slate-200">{getBrandTheme(form.primaryColor).name}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr ${getBrandTheme(form.primaryColor).gradient} flex items-center justify-center shrink-0 overflow-hidden shadow-md border border-slate-700/80 transition-all duration-300`}>
                {previewLogo ? (
                  <img src={previewLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm leading-tight text-white truncate">
                    {form.appName || 'Nome da Empresa'}
                  </span>
                  <span className={`text-[9px] font-semibold ${getBrandTheme(form.primaryColor).badge} px-1.5 py-0.2 rounded-full inline-block shrink-0`}>
                    Portal
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate block mt-0.5 leading-tight">
                  {form.appSubtitle || 'Subtítulo da plataforma / Gestão de Docas'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Padrão
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-md transition-all active:scale-95"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Salvo com Sucesso!</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
