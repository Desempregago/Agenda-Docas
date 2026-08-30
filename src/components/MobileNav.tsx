import React from 'react';
import { Calendar, Search, LayoutDashboard, Database, Plus } from 'lucide-react';
import { AppViewMode, UserRole } from './Header';
import { SystemUser } from '../types';

interface MobileNavProps {
  currentView: AppViewMode;
  userRole: UserRole;
  currentSystemUser?: SystemUser | null;
  onSelectView: (view: AppViewMode) => void;
  onToggleRole: (role: UserRole) => void;
  onOpenNewModal: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  userRole,
  currentSystemUser,
  onSelectView,
  onToggleRole,
  onOpenNewModal,
}) => {
  const isStaff = userRole === 'ADMIN' || Boolean(currentSystemUser);
  const isUserAdmin = Boolean(currentSystemUser ? currentSystemUser.role === 'ADMIN' : userRole === 'ADMIN');

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
    >
      {isUserAdmin ? (
        <div className="grid grid-cols-5 items-center text-center text-xs max-w-lg mx-auto">
          {/* Tab 1: Agendar */}
          <button
            onClick={() => onSelectView('CLIENT')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'CLIENT' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Agendar</span>
          </button>

          {/* Tab 2: Rastrear */}
          <button
            onClick={() => onSelectView('TRACKING')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'TRACKING' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Rastrear</span>
          </button>

          {/* Floating Center Button */}
          <div className="flex items-center justify-center -mt-4">
            <button
              onClick={onOpenNewModal}
              className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 border-2 border-slate-900"
              title="Criar Novo Agendamento"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Tab 4: Gestão Docas */}
          <button
            onClick={() => onSelectView('ADMIN')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'ADMIN' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Docas</span>
          </button>

          {/* Tab 5: Sistema / Backups */}
          <button
            onClick={() => onSelectView('SYSTEM')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'SYSTEM' ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Sistema</span>
          </button>
        </div>
      ) : isStaff ? (
        <div className="grid grid-cols-4 items-center text-center text-xs max-w-md mx-auto">
          {/* Tab 1: Agendar */}
          <button
            onClick={() => onSelectView('CLIENT')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'CLIENT' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Agendamentos</span>
          </button>

          {/* Tab 2: Rastrear */}
          <button
            onClick={() => onSelectView('TRACKING')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'TRACKING' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Rastrear</span>
          </button>

          {/* Tab 3: Docas */}
          <button
            onClick={() => onSelectView('ADMIN')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'ADMIN' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Docas</span>
          </button>

          {/* Tab 4: + Novo */}
          <button
            onClick={onOpenNewModal}
            className="flex flex-col items-center py-1 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Novo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 items-center text-center text-xs max-w-sm mx-auto">
          {/* Tab 1: Agendar */}
          <button
            onClick={() => onSelectView('CLIENT')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'CLIENT' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Agendamentos</span>
          </button>

          {/* Floating Center Button */}
          <div className="flex items-center justify-center -mt-4">
            <button
              onClick={onOpenNewModal}
              className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 border-2 border-slate-900"
              title="Criar Novo Agendamento"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Tab 2: Rastrear */}
          <button
            onClick={() => onSelectView('TRACKING')}
            className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
              currentView === 'TRACKING' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Rastreamento</span>
          </button>
        </div>
      )}
    </nav>
  );
};
