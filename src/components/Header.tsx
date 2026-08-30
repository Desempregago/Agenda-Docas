import React, { useState } from 'react';
import { Calendar, Search, LayoutDashboard, Server, Plus, UserCheck, ShieldAlert, ChevronRight, Settings, Bell, Lock, LogOut, Users, User, Menu, X, Database, MapPin } from 'lucide-react';
import { BrandSettings, getBrandTheme } from './BrandingSettingsModal';
import { SystemUser } from '../types';

export type AppViewMode = 'CLIENT' | 'TRACKING' | 'ADMIN' | 'SYSTEM';
export type UserRole = 'CLIENT' | 'ADMIN';

interface HeaderProps {
  currentView: AppViewMode;
  userRole: UserRole;
  currentSystemUser?: SystemUser | null;
  currentSupplierSession?: { cnpj: string; name?: string } | null;
  brandSettings: BrandSettings;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onSelectView: (view: AppViewMode) => void;
  onToggleRole: (role: UserRole) => void;
  onLogoutAdmin?: () => void;
  onRequestAdminAccess: () => void;
  onOpenNewModal: () => void;
  onOpenBrandingModal: () => void;
  onOpenUsersModal?: () => void;
  onOpenDestinationsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  userRole,
  currentSystemUser,
  currentSupplierSession,
  brandSettings,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onSelectView,
  onToggleRole,
  onLogoutAdmin,
  onRequestAdminAccess,
  onOpenNewModal,
  onOpenBrandingModal,
  onOpenUsersModal,
  onOpenDestinationsModal,
}) => {
  const brandTheme = getBrandTheme(brandSettings.primaryColor);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isStaff = userRole === 'ADMIN' || Boolean(currentSystemUser);
  const isUserAdmin = Boolean(currentSystemUser ? currentSystemUser.role === 'ADMIN' : userRole === 'ADMIN');
  const isLoggedIn = isStaff || Boolean(currentSupplierSession);

  const handleNavClick = (view: AppViewMode) => {
    onSelectView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md w-full">
      <div className="max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 w-full">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 w-full">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0 min-w-0" 
            onClick={() => handleNavClick('CLIENT')}
            title="Ir para o início"
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr ${brandTheme.gradient} flex items-center justify-center shadow-md text-white font-bold text-sm sm:text-base overflow-hidden shrink-0 border border-slate-700/80 transition-all duration-300`}>
              {brandSettings.logoUrl ? (
                <img src={brandSettings.logoUrl} alt={brandSettings.appName} className="w-full h-full object-contain p-0.5" />
              ) : (
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              )}
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm lg:text-base tracking-tight text-white truncate max-w-[130px] sm:max-w-[180px] md:max-w-[240px]">
                  {brandSettings.appName || 'Agendamento'}
                </span>
                <span className={`text-[9px] font-semibold ${brandTheme.badge} px-1.5 py-0.2 rounded-full hidden sm:inline-block shrink-0`}>
                  Portal
                </span>
              </div>
              {brandSettings.appSubtitle && (
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-normal truncate max-w-[130px] sm:max-w-[190px] md:max-w-[280px] leading-tight block">
                  {brandSettings.appSubtitle}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shrink-0">
            <button
              onClick={() => onSelectView('CLIENT')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'CLIENT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Agendamentos</span>
            </button>

            <button
              onClick={() => onSelectView('TRACKING')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'TRACKING'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>Rastreamento</span>
            </button>

            {isStaff && (
              <>
                <button
                  onClick={() => onSelectView('ADMIN')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    currentView === 'ADMIN'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Visão geral e operação de docas"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                  <span>Docas</span>
                </button>

                {isUserAdmin && (
                  <button
                    onClick={() => onSelectView('SYSTEM')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      currentView === 'SYSTEM'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                    title="Backups, Exportações e Status do Sistema (Exclusivo Administrador)"
                  >
                    <Database className="w-3.5 h-3.5 shrink-0" />
                    <span>Sistema</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Action Buttons & Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            
            {/* Notification Bell Button (Exibido apenas após autenticação do operador ou fornecedor) */}
            {isLoggedIn && onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="relative p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-xs"
                title="Central de Notificações e Alertas"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center animate-pulse border border-slate-900">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Desktop Admin Options (Exibido EXCLUSIVAMENTE para Administradores) */}
            {isUserAdmin && (
              <div className="hidden lg:flex items-center gap-1">
                {onOpenDestinationsModal && (
                  <button
                    onClick={onOpenDestinationsModal}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-slate-700 transition-colors shadow-xs"
                    title="Configurar unidades de destino e filiais de entrega"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="hidden 2xl:inline">Destinos</span>
                  </button>
                )}

                <button
                  onClick={onOpenUsersModal}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-slate-700 transition-colors shadow-xs"
                  title="Gerenciar usuários, operadores e PINs de acesso"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden 2xl:inline">Usuários</span>
                </button>

                <button
                  onClick={onOpenBrandingModal}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-slate-700 transition-colors shadow-xs"
                  title="Personalizar nome e logotipo da empresa"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="hidden 2xl:inline">Marca</span>
                </button>
              </div>
            )}

            {/* Role / Access Control Button */}
            <div className="flex items-center bg-slate-800 border border-slate-700/80 rounded-xl p-0.5 sm:p-1 text-xs shrink-0">
              {isStaff ? (
                <div className="flex items-center gap-1">
                  {isUserAdmin ? (
                    <span 
                      className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-purple-300 px-1.5 py-0.5 rounded-lg bg-purple-950/80 border border-purple-800" 
                      title={currentSystemUser ? `${currentSystemUser.name} (Administrador Geral - ${currentSystemUser.department})` : 'Administrador Geral'}
                    >
                      <ShieldAlert className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="max-w-[45px] sm:max-w-[80px] truncate">{currentSystemUser ? currentSystemUser.name.split(' ')[0] : 'Admin'}</span>
                    </span>
                  ) : (
                    <span 
                      className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-cyan-300 px-1.5 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800" 
                      title={currentSystemUser ? `${currentSystemUser.name} (Operador - ${currentSystemUser.department})` : 'Operador de Docas'}
                    >
                      <UserCheck className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="max-w-[45px] sm:max-w-[80px] truncate">{currentSystemUser ? currentSystemUser.name.split(' ')[0] : 'Operador'}</span>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (onLogoutAdmin) {
                        onLogoutAdmin();
                      } else {
                        onToggleRole('CLIENT');
                        onSelectView('CLIENT');
                      }
                    }}
                    className="flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 rounded-lg transition-all cursor-pointer shrink-0"
                    title={isUserAdmin ? 'Encerrar sessão de Administrador' : 'Encerrar sessão de Operador'}
                  >
                    <LogOut className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={onRequestAdminAccess}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all text-xs cursor-pointer shrink-0"
                  title="Acesso restrito para operadores de doca e administradores"
                >
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Operação</span>
                </button>
              )}
            </div>

            {/* New Scheduling Modal Button - Hidden on mobile, as MobileNav provides the central action button */}
            <button
              onClick={onOpenNewModal}
              className="hidden sm:inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Agendar</span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
              aria-label="Abrir menu mobile"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>

        </div>
      </div>

      {/* Mobile Drawer Overlay & Panel */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-start">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Menu Panel */}
          <div className="relative bg-slate-900 border-b border-slate-700 shadow-2xl z-10 w-full max-h-[85vh] overflow-y-auto px-4 py-4 space-y-4 animate-in slide-in-from-top-3 duration-200">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${brandTheme.gradient} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                  {brandSettings.appName ? brandSettings.appName.charAt(0).toUpperCase() : 'G'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">{brandSettings.appName || 'Menu'}</h3>
                  <span className="text-[11px] text-slate-400">Navegação & Ferramentas</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Section */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Telas & Visões</p>
              
              <button
                onClick={() => handleNavClick('CLIENT')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentView === 'CLIENT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Painel de Agendamentos</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              <button
                onClick={() => handleNavClick('TRACKING')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentView === 'TRACKING'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-blue-400" />
                  <span>Rastrear Protocolo de Entrega</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              {isStaff && (
                <>
                  <button
                    onClick={() => handleNavClick('ADMIN')}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      currentView === 'ADMIN'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                      <span>Controle de Docas & Janelas</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>

                  {isUserAdmin && (
                    <button
                      onClick={() => handleNavClick('SYSTEM')}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all ${
                        currentView === 'SYSTEM'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span>Gestão de Backups & Sistema</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tools & Integrations (Exclusivo Administradores) */}
            {isUserAdmin && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Ferramentas de Gestão</p>
                
                {onOpenDestinationsModal && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenDestinationsModal();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Configurar Unidades de Destino & Filiais</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                )}

                {onOpenUsersModal && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenUsersModal();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Gerenciar Usuários & Operadores</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                )}

                {onOpenBrandingModal && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenBrandingModal();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>Personalizar Marca da Empresa</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Access Mode Switch */}
            <div className="pt-2 border-t border-slate-800">
              {isStaff ? (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onLogoutAdmin) {
                      onLogoutAdmin();
                    } else {
                      onToggleRole('CLIENT');
                      onSelectView('CLIENT');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do Modo {isUserAdmin ? 'Administrador' : 'Operador'} ({currentSystemUser ? currentSystemUser.name.split(' ')[0] : 'Staff'})</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onRequestAdminAccess();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Acessar Modo Operador / Portaria</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </header>
  );
};

