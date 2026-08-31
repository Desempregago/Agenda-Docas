import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header, AppViewMode, UserRole } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { ClientAppointmentsList } from './components/ClientAppointmentsList';
import { TrackingView } from './components/TrackingView';
import { AdminDockDashboard } from './components/AdminDockDashboard';
import { SystemMaintenancePanel } from './components/SystemMaintenancePanel';
import { ClientNewAppointmentModal } from './components/ClientNewAppointmentModal';
import { RescheduleModal } from './components/RescheduleModal';
import { BrandingSettingsModal, BrandSettings, DEFAULT_BRAND_SETTINGS } from './components/BrandingSettingsModal';
import { SupplierLoginModal, SupplierSession } from './components/SupplierLoginModal';
import { NotificationsModal, AppNotification, isAppointmentNotification } from './components/NotificationsModal';
import { TimeSlotConfigModal } from './components/TimeSlotConfigModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { UsersManagementModal } from './components/UsersManagementModal';
import { ResetDatabaseModal } from './components/ResetDatabaseModal';
import { AppointmentReceiptModal } from './components/AppointmentReceiptModal';
import { DestinationsManagementModal } from './components/DestinationsManagementModal';
import { Appointment, AppointmentStatus, DiscrepancyReport, Dock, SystemUser, DestinationBranch } from './types';
import { Bell, CheckCircle2, AlertCircle, ShieldAlert, X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<AppViewMode>('CLIENT');
  const [currentSystemUser, setCurrentSystemUser] = useState<SystemUser | null>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_system_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userRole, setUserRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_system_user');
      return saved ? 'ADMIN' : 'CLIENT';
    } catch {
      return 'CLIENT';
    }
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [destinations, setDestinations] = useState<DestinationBranch[]>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_destinations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [docks, setDocks] = useState<Dock[]>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_docks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [timeSlots, setTimeSlots] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_timeslots');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [slotSupplierLimits, setSlotSupplierLimits] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_slot_limits');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);
  const [isDestinationsModalOpen, setIsDestinationsModalOpen] = useState<boolean>(false);

  // Notifications state (Armazenamento exclusivo no cache/LocalStorage do navegador)
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<{ title: string; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    setActiveToast({ title, message, type });
    setTimeout(() => setActiveToast(null), 4500);
  };

  // Supplier Session State
  const [currentSupplierSession, setCurrentSupplierSession] = useState<SupplierSession | null>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_supplier_session') || localStorage.getItem('agendacais_supplier_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const addNotification = (
    title: string,
    message: string,
    type: AppNotification['type'],
    protocol?: string,
    supplierCnpj?: string,
    operatorInfo?: { userId?: string; operatorId?: string; operatorName?: string }
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
      type,
      protocol,
      supplierCnpj,
      userId: operatorInfo?.userId,
      operatorId: operatorInfo?.operatorId,
      operatorName: operatorInfo?.operatorName,
      read: false,
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 100);
      try {
        localStorage.setItem('agendadocas_notifications', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    const isAppt = isAppointmentNotification(newNotif);

    // Notificações em toast são exibidas para a sessão logada ativa e relevante
    let isRelevantToActiveSession = false;

    if (isAppt) {
      // Notificações de agendamento: visíveis para todos os operadores/admin; fornecedor se coincidir o CNPJ
      if (userRole === 'ADMIN' || Boolean(currentSystemUser)) {
        isRelevantToActiveSession = true;
      } else if (Boolean(currentSupplierSession)) {
        const rawCurrentCnpj = currentSupplierSession?.cnpj.replace(/\D/g, '');
        const rawNotifCnpj = supplierCnpj ? supplierCnpj.replace(/\D/g, '') : '';
        isRelevantToActiveSession = !rawNotifCnpj || rawCurrentCnpj === rawNotifCnpj;
      }
    } else {
      // Notificações de operador/sistema que NÃO são sobre agendamentos: filtradas por operador
      if (currentSystemUser) {
        const currentUserId = currentSystemUser.id;
        const currentUsername = currentSystemUser.username?.toLowerCase();
        const isAdmin = currentSystemUser.role === 'ADMIN';

        if (isAdmin) {
          isRelevantToActiveSession = true;
        } else if (operatorInfo?.userId || operatorInfo?.operatorId) {
          isRelevantToActiveSession =
            operatorInfo.userId === currentUserId ||
            operatorInfo.userId?.toLowerCase() === currentUsername ||
            operatorInfo.operatorId === currentUserId ||
            operatorInfo.operatorId?.toLowerCase() === currentUsername;
        } else {
          isRelevantToActiveSession = true;
        }
      } else if (userRole === 'ADMIN') {
        isRelevantToActiveSession = true;
      }
    }

    if (isRelevantToActiveSession) {
      showToast(title, message, type === 'DISCREPANCY' ? 'warning' : 'success');
    }
  };

  const handleSupplierLogin = async (session: SupplierSession) => {
    setCurrentSupplierSession(session);
    try {
      localStorage.setItem('agendadocas_supplier_session', JSON.stringify(session));
      // Persist / Register supplier in backend ./data/suppliers.json
      const res = await fetch('/api/suppliers/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: session.cnpj,
          name: session.name
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.supplier && data.supplier.name) {
          const updatedSession = { cnpj: data.supplier.cnpj, name: data.supplier.name };
          setCurrentSupplierSession(updatedSession);
          localStorage.setItem('agendadocas_supplier_session', JSON.stringify(updatedSession));
        }
        await loadData();
      }
    } catch (e) {
      console.error('Erro ao salvar sessão de fornecedor:', e);
    }
    showToast('Acesso de Fornecedor', `Autenticado com sucesso como ${session.name}.`, 'success');
  };

  const handleSupplierLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentSupplierSession(null);
    try {
      localStorage.removeItem('agendadocas_supplier_session');
    } catch (e) {
      console.error('Erro ao remover sessão de fornecedor:', e);
    }
  };

  const handleAdminLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentSystemUser(null);
    setUserRole('CLIENT');
    setCurrentView('CLIENT');
    try {
      localStorage.removeItem('agendadocas_system_user');
    } catch (e) {
      console.error('Erro ao remover sessão de sistema:', e);
    }
    showToast('Sessão Encerrada', 'Você saiu do modo operacional e voltou à visualização normal.', 'info');
  };

  // Branding & Settings State
  const [brandSettings, setBrandSettings] = useState<BrandSettings>(() => {
    try {
      const saved = localStorage.getItem('agendadocas_brand_settings') || localStorage.getItem('agendacais_brand_settings');
      return saved ? JSON.parse(saved) : DEFAULT_BRAND_SETTINGS;
    } catch {
      return DEFAULT_BRAND_SETTINGS;
    }
  });

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isSupplierLoginOpen, setIsSupplierLoginOpen] = useState(false);
  const [isTimeSlotConfigOpen, setIsTimeSlotConfigOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [selectedApptForReceipt, setSelectedApptForReceipt] = useState<Appointment | null>(null);

  const handleSaveBrandSettings = async (newSettings: BrandSettings) => {
    setBrandSettings(newSettings);
    try {
      localStorage.setItem('agendadocas_brand_settings', JSON.stringify(newSettings));
      await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      showToast('Configurações Salvas', 'Identidade visual e marca salvas no servidor.', 'success');
    } catch (e) {
      console.error('Erro ao salvar marca no servidor:', e);
    }
  };

  const handleSaveDestinations = async (newDestinations: DestinationBranch[]) => {
    setDestinations(newDestinations);
    try {
      localStorage.setItem('agendadocas_destinations', JSON.stringify(newDestinations));
      const res = await fetch('/api/destinations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDestinations)
      });
      if (res.ok) {
        showToast('Destinos Atualizados', 'Filiais e unidades de entrega salvas com sucesso.', 'success');
      }
    } catch (e) {
      console.error('Erro ao salvar destinos:', e);
    }
  };

  // Fetch from Express API
  const loadData = async () => {
    try {
      setLoading(true);
      const [apptsRes, docksRes, slotsRes, slotLimitsRes, brandRes, destsRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/docks'),
        fetch('/api/timeslots'),
        fetch('/api/slot-limits'),
        fetch('/api/settings/branding'),
        fetch('/api/destinations')
      ]);

      if (apptsRes.ok) {
        const apptsData = await apptsRes.json();
        setAppointments(apptsData);
      }

      if (destsRes && destsRes.ok) {
        const destsData = await destsRes.json();
        if (Array.isArray(destsData) && destsData.length > 0) {
          setDestinations(destsData);
          try {
            localStorage.setItem('agendadocas_destinations', JSON.stringify(destsData));
          } catch (_) {}
        }
      }

      if (docksRes.ok) {
        const docksData = await docksRes.json();
        setDocks(docksData);
        try {
          localStorage.setItem('agendadocas_docks', JSON.stringify(docksData));
        } catch (_) {}
      }

      if (slotsRes.ok) {
        const slotsData = await slotsRes.json();
        setTimeSlots(slotsData);
        try {
          localStorage.setItem('agendadocas_timeslots', JSON.stringify(slotsData));
        } catch (_) {}
      }

      if (slotLimitsRes && slotLimitsRes.ok) {
        const slotLimitsData = await slotLimitsRes.json();
        if (slotLimitsData && typeof slotLimitsData === 'object') {
          setSlotSupplierLimits(slotLimitsData);
          try {
            localStorage.setItem('agendadocas_slot_limits', JSON.stringify(slotLimitsData));
          } catch (_) {}
        }
      }

      if (brandRes && brandRes.ok) {
        const brandData = await brandRes.json();
        if (brandData && brandData.appName) {
          setBrandSettings(brandData);
          try {
            localStorage.setItem('agendadocas_brand_settings', JSON.stringify(brandData));
          } catch (_) {}
        }
      }

      // Validar se o usuário salvo localmente realmente existe e está cadastrado no servidor
      const savedUserRaw = localStorage.getItem('agendadocas_system_user');
      if (savedUserRaw) {
        try {
          const parsedUser: SystemUser = JSON.parse(savedUserRaw);
          const usersRes = await fetch('/api/users');
          if (usersRes.ok) {
            const serverUsers: SystemUser[] = await usersRes.json();
            const validUser = serverUsers.find(
              u => (u.id === parsedUser.id || u.username.toLowerCase() === parsedUser.username.toLowerCase()) && u.active !== false
            );
            if (!validUser) {
              // Usuário não existe no banco do servidor (ex: projeto recém-instalado ou banco zerado)
              localStorage.removeItem('agendadocas_system_user');
              setCurrentSystemUser(null);
              setUserRole('CLIENT');
            } else {
              // Atualiza dados atualizados do usuário
              setCurrentSystemUser(validUser);
              setUserRole('ADMIN');
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Usando dados locais de reserva:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sincronizar título da página e favicon da aba com a logo/nome da marca
  useEffect(() => {
    if (brandSettings) {
      if (brandSettings.appName) {
        document.title = `${brandSettings.appName} - ${brandSettings.appSubtitle || 'Agendamento de Entregas'}`;
      }
      const faviconElem = document.getElementById('app-favicon') as HTMLLinkElement | null;
      if (faviconElem) {
        faviconElem.href = brandSettings.logoUrl && brandSettings.logoUrl.trim() !== '' 
          ? brandSettings.logoUrl 
          : '/favicon.svg';
      }
    }
  }, [brandSettings]);

  const handleSaveSlots = async (newSlots: string[]) => {
    setTimeSlots(newSlots);
    try {
      localStorage.setItem('agendadocas_timeslots', JSON.stringify(newSlots));
      await fetch('/api/timeslots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlots),
      });
    } catch (_) {}
  };

  const handleSaveSlotLimits = async (newLimits: Record<string, number>) => {
    setSlotSupplierLimits(newLimits);
    try {
      localStorage.setItem('agendadocas_slot_limits', JSON.stringify(newLimits));
      await fetch('/api/slot-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLimits),
      });
    } catch (_) {}
  };

  const handleSaveDocks = async (updatedDocks: Dock[]) => {
    setDocks(updatedDocks);
    try {
      localStorage.setItem('agendadocas_docks', JSON.stringify(updatedDocks));
      await fetch('/api/docks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDocks),
      });
    } catch (_) {}
  };

  // Handlers for updating appointment status
  const handleUpdateStatus = async (
    apptId: string,
    status: AppointmentStatus,
    dockId?: string,
    discrepancy?: DiscrepancyReport,
    additionalData?: Partial<Appointment>
  ) => {
    try {
      const payload: Record<string, any> = {
        status,
        dockId,
        discrepancy,
        ...(additionalData || {})
      };

      const res = await fetch(`/api/appointments/${apptId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let updatedAppt: Appointment | undefined;

      if (res.ok) {
        updatedAppt = await res.json();
        setAppointments(prev =>
          prev.map(a => (a.id === updatedAppt!.id ? updatedAppt! : a))
        );
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast('Falha ao atualizar', errorData.error || 'A alteração não foi salva no servidor.', 'warning');
        return;
      }

      // Generate status notification
      if (updatedAppt) {
        let title = 'Status Atualizado';
        let notifType: AppNotification['type'] = 'STATUS_CHANGE';

        if (status === 'NO_PATIO') {
          title = 'Chegada na Portaria';
          notifType = 'GATE_ENTRY';
        } else if (status === 'AGUARDANDO_DESCARGA') {
          title = updatedAppt.preventionDoubleChecked ? 'Double Check Concluído & Liberado' : 'Veículo Liberado para a Doca';
        } else if (status === 'ENTREGUE_COM_DIVERGENCIA') {
          title = 'Divergência Registrada';
          notifType = 'DISCREPANCY';
        } else if (status === 'ENTREGUE_SEM_DIVERGENCIA') {
          title = 'Entrega Concluída com Sucesso';
        }

        addNotification(
          title,
          `Agendamento ${updatedAppt.protocol} (${updatedAppt.supplierName}) alterado para ${status.replace(/_/g, ' ')}.`,
          notifType,
          updatedAppt.protocol,
          updatedAppt.supplierCnpj,
          currentSystemUser ? { userId: currentSystemUser.id, operatorId: currentSystemUser.id, operatorName: currentSystemUser.name } : undefined
        );
      }
    } catch (e) {
      showToast('Falha de conexão', 'Não foi possível salvar a alteração no servidor.', 'warning');
    }
  };

  // Handle newly created appointment from modal
  const handleAppointmentCreated = (newAppt: Appointment) => {
    setAppointments(prev => [newAppt, ...prev]);
    addNotification(
      'Novo Agendamento Solicitado',
      `Solicitação enviada sob protocolo ${newAppt.protocol} (NF ${newAppt.invoiceNumber}).`,
      'NEW_APPOINTMENT',
      newAppt.protocol,
      newAppt.supplierCnpj,
      currentSystemUser ? { userId: currentSystemUser.id, operatorId: currentSystemUser.id, operatorName: currentSystemUser.name } : undefined
    );
  };

  // Handle appointment rescheduled
  const handleAppointmentRescheduled = (updatedAppt: Appointment) => {
    setAppointments(prev =>
      prev.map(a => (a.id === updatedAppt.id ? updatedAppt : a))
    );
    addNotification(
      'Reagendamento Solicitado',
      `Agendamento ${updatedAppt.protocol} atualizado para ${updatedAppt.scheduledDate} às ${updatedAppt.timeSlot}.`,
      'RESCHEDULE',
      updatedAppt.protocol,
      updatedAppt.supplierCnpj,
      currentSystemUser ? { userId: currentSystemUser.id, operatorId: currentSystemUser.id, operatorName: currentSystemUser.name } : undefined
    );
  };

  // Clear all appointments (zero database)
  const handleClearAllAppointments = async () => {
    try {
      await fetch('/api/appointments', { method: 'DELETE' });
    } catch (_) {}
    setAppointments([]);
    showToast('Base Zerada', 'Todos os agendamentos foram removidos com sucesso.', 'info');
  };

  // Factory reset (Appointments + Suppliers + Notifications)
  const handleFactoryReset = async () => {
    try {
      await fetch('/api/storage/factory-reset', { method: 'POST' });
    } catch (_) {}
    setAppointments([]);
    setNotifications([]);
    try {
      localStorage.removeItem('agendadocas_notifications');
    } catch (_) {}
    showToast('Limpeza Completa', 'Agendamentos, fornecedores e notificações foram zerados com sucesso.', 'info');
  };

  // Reload appointments on demand (or seed sample data)
  const handleLoadMockData = async () => {
    try {
      const res = await fetch('/api/appointments/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.appointments) {
          setAppointments(data.appointments);
        }
      } else {
        const data = await fetch('/api/appointments');
        if (data.ok) {
          const list = await data.json();
          setAppointments(list);
        }
      }
    } catch (_) {}
    showToast('Dados Atualizados', 'Agendamentos de demonstração carregados com sucesso.', 'info');
  };

  const isLoggedIn = userRole === 'ADMIN' || Boolean(currentSystemUser) || Boolean(currentSupplierSession);

  // Filtragem de notificações exibidas:
  // - Notificações sobre agendamentos (status, novos agendamentos, reagendamento, portaria, divergências)
  //   são compartilhadas para TODOS os operadores/admin (e para o fornecedor do CNPJ correspondente).
  // - Notificações que NÃO são sobre agendamentos (sistema, login/sessão, alertas específicos de operador)
  //   são filtradas por operador (apenas o próprio operador ou Administrador Geral têm visibilidade).
  const visibleNotifications = useMemo(() => {
    if (!isLoggedIn) return [];

    // Sessão de Fornecedor autenticado: vê exclusivamente notificações dos seus agendamentos
    if (currentSupplierSession && userRole !== 'ADMIN' && !currentSystemUser) {
      const rawCnpj = currentSupplierSession.cnpj.replace(/\D/g, '');
      return notifications.filter(n => {
        const isAppt = isAppointmentNotification(n);
        if (!isAppt) return false;
        return !n.supplierCnpj || n.supplierCnpj.replace(/\D/g, '') === rawCnpj;
      });
    }

    // Sessão de Operador / Administrador do Sistema
    if (userRole === 'ADMIN' || currentSystemUser) {
      const currentUserId = currentSystemUser?.id;
      const currentUsername = currentSystemUser?.username?.toLowerCase();
      const isAdmin = currentSystemUser?.role === 'ADMIN' || (userRole === 'ADMIN' && !currentSystemUser);

      return notifications.filter(n => {
        const isAppt = isAppointmentNotification(n);

        // Exceção solicitada: notificações sobre agendamentos são exibidas para TODOS os operadores
        if (isAppt) {
          return true;
        }

        // Notificações que NÃO são sobre agendamentos -> Filtradas por operador
        if (isAdmin) {
          return true; // Administrador Geral tem acesso de auditoria a todas as notificações
        }

        // Se a notificação tiver operador/usuário alvo vinculado
        if (n.userId || n.operatorId) {
          const isTargetUser =
            (n.userId && (n.userId === currentUserId || n.userId.toLowerCase() === currentUsername)) ||
            (n.operatorId && (n.operatorId === currentUserId || n.operatorId.toLowerCase() === currentUsername));
          return Boolean(isTargetUser);
        }

        // Notificação de login/sessão de operador sem ID explícito: confere pelo nome
        if (n.title.toLowerCase().includes('sessão de')) {
          if (currentSystemUser?.name && n.title.includes(currentSystemUser.name)) {
            return true;
          }
          return false;
        }

        // Notificações gerais do sistema para a equipe
        return true;
      });
    }

    return [];
  }, [isLoggedIn, userRole, currentSystemUser, currentSupplierSession, notifications]);

  const unreadNotifsCount = visibleNotifications.filter(n => !n.read).length;

  const isStaff = userRole === 'ADMIN' || Boolean(currentSystemUser);
  const isUserAdmin = Boolean(currentSystemUser ? currentSystemUser.role === 'ADMIN' : userRole === 'ADMIN');

  const handleSelectView = (view: AppViewMode) => {
    if (view === 'SYSTEM') {
      if (!isStaff) {
        setIsAdminAuthOpen(true);
        return;
      }
      if (!isUserAdmin) {
        showToast(
          'Acesso Restrito',
          'A aba de Gestão do Sistema e Backups é restrita aos Administradores Gerais.',
          'warning'
        );
        return;
      }
      setCurrentView('SYSTEM');
      return;
    }

    if (view === 'ADMIN') {
      if (!isStaff) {
        setIsAdminAuthOpen(true);
        return;
      }
      setCurrentView('ADMIN');
      return;
    }

    setCurrentView(view);
  };

  const handleOpenUsersModal = () => {
    if (!isUserAdmin) {
      showToast('Acesso Restrito', 'Apenas Administradores têm permissão para gerenciar operadores e acessos.', 'warning');
      return;
    }
    setIsUsersModalOpen(true);
  };

  const handleOpenDestinationsModal = () => {
    if (!isUserAdmin) {
      showToast('Acesso Restrito', 'Apenas Administradores têm permissão para configurar filiais e unidades de destino.', 'warning');
      return;
    }
    setIsDestinationsModalOpen(true);
  };

  const handleOpenBrandingModal = () => {
    if (!isUserAdmin) {
      showToast('Acesso Restrito', 'Apenas Administradores têm permissão para personalizar a marca e identidade visual.', 'warning');
      return;
    }
    setIsBrandingModalOpen(true);
  };

  const handleOpenResetModal = () => {
    if (!isUserAdmin) {
      showToast('Acesso Restrito', 'Apenas Administradores têm permissão para redefinir e gerenciar a base de dados.', 'warning');
      return;
    }
    setIsResetModalOpen(true);
  };

  const handleOpenTimeSlotConfig = () => {
    if (!isUserAdmin) {
      showToast('Acesso Restrito', 'Apenas Administradores têm permissão para configurar capacidade de docas e janelas de horário.', 'warning');
      return;
    }
    setIsTimeSlotConfigOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-20 md:pb-10 selection:bg-blue-600 selection:text-white relative">
      
      {/* Toast Notification Banner */}
      {activeToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl shrink-0 mt-0.5">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white">{activeToast.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">{activeToast.message}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <Header
        currentView={currentView}
        userRole={userRole}
        currentSystemUser={currentSystemUser}
        currentSupplierSession={currentSupplierSession}
        brandSettings={brandSettings}
        unreadNotificationsCount={unreadNotifsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onSelectView={handleSelectView}
        onToggleRole={role => {
          setUserRole(role);
          if (role === 'CLIENT') {
            handleAdminLogout();
          }
        }}
        onLogoutAdmin={handleAdminLogout}
        onRequestAdminAccess={() => {
          if (isStaff) {
            setCurrentView('ADMIN');
          } else {
            setIsAdminAuthOpen(true);
          }
        }}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onOpenBrandingModal={isUserAdmin ? handleOpenBrandingModal : undefined}
        onOpenUsersModal={isUserAdmin ? handleOpenUsersModal : undefined}
        onOpenDestinationsModal={isUserAdmin ? handleOpenDestinationsModal : undefined}
      />

      {/* Main Container */}
      <main className="max-w-[1680px] w-full mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-6 pb-24 md:pb-12">
        {currentView === 'CLIENT' && (
          <ClientAppointmentsList
            appointments={appointments}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onOpenReschedule={appt => setRescheduleAppointment(appt)}
            onSelectForTracking={appt => {
              setCurrentView('TRACKING');
            }}
            onOpenReceipt={appt => setSelectedApptForReceipt(appt)}
            onUpdateStatus={handleUpdateStatus}
            currentSupplierSession={currentSupplierSession}
            userRole={userRole}
            currentSystemUser={currentSystemUser}
            onOpenSupplierLogin={() => setIsSupplierLoginOpen(true)}
            onLogoutSupplier={handleSupplierLogout}
            onLogoutAdmin={handleAdminLogout}
            onOpenUsersModal={isUserAdmin ? handleOpenUsersModal : undefined}
            onNavigateToAdmin={() => {
              if (isStaff) {
                setCurrentView('ADMIN');
              } else {
                setIsAdminAuthOpen(true);
              }
            }}
          />
        )}

        {currentView === 'TRACKING' && (
          <TrackingView
            appointments={appointments}
            onOpenReschedule={appt => setRescheduleAppointment(appt)}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onOpenReceipt={appt => setSelectedApptForReceipt(appt)}
            onUpdateStatus={handleUpdateStatus}
            currentSupplierSession={currentSupplierSession}
            userRole={userRole}
            currentSystemUser={currentSystemUser}
            onOpenSupplierLogin={() => setIsSupplierLoginOpen(true)}
          />
        )}

        {currentView === 'ADMIN' && (
          <AdminDockDashboard
            appointments={appointments}
            docks={docks}
            timeSlots={timeSlots}
            destinations={destinations}
            currentSystemUser={currentSystemUser}
            isUserAdmin={isUserAdmin}
            onUpdateStatus={handleUpdateStatus}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onOpenReceipt={appt => setSelectedApptForReceipt(appt)}
            onOpenTimeSlotConfig={isUserAdmin ? handleOpenTimeSlotConfig : undefined}
          />
        )}

        {currentView === 'SYSTEM' && (
          isUserAdmin ? (
            <SystemMaintenancePanel
              appointments={appointments}
              docks={docks}
              onClearAllAppointments={handleClearAllAppointments}
              onOpenResetModal={handleOpenResetModal}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white max-w-lg mx-auto my-12 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold mb-2">Acesso Exclusivo para Administrador Geral</h2>
              <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
                Seu usuário <strong>{currentSystemUser?.name || 'Operador'}</strong> possui o perfil <strong>Operador</strong>, sem permissão para acessar configurações globais de sistema, resets e backups.
              </p>
              <button
                onClick={() => setCurrentView('ADMIN')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Voltar para Controle de Docas
              </button>
            </div>
          )
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        currentView={currentView}
        userRole={userRole}
        currentSystemUser={currentSystemUser}
        onSelectView={handleSelectView}
        onToggleRole={setUserRole}
        onOpenNewModal={() => setIsNewModalOpen(true)}
      />

      {/* New Appointment Modal */}
      <ClientNewAppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={handleAppointmentCreated}
        currentSupplierSession={currentSupplierSession}
        existingAppointments={appointments}
        destinations={destinations}
        docks={docks}
        timeSlots={timeSlots}
        slotLimits={slotSupplierLimits}
      />

      {/* Supplier Login Portal Modal */}
      <SupplierLoginModal
        isOpen={isSupplierLoginOpen}
        onClose={() => setIsSupplierLoginOpen(false)}
        onLogin={handleSupplierLogin}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={!!rescheduleAppointment}
        appointment={rescheduleAppointment}
        onClose={() => setRescheduleAppointment(null)}
        onSuccess={handleAppointmentRescheduled}
        timeSlots={timeSlots}
        slotLimits={slotSupplierLimits}
        destinations={destinations}
        currentSupplierSession={currentSupplierSession}
        isOperator={userRole === 'ADMIN' || !!currentSystemUser}
        existingAppointments={appointments}
        docks={docks}
        onOpenSupplierLogin={() => setIsSupplierLoginOpen(true)}
      />

      {/* Branding & Logo Customization Modal */}
      <BrandingSettingsModal
        isOpen={isBrandingModalOpen}
        settings={brandSettings}
        onClose={() => setIsBrandingModalOpen(false)}
        onSave={handleSaveBrandSettings}
      />

      {/* Notifications Drawer Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        notifications={visibleNotifications}
        onClose={() => setIsNotificationsOpen(false)}
        onMarkAllAsRead={() => {
          setNotifications(prev => {
            const visibleIds = new Set(visibleNotifications.map(n => n.id));
            const updated = prev.map(n => (visibleIds.has(n.id) ? { ...n, read: true } : n));
            try {
              localStorage.setItem('agendadocas_notifications', JSON.stringify(updated));
            } catch (_) {}
            return updated;
          });
        }}
        onClearNotifications={() => {
          setNotifications(prev => {
            const visibleIds = new Set(visibleNotifications.map(n => n.id));
            const updated = prev.filter(n => !visibleIds.has(n.id));
            try {
              localStorage.setItem('agendadocas_notifications', JSON.stringify(updated));
            } catch (_) {}
            return updated;
          });
        }}
        onSelectProtocol={protocol => {
          setCurrentView('TRACKING');
        }}
      />

      {/* Time Slots & Dock Config Modal */}
      <TimeSlotConfigModal
        isOpen={isTimeSlotConfigOpen}
        docks={docks}
        timeSlots={timeSlots}
        slotLimits={slotSupplierLimits}
        destinations={destinations}
        onClose={() => setIsTimeSlotConfigOpen(false)}
        onSaveSlots={handleSaveSlots}
        onSaveSlotLimits={handleSaveSlotLimits}
        onSaveDocks={handleSaveDocks}
        onSaveDestinations={handleSaveDestinations}
      />

      {/* User Management Modal (Database of Users & Access PINs) */}
      <UsersManagementModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        currentUser={currentSystemUser}
        onUserUpdated={(updatedUser) => {
          setCurrentSystemUser(updatedUser);
          try {
            localStorage.setItem('agendadocas_system_user', JSON.stringify(updatedUser));
          } catch (_) {}
        }}
        onUsersReset={() => {
          handleAdminLogout();
        }}
        onShowToast={showToast}
      />

      {/* Admin Protected Access Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onAuthenticate={(authenticatedUser: SystemUser) => {
          setCurrentSystemUser(authenticatedUser);
          try {
            localStorage.setItem('agendadocas_system_user', JSON.stringify(authenticatedUser));
          } catch (_) {}
          setUserRole('ADMIN');
          setCurrentView('ADMIN');
          addNotification(
            `Sessão de ${authenticatedUser.name} Iniciada`,
            `Acesso concedido como ${authenticatedUser.role === 'ADMIN' ? 'Administrador Geral' : 'Operador'} (${authenticatedUser.department}).`,
            'SYSTEM',
            undefined,
            undefined,
            {
              userId: authenticatedUser.id,
              operatorId: authenticatedUser.id,
              operatorName: authenticatedUser.name,
            }
          );
        }}
      />

      {/* Reset & Manage Database Modal */}
      <ResetDatabaseModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        appointmentsCount={appointments.length}
        onClearAppointments={handleClearAllAppointments}
        onFactoryReset={handleFactoryReset}
        onLoadMockData={handleLoadMockData}
      />

      {/* Appointment Official Receipt & Voucher Modal */}
      <AppointmentReceiptModal
        isOpen={!!selectedApptForReceipt}
        appointment={selectedApptForReceipt}
        onClose={() => setSelectedApptForReceipt(null)}
      />

      {/* Destinations & Branches Management Modal */}
      <DestinationsManagementModal
        isOpen={isDestinationsModalOpen}
        destinations={destinations}
        onClose={() => setIsDestinationsModalOpen(false)}
        onSave={handleSaveDestinations}
      />

    </div>
  );
}

