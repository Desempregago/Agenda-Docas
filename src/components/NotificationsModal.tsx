import React, { useState } from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Clock, Truck, ShieldAlert, ArrowRight, Trash2, User, Filter, Calendar } from 'lucide-react';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'STATUS_CHANGE' | 'NEW_APPOINTMENT' | 'RESCHEDULE' | 'GATE_ENTRY' | 'DISCREPANCY' | 'SYSTEM';
  protocol?: string;
  supplierCnpj?: string;
  userId?: string;
  operatorId?: string;
  operatorName?: string;
  read: boolean;
}

export function isAppointmentNotification(notif: AppNotification): boolean {
  return (
    Boolean(notif.protocol) ||
    notif.type === 'STATUS_CHANGE' ||
    notif.type === 'NEW_APPOINTMENT' ||
    notif.type === 'RESCHEDULE' ||
    notif.type === 'GATE_ENTRY' ||
    notif.type === 'DISCREPANCY'
  );
}

interface NotificationsModalProps {
  isOpen: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  onSelectProtocol?: (protocol: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkAllAsRead,
  onClearNotifications,
  onSelectProtocol,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'APPOINTMENTS' | 'OPERATIONAL'>('ALL');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(item => {
    if (filterType === 'APPOINTMENTS') {
      return isAppointmentNotification(item);
    }
    if (filterType === 'OPERATIONAL') {
      return !isAppointmentNotification(item);
    }
    return true;
  });

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'GATE_ENTRY':
        return <Truck className="w-4 h-4 text-blue-500" />;
      case 'DISCREPANCY':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'RESCHEDULE':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Central de Notificações</h2>
                {unreadCount > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Agendamentos operacionais em tempo real e avisos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Filter Tabs */}
        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('APPOINTMENTS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 whitespace-nowrap ${
                filterType === 'APPOINTMENTS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Agendamentos ({notifications.filter(isAppointmentNotification).length})
            </button>
            <button
              onClick={() => setFilterType('OPERATIONAL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 whitespace-nowrap ${
                filterType === 'OPERATIONAL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <User className="w-3 h-3" />
              Operador / Sistema ({notifications.filter(n => !isAppointmentNotification(n)).length})
            </button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <button
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:hover:text-slate-600 transition-colors"
          >
            Marcar todas como lidas
          </button>
          <button
            onClick={onClearNotifications}
            disabled={notifications.length === 0}
            className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-rose-600 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar tudo
          </button>
        </div>

        {/* List of Notifications */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma notificação encontrada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filterType === 'ALL'
                  ? 'Você receberá alertas automáticos sempre que houver atualização nos agendamentos, chegada de caminhões na portaria ou conferência de docas.'
                  : 'Não há itens para o filtro selecionado no momento.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item, nIdx) => {
              const isAppt = isAppointmentNotification(item);
              return (
                <div
                  key={`notif-${item.id}-${nIdx}`}
                  className={`p-4 transition-colors flex items-start gap-3 ${
                    !item.read ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                        {isAppt ? (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                            Agendamento
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" />
                            {item.operatorName ? item.operatorName : 'Operador / Sistema'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>

                    {item.protocol && onSelectProtocol && (
                      <button
                        onClick={() => {
                          onSelectProtocol(item.protocol!);
                          onClose();
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <span>Ver Protocolo {item.protocol}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Agendamentos visíveis para toda a equipe operacional</span>
          <span className="text-[10px] font-medium text-slate-400">Tempo real</span>
        </div>

      </div>
    </div>
  );
};
