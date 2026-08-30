import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Appointment, AppointmentStatus, DiscrepancyReport, Dock, RescheduleHistory, SystemUser, SystemUserRole, RegisteredSupplier, DestinationBranch } from './src/types';
import { StorageService, BrandSettings } from './src/server/storage';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Load state directly from persistent files in container / server filesystem
  let appointments: Appointment[] = StorageService.loadAppointments();
  let destinations: DestinationBranch[] = StorageService.loadDestinations();
  let docks: Dock[] = StorageService.loadDocks();
  let timeSlots: string[] = StorageService.loadTimeSlots();
  let slotSupplierLimits: Record<string, number> = StorageService.loadSlotSupplierLimits();
  let users: SystemUser[] = StorageService.loadUsers();
  let suppliers: RegisteredSupplier[] = StorageService.loadSuppliers();
  let brandSettings: BrandSettings = StorageService.loadBranding();

  console.log(`[Storage] Armazenamento persistente carregado com sucesso.`);
  console.log(`[Storage] Diretório de dados: ${StorageService.getDataDir()}`);
  console.log(`[Storage] Agendamentos: ${appointments.length} | Destinos: ${destinations.length} | Docas: ${docks.length} | Janelas: ${timeSlots.length} | Usuários: ${users.length} | Fornecedores: ${suppliers.length}`);

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Agenda-docas API',
      timestamp: new Date().toISOString(),
      version: '1.1.0',
      storage: {
        type: 'Persistent Container File Storage',
        directory: StorageService.getDataDir(),
        appointmentsCount: appointments.length,
        docksCount: docks.length,
        usersCount: users.length
      }
    });
  });

  // Storage Diagnostics & Stats
  app.get('/api/storage/status', (_req, res) => {
    res.json(StorageService.getStats());
  });

  // List & Search Appointments
  app.get('/api/appointments', (req, res) => {
    const { search, status, date } = req.query;
    let filtered = [...appointments];

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        a =>
          a.protocol.toLowerCase().includes(q) ||
          a.invoiceNumber.toLowerCase().includes(q) ||
          (a.purchaseOrder && a.purchaseOrder.toLowerCase().includes(q)) ||
          (a.purchaseOrders && a.purchaseOrders.some(po => po.toLowerCase().includes(q))) ||
          a.supplierName.toLowerCase().includes(q) ||
          a.carrierName.toLowerCase().includes(q) ||
          (a.driverName && a.driverName.toLowerCase().includes(q)) ||
          (a.vehiclePlate && a.vehiclePlate.toLowerCase().includes(q))
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter(a => a.status === status);
    }

    if (date && typeof date === 'string') {
      filtered = filtered.filter(a => a.scheduledDate === date);
    }

    // Sort by updated date desc
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(filtered);
  });

  // Get single appointment
  app.get('/api/appointments/:id', (req, res) => {
    const appt = appointments.find(a => a.id === req.params.id || a.protocol === req.params.id);
    if (!appt) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json(appt);
  });

  // Create new appointment (Persistent)
  app.post('/api/appointments', (req, res) => {
    const body = req.body;

    if (!body.purchaseOrder || !String(body.purchaseOrder).trim()) {
      return res.status(400).json({ error: 'O número do Pedido de Compra (PO) é obrigatório para solicitar o agendamento.' });
    }
    if (!body.supplierName || !body.scheduledDate || !body.timeSlot) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes: Fornecedor, Pedido de Compra, Data e Janela de Horário.' });
    }

    const scheduledDate = String(body.scheduledDate);
    const cargoType = body.cargoType || 'PALETIZADA';
    const requestedVolumes = Number(body.totalVolumes) || 10;
    const isWalkIn = Boolean(body.isWalkIn);
    const isPreApprovedContract = Boolean(body.isPreApprovedContract || body.isPreApproved);

    // Validação D+0: Proibir que agendamentos normais sejam solicitados para o mesmo dia ou datas passadas
    const todayStr = new Date().toISOString().split('T')[0];
    if (!isWalkIn && scheduledDate <= todayStr) {
      return res.status(400).json({
        error: 'Não é permitido solicitar agendamentos para o mesmo dia (D+0) ou datas retroativas. A data mínima permitida é a partir de amanhã.'
      });
    }

    // Identificar a Filial / Unidade de Entrega de Destino
    const targetDest = destinations.find(d => d.id === body.destinationBranchId) 
      || destinations.find(d => d.isDefault) 
      || destinations[0];
    const targetDestId = targetDest?.id;

    // Validação de limite de fornecedores por janela de horário ESPECÍFICO DA FILIAL
    const maxSuppliersForSlot = (targetDest?.slotSupplierLimits?.[body.timeSlot] !== undefined)
      ? targetDest.slotSupplierLimits[body.timeSlot]
      : (slotSupplierLimits[body.timeSlot] ?? 3);

    // Contagem de agendamentos concorrentes EXCLUSIVAMENTE NA FILIAL SELECIONADA
    const currentSuppliersInSlot = appointments.filter(
      a => {
        if (a.scheduledDate !== scheduledDate || a.timeSlot !== body.timeSlot) return false;
        if (a.status === 'CANCELADO' || a.status === 'NO_SHOW') return false;
        if (a.destinationBranchId) return a.destinationBranchId === targetDestId;
        return targetDest?.isDefault;
      }
    ).length;

    if (!isWalkIn && currentSuppliersInSlot >= maxSuppliersForSlot) {
      const branchLabel = targetDest?.name ? ` na unidade "${targetDest.name}"` : '';
      return res.status(400).json({
        error: `O limite máximo de fornecedores (${maxSuppliersForSlot}) para a janela de horário ${body.timeSlot}${branchLabel} na data selecionada já foi atingido. Por favor, escolha outro horário ou data.`
      });
    }

    // Lista de Docas da Filial
    const branchDocks = (targetDest?.docks && targetDest.docks.length > 0)
      ? targetDest.docks
      : docks;

    // Find target dock based on dockId or cargoType
    let targetDock = branchDocks.find(d => d.id === body.dockId);
    if (!targetDock) {
      targetDock = branchDocks.find(d => d.type === cargoType) || branchDocks[0];
    }

    // Check daily limit for target dock if configured for this branch
    if (targetDock && targetDock.dailyLimit) {
      const existingApptsOnDate = appointments.filter(
        a => {
          if (a.scheduledDate !== scheduledDate) return false;
          if (a.status === 'CANCELADO' || a.status === 'NO_SHOW') return false;
          const isSameBranch = a.destinationBranchId ? a.destinationBranchId === targetDestId : targetDest?.isDefault;
          if (!isSameBranch) return false;
          return a.dockId === targetDock?.id || (!a.dockId && a.cargoType === targetDock?.type);
        }
      );
      const currentTotal = existingApptsOnDate.reduce((sum, a) => sum + (Number(a.totalVolumes) || 0), 0);

      if (currentTotal + requestedVolumes > targetDock.dailyLimit) {
        return res.status(400).json({
          error: `Capacidade diária da ${targetDock.name} excedida na unidade ${targetDest?.name || ''} para a data selecionada (${currentTotal}/${targetDock.dailyLimit} ${targetDock.limitUnit || 'volumes'}). Por favor, selecione outra data para a entrega.`
        });
      }
    }

    // Check overall branch daily pallet limit if configured
    if (targetDest?.dailyPalletLimit && cargoType === 'PALETIZADA') {
      const currentBranchPallets = appointments
        .filter(a => {
          if (a.scheduledDate !== scheduledDate || a.status === 'CANCELADO' || a.status === 'NO_SHOW') return false;
          if (a.cargoType !== 'PALETIZADA') return false;
          return a.destinationBranchId ? a.destinationBranchId === targetDestId : targetDest?.isDefault;
        })
        .reduce((sum, a) => sum + (Number(a.totalVolumes) || 0), 0);

      if (currentBranchPallets + requestedVolumes > targetDest.dailyPalletLimit) {
        return res.status(400).json({
          error: `Limite diário de paletes para a unidade ${targetDest.name} (${currentBranchPallets}/${targetDest.dailyPalletLimit} paletes) excedido para esta data. Por favor, escolha outra data.`
        });
      }
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    const protocol = `AGD-${year}-${randomNum}`;

    // Initial status determination: WalkIn -> NO_PATIO; PreApproved -> CONFIRMADO; Default -> PENDENTE
    const initialStatus: AppointmentStatus = body.status
      ? body.status
      : isWalkIn
      ? 'NO_PATIO'
      : isPreApprovedContract
      ? 'CONFIRMADO'
      : 'PENDENTE';

    const rawInvoiceStr = String(body.invoiceNumber || '').trim();
    // Parse multiple invoice numbers separated by commas, spaces, or slashes
    const parsedInvoiceNumbers = rawInvoiceStr
      ? rawInvoiceStr.split(/[,;\n\/]+/).map(s => s.trim()).filter(Boolean)
      : [];

    const mainInvoiceNumber = parsedInvoiceNumbers.length > 0
      ? (parsedInvoiceNumbers.length > 1 ? parsedInvoiceNumbers.join(', ') : parsedInvoiceNumbers[0])
      : 'A emitir';

    // Parse NF-e Access Keys (44 digits)
    let parsedNfeKeys: string[] = [];
    if (Array.isArray(body.nfeAccessKeys)) {
      parsedNfeKeys = body.nfeAccessKeys
        .map((k: any) => String(k || '').trim())
        .filter((k: string) => k.length > 0);
    } else if (body.nfeAccessKey && typeof body.nfeAccessKey === 'string' && body.nfeAccessKey.trim()) {
      parsedNfeKeys = [body.nfeAccessKey.trim()];
    }

    const rawPOStr = String(body.purchaseOrder || '').trim();
    // Parse multiple purchase order numbers separated by commas, semicolons, newlines, or slashes
    const parsedPurchaseOrders = rawPOStr
      ? rawPOStr.split(/[,;\n\/]+/).map(s => s.trim()).filter(Boolean)
      : [];

    const mainPurchaseOrder = parsedPurchaseOrders.length > 0
      ? (parsedPurchaseOrders.length > 1 ? parsedPurchaseOrders.join(', ') : parsedPurchaseOrders[0])
      : (rawPOStr || 'Não informado');

    const nowIso = new Date().toISOString();
    const initialTimestamps: Partial<Record<AppointmentStatus, string>> = {
      PENDENTE: nowIso,
      [initialStatus]: nowIso
    };

    const newAppointment: Appointment = {
      id: `appt-${Date.now()}`,
      protocol,
      purchaseOrder: mainPurchaseOrder,
      purchaseOrders: parsedPurchaseOrders.length > 0 ? parsedPurchaseOrders : [mainPurchaseOrder],
      invoiceNumber: parsedInvoiceNumbers.length > 1 ? parsedInvoiceNumbers.join(', ') : mainInvoiceNumber,
      invoiceNumbers: parsedInvoiceNumbers.length > 0 ? parsedInvoiceNumbers : [mainInvoiceNumber],
      invoiceSeries: body.invoiceSeries || '1',
      invoiceDueDate: body.invoiceDueDate || undefined,
      invoiceTotalValue: body.invoiceTotalValue !== undefined && body.invoiceTotalValue !== null && body.invoiceTotalValue !== '' 
        ? Number(body.invoiceTotalValue) 
        : undefined,
      nfeAccessKeys: parsedNfeKeys,
      nfeAccessKey: parsedNfeKeys[0] || undefined,
      supplierName: String(body.supplierName).trim(),
      supplierCnpj: body.supplierCnpj || '00.000.000/0001-00',
      carrierName: body.carrierName || 'Transportadora Própria / Terceirizada',
      driverName: body.driverName || '',
      driverCpf: body.driverCpf || '',
      driverPhone: body.driverPhone || '',
      vehiclePlate: body.vehiclePlate ? body.vehiclePlate.toUpperCase() : '',
      vehicleType: body.vehicleType || 'TRUCK_34',
      cargoType: body.cargoType || 'PALETIZADA',
      weightKg: Number(body.weightKg) || 1000,
      totalVolumes: requestedVolumes,
      
      destinationBranchId: targetDest?.id,
      destinationBranchName: targetDest?.name,
      destinationBranchAddress: targetDest ? `${targetDest.address || ''}${targetDest.city ? `, ${targetDest.city} - ${targetDest.state || ''}` : ''}`.trim() : undefined,
      destinationBranchCnpj: targetDest?.cnpj,
      
      scheduledDate,
      timeSlot: body.timeSlot,
      dockId: body.dockId || targetDock?.id,
      status: initialStatus,
      notes: body.notes || '',
      isWalkIn,
      isPreApprovedContract,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusTimestamps: initialTimestamps,
      rescheduleHistory: []
    };

    appointments.unshift(newAppointment);
    StorageService.saveAppointment(newAppointment);

    // Auto-register/sync supplier in suppliers.json if CNPJ and Name are provided
    if (newAppointment.supplierCnpj && newAppointment.supplierName) {
      const cleanDigits = newAppointment.supplierCnpj.replace(/\D/g, '');
      if (cleanDigits.length >= 11) {
        const existingIndex = suppliers.findIndex(s => s.cnpj.replace(/\D/g, '') === cleanDigits);
        if (existingIndex === -1) {
          suppliers.push({
            cnpj: newAppointment.supplierCnpj,
            name: newAppointment.supplierName,
            createdAt: nowIso,
            lastLoginAt: nowIso,
          });
          StorageService.saveSuppliers(suppliers);
        } else if (!suppliers[existingIndex].name && newAppointment.supplierName) {
          suppliers[existingIndex].name = newAppointment.supplierName;
          StorageService.saveSuppliers(suppliers);
        }
      }
    }

    res.status(201).json(newAppointment);
  });

  // Admin Reset Data (Zeroing appointments for production go-live)
  app.post('/api/admin/reset-data', (_req, res) => {
    appointments = [];
    StorageService.saveAppointments(appointments);
    StorageService.cleanCnpjFolders();
    res.json({ success: true, message: 'Todos os agendamentos foram removidos do servidor. Base limpa!' });
  });

  // Request Reschedule (Persistent)
  app.put('/api/appointments/:id/reschedule', (req, res) => {
    const { id } = req.params;
    const { newDate, newSlot, reason, requestedBy, additionalInvoices, updatedVolumes, updatedWeightKg } = req.body;

    const index = appointments.findIndex(a => a.id === id || a.protocol === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const current = appointments[index];

    // Validação D+0 para reagendamento
    const todayStr = new Date().toISOString().split('T')[0];
    if (newDate <= todayStr) {
      return res.status(400).json({
        error: 'Não é permitido reagendar para o mesmo dia (D+0) ou datas anteriores. A data mínima permitida é a partir de amanhã.'
      });
    }

    // Identificar a Filial do Agendamento
    const targetDest = destinations.find(d => d.id === current.destinationBranchId) 
      || destinations.find(d => d.isDefault) 
      || destinations[0];
    const targetDestId = targetDest?.id;

    // Validação de limite de fornecedores por janela de horário no reagendamento
    const maxSuppliersForSlot = (targetDest?.slotSupplierLimits?.[newSlot] !== undefined)
      ? targetDest.slotSupplierLimits[newSlot]
      : (slotSupplierLimits[newSlot] ?? 3);

    const currentSuppliersInSlot = appointments.filter(
      a => {
        if (a.id === current.id || a.scheduledDate !== newDate || a.timeSlot !== newSlot) return false;
        if (a.status === 'CANCELADO' || a.status === 'NO_SHOW') return false;
        if (a.destinationBranchId) return a.destinationBranchId === targetDestId;
        return targetDest?.isDefault;
      }
    ).length;

    if (currentSuppliersInSlot >= maxSuppliersForSlot) {
      const branchLabel = targetDest?.name ? ` na unidade "${targetDest.name}"` : '';
      return res.status(400).json({
        error: `O limite máximo de fornecedores (${maxSuppliersForSlot}) para a janela de horário ${newSlot}${branchLabel} na data selecionada já foi atingido. Por favor, selecione outro horário ou data.`
      });
    }

    // Combine previous invoice numbers with new ones if provided
    let updatedInvoiceList = current.invoiceNumbers || [current.invoiceNumber];
    if (additionalInvoices && typeof additionalInvoices === 'string' && additionalInvoices.trim()) {
      const extraList = additionalInvoices
        .split(/[,;\n\/]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      const merged = Array.from(new Set([...updatedInvoiceList, ...extraList]));
      updatedInvoiceList = merged;
    }

    const historyReason = additionalInvoices?.trim()
      ? `${reason || 'Reagendamento solicitado pelo cliente'} (Inclusão de NFs: ${additionalInvoices})`
      : (reason || 'Reagendamento solicitado pelo cliente');

    const nowIso = new Date().toISOString();
    const historyEntry: RescheduleHistory = {
      id: `resched-${Date.now()}`,
      previousDate: current.scheduledDate,
      previousSlot: current.timeSlot,
      newDate,
      newSlot,
      reason: historyReason,
      requestedAt: nowIso,
      requestedBy: requestedBy || current.supplierName
    };

    const updatedTimestamps = {
      ...(current.statusTimestamps || {}),
      PENDENTE: nowIso
    };

    const updated: Appointment = {
      ...current,
      scheduledDate: newDate,
      timeSlot: newSlot,
      invoiceNumber: updatedInvoiceList.join(', '),
      invoiceNumbers: updatedInvoiceList,
      totalVolumes: updatedVolumes ? Number(updatedVolumes) : current.totalVolumes,
      weightKg: updatedWeightKg ? Number(updatedWeightKg) : current.weightKg,
      status: 'PENDENTE', // Re-enviado para aprovação de doca
      updatedAt: nowIso,
      statusTimestamps: updatedTimestamps,
      rescheduleHistory: [historyEntry, ...(current.rescheduleHistory || [])]
    };

    appointments[index] = updated;
    StorageService.saveAppointment(updated);

    res.json(updated);
  });

  // Update Status & Discrepancy & Double Check (Persistent)
  app.patch('/api/appointments/:id/status', (req, res) => {
    const { id } = req.params;
    const { 
      status, 
      dockId, 
      discrepancy, 
      notes,
      nfeAccessKeys,
      nfeAccessKey,
      invoiceNumbers,
      invoiceNumber,
      invoiceDueDate,
      invoiceTotalValue,
      preventionDoubleChecked,
      preventionCheckedBy,
      preventionCheckedAt
    } = req.body as {
      status?: AppointmentStatus;
      dockId?: string;
      discrepancy?: DiscrepancyReport;
      notes?: string;
      nfeAccessKeys?: string[];
      nfeAccessKey?: string;
      invoiceNumbers?: string[];
      invoiceNumber?: string;
      invoiceDueDate?: string;
      invoiceTotalValue?: number | string | null;
      preventionDoubleChecked?: boolean;
      preventionCheckedBy?: string;
      preventionCheckedAt?: string;
    };

    const index = appointments.findIndex(a => a.id === id || a.protocol === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const current = appointments[index];
    const nowIso = new Date().toISOString();

    const updatedTimestamps = {
      ...(current.statusTimestamps || {}),
      ...(status ? { [status]: nowIso } : {})
    };

    // Formatação de chaves e notas se fornecidas
    let parsedNfeKeys = current.nfeAccessKeys || [];
    if (Array.isArray(nfeAccessKeys)) {
      parsedNfeKeys = nfeAccessKeys.map(k => String(k).replace(/\D/g, '')).filter(k => k.length > 0);
    } else if (nfeAccessKey) {
      const clean = String(nfeAccessKey).replace(/\D/g, '');
      if (clean) parsedNfeKeys = [clean];
    }

    const updated: Appointment = {
      ...current,
      status: status || current.status,
      dockId: dockId !== undefined ? dockId : current.dockId,
      notes: notes !== undefined ? notes : current.notes,
      nfeAccessKeys: parsedNfeKeys.length > 0 ? parsedNfeKeys : current.nfeAccessKeys,
      nfeAccessKey: parsedNfeKeys[0] || current.nfeAccessKey,
      invoiceNumbers: invoiceNumbers !== undefined ? invoiceNumbers : current.invoiceNumbers,
      invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : (invoiceNumbers && invoiceNumbers.join(', ')) || current.invoiceNumber,
      invoiceDueDate: invoiceDueDate !== undefined ? invoiceDueDate : current.invoiceDueDate,
      invoiceTotalValue: invoiceTotalValue !== undefined 
        ? (invoiceTotalValue !== null && invoiceTotalValue !== '' ? Number(invoiceTotalValue) : undefined)
        : current.invoiceTotalValue,
      preventionDoubleChecked: preventionDoubleChecked !== undefined ? Boolean(preventionDoubleChecked) : current.preventionDoubleChecked,
      preventionCheckedBy: preventionCheckedBy !== undefined ? preventionCheckedBy : current.preventionCheckedBy,
      preventionCheckedAt: preventionCheckedAt !== undefined ? preventionCheckedAt : current.preventionCheckedAt,
      updatedAt: nowIso,
      statusTimestamps: updatedTimestamps,
      ...(discrepancy ? { discrepancy } : {})
    };

    appointments[index] = updated;
    StorageService.saveAppointment(updated);

    res.json(updated);
  });

  // Get Slot Supplier Limits
  app.get('/api/slot-limits', (_req, res) => {
    res.json(slotSupplierLimits);
  });

  // Save Slot Supplier Limits
  app.put('/api/slot-limits', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      slotSupplierLimits = req.body;
      StorageService.saveSlotSupplierLimits(slotSupplierLimits);
    }
    res.json(slotSupplierLimits);
  });

  // Get Destinations / Branches (Persistent)
  app.get('/api/destinations', (_req, res) => {
    res.json(destinations);
  });

  // Save / Update Destinations List (Persistent)
  app.put('/api/destinations', (req, res) => {
    const updated = req.body;
    if (Array.isArray(updated)) {
      destinations = updated;
      StorageService.saveDestinations(destinations);
    }
    res.json(destinations);
  });

  // Get Docks (Persistent)
  app.get('/api/docks', (_req, res) => {
    res.json(docks);
  });

  // Save / Update Docks List (Persistent)
  app.put('/api/docks', (req, res) => {
    const updated = req.body;
    if (Array.isArray(updated)) {
      docks = updated;
      StorageService.saveDocks(docks);
    }
    res.json(docks);
  });

  // Get Time Slots (Persistent)
  app.get('/api/timeslots', (_req, res) => {
    res.json(timeSlots);
  });

  // Save / Update Time Slots List (Persistent)
  app.put('/api/timeslots', (req, res) => {
    const updated = req.body;
    if (Array.isArray(updated)) {
      timeSlots = updated;
      StorageService.saveTimeSlots(timeSlots);
    }
    res.json(timeSlots);
  });

  // Clear all appointments (start clean)
  app.delete('/api/appointments', (_req, res) => {
    appointments = [];
    StorageService.saveAppointments(appointments);
    StorageService.cleanCnpjFolders();
    res.json({ message: 'Todos os agendamentos foram limpos e salvos.', appointmentsCount: 0 });
  });

  // Reset appointments to clean state
  app.post('/api/appointments/reset', (_req, res) => {
    appointments = [];
    StorageService.saveAppointments(appointments);
    StorageService.cleanCnpjFolders();
    res.json({ message: 'Base de dados salva no servidor com sucesso.', appointmentsCount: 0, docksCount: docks.length });
  });

  // Factory reset (Appointments + Suppliers + Reset Docks to defaults)
  app.post('/api/storage/factory-reset', (_req, res) => {
    appointments = [];
    suppliers = [];
    docks = StorageService.loadDocks();
    timeSlots = StorageService.loadTimeSlots();
    StorageService.saveAppointments(appointments);
    StorageService.saveSuppliers(suppliers);
    StorageService.cleanCnpjFolders();
    res.json({ message: 'Base zerada com sucesso (agendamentos e fornecedores removidos).', appointmentsCount: 0, suppliersCount: 0 });
  });

  // ==========================================
  // Branding & Company Identity Persistence
  // ==========================================
  app.get('/api/settings/branding', (_req, res) => {
    res.json(brandSettings);
  });

  app.put('/api/settings/branding', (req, res) => {
    const newSettings = req.body as BrandSettings;
    if (newSettings && typeof newSettings === 'object') {
      brandSettings = {
        ...brandSettings,
        ...newSettings
      };
      StorageService.saveBranding(brandSettings);
    }
    res.json(brandSettings);
  });

  // ==========================================
  // User Management & System Authentication
  // ==========================================

  // Auth Status (Check if any admin/user exists)
  app.get('/api/auth/status', (_req, res) => {
    const activeUsers = users.filter(u => u.active !== false);
    res.json({
      hasUsers: users.length > 0,
      hasActiveUsers: activeUsers.length > 0,
      totalUsers: users.length
    });
  });

  // Reset all system users (Clean slate for setup)
  app.post('/api/auth/reset-users', (_req, res) => {
    users = [];
    StorageService.saveUsers(users);
    res.json({ message: 'Todos os usuários foram removidos com sucesso. O sistema retornou ao estado de configuração inicial.' });
  });

  // Setup Initial Admin (When database has 0 users)
  app.post('/api/auth/setup-admin', (req, res) => {
    if (users.length > 0) {
      return res.status(400).json({ error: 'O sistema já possui usuários cadastrados. Utilize o painel de login.' });
    }

    const { name, username, email, password, pin, department } = req.body || {};

    if (!name || !username || (!password && !pin)) {
      return res.status(400).json({ error: 'Informe Nome, Usuário/E-mail e uma Senha ou PIN de acesso.' });
    }

    const newAdmin: SystemUser = {
      id: `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: String(name).trim(),
      username: String(username).trim().toLowerCase(),
      email: email ? String(email).trim().toLowerCase() : undefined,
      department: department ? String(department).trim() : 'Coordenação de Logística',
      role: 'ADMIN',
      password: password ? String(password).trim() : undefined,
      pin: pin ? String(pin).trim() : undefined,
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newAdmin);
    StorageService.saveUsers(users);

    const { password: _, pin: __, ...sanitized } = newAdmin;
    res.status(201).json({
      message: 'Administrador cadastrado com sucesso no servidor.',
      user: sanitized
    });
  });

  // User Login Authentication
  app.post('/api/auth/login', (req, res) => {
    const { username, login, password, pin } = req.body || {};
    const inputLogin = (username || login || '').trim().toLowerCase();
    const inputSecret = (password || pin || '').trim();

    if (!inputSecret) {
      return res.status(400).json({ error: 'Informe a senha ou PIN de acesso.' });
    }

    // If no users exist in database yet
    if (users.length === 0) {
      return res.status(404).json({
        error: 'Nenhum usuário cadastrado no sistema.',
        needsSetup: true
      });
    }

    // Find matching user
    let user: SystemUser | undefined;

    if (inputLogin) {
      user = users.find(
        u =>
          (u.username.toLowerCase() === inputLogin || (u.email && u.email.toLowerCase() === inputLogin)) &&
          u.active !== false
      );
    } else {
      // If only PIN was provided (quick PIN station mode)
      user = users.find(
        u => (u.pin === inputSecret || u.password === inputSecret) && u.active !== false
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou credenciais não encontrados.' });
    }

    // Verify secret
    const matchesPassword = user.password && user.password === inputSecret;
    const matchesPin = user.pin && user.pin === inputSecret;

    if (!matchesPassword && !matchesPin) {
      return res.status(401).json({ error: 'Senha de acesso ou PIN incorreto.' });
    }

    user.lastLogin = new Date().toISOString();
    StorageService.saveUsers(users);

    const { password: _, pin: __, ...sanitized } = user;
    res.json({
      message: 'Autenticado com sucesso.',
      user: sanitized
    });
  });

  // List all users (for Admin dashboard)
  app.get('/api/users', (_req, res) => {
    const sanitized = users.map(({ password: _, pin: __, ...u }) => u);
    res.json(sanitized);
  });

  // Create new user / operator (Persistent)
  app.post('/api/users', (req, res) => {
    const { name, username, email, password, pin, role, department } = req.body || {};

    if (!name || !username || (!password && !pin)) {
      return res.status(400).json({ error: 'Nome, Usuário e Senha/PIN são obrigatórios.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = users.find(u => u.username.toLowerCase() === cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um usuário cadastrado com este login/usuário.' });
    }

    const newUser: SystemUser = {
      id: `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: String(name).trim(),
      username: cleanUsername,
      email: email ? String(email).trim().toLowerCase() : undefined,
      department: department ? String(department).trim() : 'Operação de Pátio / Recebimento',
      role: (role as SystemUserRole) || 'OPERATOR',
      password: password ? String(password).trim() : undefined,
      pin: pin ? String(pin).trim() : undefined,
      active: true,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    StorageService.saveUsers(users);

    const { password: _, pin: __, ...sanitized } = newUser;
    res.status(201).json(sanitized);
  });

  // Update user (Persistent)
  app.put('/api/users/:id', (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { name, username, email, password, pin, role, department, active } = req.body || {};
    const current = users[userIndex];

    const updated: SystemUser = {
      ...current,
      name: name !== undefined ? String(name).trim() : current.name,
      username: username !== undefined ? String(username).trim().toLowerCase() : current.username,
      email: email !== undefined ? String(email).trim().toLowerCase() : current.email,
      role: role !== undefined ? role : current.role,
      department: department !== undefined ? String(department).trim() : current.department,
      active: active !== undefined ? Boolean(active) : current.active,
      ...(password ? { password: String(password).trim() } : {}),
      ...(pin ? { pin: String(pin).trim() } : {})
    };

    users[userIndex] = updated;
    StorageService.saveUsers(users);

    const { password: _, pin: __, ...sanitized } = updated;
    res.json(sanitized);
  });

  // Delete user (Persistent)
  app.delete('/api/users/:id', (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = users[userIndex];
    if (user.role === 'ADMIN') {
      const remainingAdmins = users.filter(u => u.role === 'ADMIN' && u.id !== user.id && u.active !== false);
      if (remainingAdmins.length === 0) {
        return res.status(400).json({ error: 'Não é possível excluir o único administrador ativo do sistema.' });
      }
    }

    users.splice(userIndex, 1);
    StorageService.saveUsers(users);
    res.json({ message: 'Usuário excluído com sucesso do servidor.' });
  });

  // Supplier Lookup by CNPJ (Allows quick auto-complete and check if already registered)
  app.get('/api/suppliers/lookup/:cnpj', (req, res) => {
    const rawCnpj = req.params.cnpj || '';
    const cleanDigits = rawCnpj.replace(/\D/g, '');
    
    if (!cleanDigits) {
      return res.status(400).json({ error: 'CNPJ inválido.' });
    }

    const found = suppliers.find(s => s.cnpj.replace(/\D/g, '') === cleanDigits);
    if (!found) {
      return res.status(404).json({ message: 'Fornecedor ainda não cadastrado.', found: false });
    }

    // Count how many appointments this supplier has
    const count = appointments.filter(a => a.supplierCnpj.replace(/\D/g, '') === cleanDigits).length;

    res.json({
      found: true,
      supplier: {
        ...found,
        appointmentCount: count
      }
    });
  });

  // Supplier Login & Auto-Registration (Persistent in ./data/suppliers.json)
  app.post('/api/suppliers/auth', (req, res) => {
    const { cnpj, name, tradeName, contactEmail, contactPhone } = req.body || {};

    if (!cnpj) {
      return res.status(400).json({ error: 'CNPJ é obrigatório.' });
    }

    const cleanCnpj = String(cnpj).trim();
    const cleanDigits = cleanCnpj.replace(/\D/g, '');

    if (cleanDigits.length < 11) {
      return res.status(400).json({ error: 'CNPJ deve ter pelo menos 11 dígitos (CPF/CNPJ).' });
    }

    const existingIndex = suppliers.findIndex(s => s.cnpj.replace(/\D/g, '') === cleanDigits);

    let supplierRecord: RegisteredSupplier;

    if (existingIndex >= 0) {
      // Existing supplier logging in
      const existing = suppliers[existingIndex];
      supplierRecord = {
        ...existing,
        name: (name && String(name).trim()) || existing.name,
        tradeName: tradeName ? String(tradeName).trim() : existing.tradeName,
        contactEmail: contactEmail ? String(contactEmail).trim() : existing.contactEmail,
        contactPhone: contactPhone ? String(contactPhone).trim() : existing.contactPhone,
        lastLoginAt: new Date().toISOString()
      };
      suppliers[existingIndex] = supplierRecord;
    } else {
      // New supplier registering on first access
      const supplierName = name && String(name).trim() ? String(name).trim() : `Empresa CNPJ ${cleanCnpj}`;
      supplierRecord = {
        cnpj: cleanCnpj,
        name: supplierName,
        tradeName: tradeName ? String(tradeName).trim() : undefined,
        contactEmail: contactEmail ? String(contactEmail).trim() : undefined,
        contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      suppliers.push(supplierRecord);
    }

    StorageService.saveSuppliers(suppliers);

    const apptCount = appointments.filter(a => a.supplierCnpj.replace(/\D/g, '') === cleanDigits).length;

    res.json({
      success: true,
      message: existingIndex >= 0 ? 'Login de fornecedor realizado com sucesso.' : 'Novo fornecedor cadastrado com sucesso.',
      supplier: {
        ...supplierRecord,
        appointmentCount: apptCount
      }
    });
  });

  // List all registered suppliers (for Admin or selection)
  app.get('/api/suppliers', (_req, res) => {
    const enriched = suppliers.map(s => {
      const cleanDigits = s.cnpj.replace(/\D/g, '');
      const count = appointments.filter(a => a.supplierCnpj.replace(/\D/g, '') === cleanDigits).length;
      return {
        ...s,
        appointmentCount: count
      };
    });
    res.json(enriched);
  });

  // Delete all suppliers (wipe suppliers list)
  app.delete('/api/suppliers', (_req, res) => {
    suppliers = [];
    StorageService.saveSuppliers(suppliers);
    res.json({ message: 'Todos os fornecedores foram removidos do servidor.', suppliersCount: 0 });
  });

  // Delete a specific supplier by CNPJ
  app.delete('/api/suppliers/:cnpj', (req, res) => {
    const cleanDigits = (req.params.cnpj || '').replace(/\D/g, '');
    const beforeCount = suppliers.length;
    suppliers = suppliers.filter(s => s.cnpj.replace(/\D/g, '') !== cleanDigits);
    StorageService.saveSuppliers(suppliers);
    res.json({
      message: 'Fornecedor removido com sucesso.',
      removed: beforeCount > suppliers.length,
      suppliersCount: suppliers.length
    });
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

