import fs from 'fs';
import path from 'path';
import { Appointment, Dock, SystemUser, RegisteredSupplier, DestinationBranch } from '../types';

export const SAMPLE_SUPPLIERS: RegisteredSupplier[] = [];

export const DEFAULT_SUPPLIERS: RegisteredSupplier[] = [];

export const DEFAULT_DESTINATIONS: DestinationBranch[] = [];

export const DEFAULT_DOCKS: Dock[] = [];

export const DEFAULT_TIME_SLOTS: string[] = [];

export const DEFAULT_SLOT_SUPPLIER_LIMITS: Record<string, number> = {};

export interface BrandSettings {
  appName: string;
  appSubtitle: string;
  logoUrl?: string;
  primaryColor: string;
}

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

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  appName: 'Agenda-docas',
  appSubtitle: 'Agendamento de Cargas e Gestão Operacional de Docas',
  logoUrl: '',
  primaryColor: 'blue',
};

// Target directory for persistent storage (local container / filesystem)
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// Ensure data folder exists
function ensureDataDir(): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return DATA_DIR;
}

// Generic file reading with safe error fallback
function readJsonFile<T>(fileName: string, defaultValue: T): T {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      writeJsonFile(fileName, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
      writeJsonFile(fileName, defaultValue);
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[Server Storage] Erro ao ler ${fileName}:`, error);
    return defaultValue;
  }
}

// Generic file writing with atomic/safe replacement
function writeJsonFile<T>(fileName: string, data: T): boolean {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    const tempPath = path.join(DATA_DIR, `${fileName}.tmp-${Date.now()}`);
    const jsonStr = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(tempPath, jsonStr, 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    console.error(`[Server Storage] Erro ao gravar ${fileName}:`, error);
    try {
      // Fallback direct write if rename fails
      const filePath = path.join(DATA_DIR, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (fallbackError) {
      console.error(`[Server Storage] Falha crítica ao gravar ${fileName}:`, fallbackError);
      return false;
    }
  }
}

export const getDefaultSampleAppointments = (): Appointment[] => {
  return [];
};

// Persistent Store Helpers
export const StorageService = {
  getDataDir: () => DATA_DIR,
  getDefaultSampleAppointments,

  loadAppointments: (): Appointment[] => {
    try {
      ensureDataDir();
      const cnpjDir = path.join(DATA_DIR, 'cnpjs');
      if (!fs.existsSync(cnpjDir)) {
        fs.mkdirSync(cnpjDir, { recursive: true });
        return [];
      }
      const allAppointments: Appointment[] = [];
      const cnpjFolders = fs.readdirSync(cnpjDir);
      for (const folder of cnpjFolders) {
        const folderPath = path.join(cnpjDir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
          const files = fs.readdirSync(folderPath);
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const raw = fs.readFileSync(path.join(folderPath, file), 'utf-8');
                const appt = JSON.parse(raw) as Appointment;
                if (appt && appt.id) {
                  allAppointments.push(appt);
                }
              } catch (err) {
                console.error(`[Storage] Erro ao ler agendamento ${file}:`, err);
              }
            }
          }
        }
      }
      // Ordena decrescente por data de criação / data agendada
      allAppointments.sort((a, b) => new Date(b.createdAt || b.scheduledDate).getTime() - new Date(a.createdAt || a.scheduledDate).getTime());
      return allAppointments;
    } catch (error) {
      console.error('[Storage] Erro ao carregar agendamentos das pastas de CNPJ:', error);
      return [];
    }
  },

  saveAppointment: (appointment: Appointment): boolean => {
    try {
      ensureDataDir();
      const rawCnpj = appointment.supplierCnpj || 'OUTROS';
      const digits = rawCnpj.replace(/\D/g, '') || 'OUTROS';
      const cnpjDir = path.join(DATA_DIR, 'cnpjs', digits);
      if (!fs.existsSync(cnpjDir)) {
        fs.mkdirSync(cnpjDir, { recursive: true });
      }
      const filePath = path.join(cnpjDir, `${appointment.id}.json`);
      const tempPath = path.join(cnpjDir, `${appointment.id}.json.tmp-${Date.now()}`);
      fs.writeFileSync(tempPath, JSON.stringify(appointment, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar agendamento na pasta do CNPJ:', e);
      return false;
    }
  },

  saveAppointments: (appointments: Appointment[]): boolean => {
    if (appointments.length === 0) {
      StorageService.cleanCnpjFolders();
      return true;
    }
    for (const appt of appointments) {
      StorageService.saveAppointment(appt);
    }
    return true;
  },

  deleteAppointment: (appointment: { id: string; supplierCnpj?: string }): boolean => {
    try {
      const rawCnpj = appointment.supplierCnpj || 'OUTROS';
      const digits = rawCnpj.replace(/\D/g, '') || 'OUTROS';
      const filePath = path.join(DATA_DIR, 'cnpjs', digits, `${appointment.id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao remover agendamento:', e);
      return false;
    }
  },

  loadDestinations: (): DestinationBranch[] => {
    const list = readJsonFile<any[]>('destinations.json', DEFAULT_DESTINATIONS);
    return list.map(b => ({
      id: String(b.id || `DEST-${Date.now()}`),
      name: String(b.name || ''),
      code: b.code || '',
      cnpj: b.cnpj || '',
      address: b.address || '',
      neighborhood: b.neighborhood || '',
      city: b.city || '',
      state: b.state || 'SP',
      zipCode: b.zipCode || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      receptionInstructions: b.receptionInstructions || '',
      active: b.active ?? true,
      isDefault: Boolean(b.isDefault),
    }));
  },

  saveDestinations: (destinations: DestinationBranch[]): boolean => {
    const cleanList = destinations.map(b => ({
      id: b.id,
      name: b.name,
      code: b.code || '',
      cnpj: b.cnpj || '',
      address: b.address || '',
      neighborhood: b.neighborhood || '',
      city: b.city || '',
      state: b.state || 'SP',
      zipCode: b.zipCode || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      receptionInstructions: b.receptionInstructions || '',
      active: b.active ?? true,
      isDefault: Boolean(b.isDefault),
    }));
    return writeJsonFile<DestinationBranch[]>('destinations.json', cleanList);
  },

  loadOperatingDays: (): number[] => {
    return readJsonFile<number[]>('operating_days.json', [1, 2, 3, 4, 5]);
  },

  saveOperatingDays: (days: number[]): boolean => {
    return writeJsonFile<number[]>('operating_days.json', days);
  },

  loadDocks: (): Dock[] => {
    return readJsonFile<Dock[]>('docks.json', DEFAULT_DOCKS);
  },

  saveDocks: (docks: Dock[]): boolean => {
    return writeJsonFile<Dock[]>('docks.json', docks);
  },

  loadTimeSlots: (): string[] => {
    return readJsonFile<string[]>('timeslots.json', DEFAULT_TIME_SLOTS);
  },

  saveTimeSlots: (slots: string[]): boolean => {
    return writeJsonFile<string[]>('timeslots.json', slots);
  },

  loadSlotSupplierLimits: (): Record<string, number> => {
    return readJsonFile<Record<string, number>>('slot_supplier_limits.json', DEFAULT_SLOT_SUPPLIER_LIMITS);
  },

  saveSlotSupplierLimits: (limits: Record<string, number>): boolean => {
    return writeJsonFile<Record<string, number>>('slot_supplier_limits.json', limits);
  },

  loadUsers: (): SystemUser[] => {
    return readJsonFile<SystemUser[]>('users.json', []);
  },

  saveUsers: (users: SystemUser[]): boolean => {
    return writeJsonFile<SystemUser[]>('users.json', users);
  },

  loadBranding: (): BrandSettings => {
    return readJsonFile<BrandSettings>('branding.json', DEFAULT_BRAND_SETTINGS);
  },

  saveBranding: (settings: BrandSettings): boolean => {
    const success = writeJsonFile<BrandSettings>('branding.json', settings);
    
    // Se foi enviado um logo em base64 (Data URL), salvar fisicamente no servidor nos diretórios estáticos
    if (settings.logoUrl && settings.logoUrl.startsWith('data:image/')) {
      try {
        const matches = settings.logoUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const extension = matches[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg');
          const buffer = Buffer.from(matches[2], 'base64');
          
          // Salvar na pasta data do servidor
          const customLogoPath = path.join(DATA_DIR, `custom_logo.${extension}`);
          const customFaviconPath = path.join(DATA_DIR, 'custom_favicon.ico');
          fs.writeFileSync(customLogoPath, buffer);
          fs.writeFileSync(customFaviconPath, buffer);

          // Salvar também nas pastas públicas do projeto para acesso direto
          const publicDir = path.join(process.cwd(), 'public');
          if (fs.existsSync(publicDir)) {
            try {
              fs.writeFileSync(path.join(publicDir, `favicon.${extension}`), buffer);
              fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buffer);
            } catch (_) {}
          }

          const distDir = path.join(process.cwd(), 'dist');
          if (fs.existsSync(distDir)) {
            try {
              fs.writeFileSync(path.join(distDir, `favicon.${extension}`), buffer);
              fs.writeFileSync(path.join(distDir, 'favicon.ico'), buffer);
            } catch (_) {}
          }
        }
      } catch (e) {
        console.error('[Storage] Erro ao gravar favicon/logo fisicamente no servidor:', e);
      }
    }
    
    return success;
  },

  loadSuppliers: (): RegisteredSupplier[] => {
    return readJsonFile<RegisteredSupplier[]>('suppliers.json', DEFAULT_SUPPLIERS);
  },

  saveSuppliers: (suppliers: RegisteredSupplier[]): boolean => {
    return writeJsonFile<RegisteredSupplier[]>('suppliers.json', suppliers);
  },

  cleanCnpjFolders: () => {
    try {
      ensureDataDir();
      const cnpjDir = path.join(DATA_DIR, 'cnpjs');
      if (fs.existsSync(cnpjDir)) {
        fs.rmSync(cnpjDir, { recursive: true, force: true });
        fs.mkdirSync(cnpjDir, { recursive: true });
      }
      // Remove legado appointments.json ou notifications.json se ainda existirem
      const legacyFiles = ['appointments.json', 'notifications.json'];
      for (const lf of legacyFiles) {
        const p = path.join(DATA_DIR, lf);
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    } catch (e) {
      console.error('[Storage] Erro ao limpar pastas de CNPJ:', e);
    }
  },

  syncAppointmentToCnpjFolder: (appointment: Appointment) => {
    return StorageService.saveAppointment(appointment);
  },

  syncAllAppointmentsToCnpjFolders: (appointments: Appointment[]) => {
    return StorageService.saveAppointments(appointments);
  },

  getStats: () => {
    ensureDataDir();
    const files = ['docks.json', 'timeslots.json', 'users.json', 'suppliers.json', 'branding.json'];
    const fileStats = files.map(file => {
      const p = path.join(DATA_DIR, file);
      const exists = fs.existsSync(p);
      let sizeBytes = 0;
      let updatedAt: string | null = null;
      if (exists) {
        try {
          const stat = fs.statSync(p);
          sizeBytes = stat.size;
          updatedAt = stat.mtime.toISOString();
        } catch (_) {}
      }
      return { file, exists, sizeBytes, updatedAt };
    });

    const cnpjDir = path.join(DATA_DIR, 'cnpjs');
    let totalCnpjFiles = 0;
    if (fs.existsSync(cnpjDir)) {
      try {
        const folders = fs.readdirSync(cnpjDir);
        for (const f of folders) {
          const fp = path.join(cnpjDir, f);
          if (fs.statSync(fp).isDirectory()) {
            totalCnpjFiles += fs.readdirSync(fp).filter(fn => fn.endsWith('.json')).length;
          }
        }
      } catch (_) {}
    }

    return {
      storageType: 'Local Server / Container Persistent Volume',
      dataDirectory: DATA_DIR,
      isMounted: fs.existsSync(DATA_DIR),
      totalAppointmentsInCnpjFolders: totalCnpjFiles,
      files: fileStats,
      timestamp: new Date().toISOString(),
    };
  }
};
