import React from 'react';
import { AppointmentStatus } from '../types';
import {
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  XCircle,
  PackageCheck,
  Building2,
  ShieldCheck,
  ArrowRightCircle
} from 'lucide-react';

interface StatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'md' | 'lg';
  isWalkIn?: boolean;
  isPreApprovedContract?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', isWalkIn, isPreApprovedContract }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'PENDENTE':
        return {
          label: 'Pendente de Aprovação',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Clock,
        };
      case 'CONFIRMADO':
        return {
          label: 'Agendamento Confirmado',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: CheckCircle2,
        };
      case 'EM_TRANSITO':
        return {
          label: 'Em Trânsito',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: Truck,
        };
      case 'NO_PATIO':
        return {
          label: 'Na Portaria / Pátio (Prevenção)',
          bg: 'bg-purple-50 text-purple-800 border-purple-200 font-semibold',
          icon: ShieldCheck,
        };
      case 'AGUARDANDO_DESCARGA':
        return {
          label: 'Liberado / Aguardando Descarga',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold ring-1 ring-emerald-500/20',
          icon: ArrowRightCircle,
        };
      case 'ENTREGUE_SEM_DIVERGENCIA':
        return {
          label: 'Entregue (Sem Divergência)',
          bg: 'bg-teal-50 text-teal-800 border-teal-200',
          icon: PackageCheck,
        };
      case 'ENTREGUE_COM_DIVERGENCIA':
        return {
          label: 'Entregue (Com Divergência)',
          bg: 'bg-orange-50 text-orange-800 border-orange-300 font-semibold',
          icon: AlertTriangle,
        };
      case 'NO_SHOW':
        return {
          label: 'No Show (Não Compareceu)',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: XCircle,
        };
      case 'CANCELADO':
        return {
          label: 'Cancelado',
          bg: 'bg-gray-100 text-gray-600 border-gray-200',
          icon: XCircle,
        };
      default:
        return {
          label: status,
          bg: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: Clock,
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${sizeClasses} whitespace-nowrap shadow-2xs`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {config.label}
      </span>

      {isWalkIn && (
        <span
          className="inline-flex items-center gap-1 font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5"
          title="Veículo Chegou sem Agendamento Prévio (Encaixe de Emergência de Portaria)"
        >
          ⚡ Encaixe Portaria
        </span>
      )}

      {isPreApprovedContract && (
        <span
          className="inline-flex items-center gap-1 font-bold rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px] px-2 py-0.5"
          title="Janela Pré-Aprovada por Contrato de Suprimentos (Aprovação Automática)"
        >
          ⭐ Janela Pré-Aprovada
        </span>
      )}
    </div>
  );
};
