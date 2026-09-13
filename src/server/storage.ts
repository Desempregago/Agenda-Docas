import { desc, eq, notInArray, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db, ensureMigrated } from './db';
import { appointments, appSettings, branchConfigs, destinations, notifications, suppliers, systemUsers } from './db/schema';
import type {
  Appointment,
  Dock,
  DestinationBranch,
  DestinationBranchIdentity,
  RegisteredSupplier,
  ServerNotification,
  SystemUser,
} from '../types';

export const SAMPLE_SUPPLIERS: RegisteredSupplier[] = [];

export const DEFAULT_SUPPLIERS: RegisteredSupplier[] = [];

// Destinos começam vazios: unidades são criadas e gerenciadas pelo administrador na UI.
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

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  appName: 'Agenda-docas',
  appSubtitle: 'Agendamento de Cargas e Gestão Operacional de Docas',
  logoUrl: '',
  primaryColor: 'blue',
};

export const DEFAULT_OPERATING_DAYS: number[] = [1, 2, 3, 4, 5];

// Chaves da tabela app_settings
export const SETTING_KEYS = {
  TIME_SLOTS: 'timeSlots',
  SLOT_SUPPLIER_LIMITS: 'slotSupplierLimits',
  OPERATING_DAYS: 'operatingDays',
  DOCKS: 'docks',
  BRANDING: 'branding',
} as const;

/**
 * Diretório de dados legado (JSON). Continua exposto apenas para:
 * - o segredo de sessão (data/.session_secret) mantido pelo security.ts;
 * - o logo enviado em branding (data/custom_logo.*);
 * - o script de importação JSON→Postgres.
 * Nenhum dado de negócio é mais lido/gravado aqui.
 */
export const LEGACY_DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

export const getDataDir = (): string => LEGACY_DATA_DIR;

export const getDefaultSampleAppointments = (): Appointment[] => [];

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureMigrated();
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (rows.length === 0) return fallback;
  return rows[0].value as T;
}

async function putSetting<T>(key: string, value: T): Promise<boolean> {
  try {
    await ensureMigrated();
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    return true;
  } catch (e) {
    console.error(`[Storage] Erro ao gravar setting "${key}":`, e);
    return false;
  }
}

function identityFromBranch(b: DestinationBranch): DestinationBranchIdentity {
  return {
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
  };
}

/**
 * Camada de persistência — agora 100% Postgres (Drizzle).
 *
 * Compatibilidade com o código existente:
 * - Os nomes dos métodos são idênticos aos do serviço em JSON;
 * - Todos viraram async (server.ts já foi ajustado para await);
 * - load*() retornam os MESMOS formatos em memória que antes (ex:
 *   destinations inclui a config operacional re-anexada).
 */
export const StorageService = {
  getDataDir,
  getDefaultSampleAppointments,

  // ---------------------------------------------------------------
  // Agendamentos
  // ---------------------------------------------------------------

  loadAppointments: async (): Promise<Appointment[]> => {
    try {
      await ensureMigrated();
      const rows = await db
        .select({ payload: appointments.payload })
        .from(appointments)
        .orderBy(sql`${appointments.createdAt} DESC`);
      return rows.map(r => r.payload);
    } catch (error) {
      console.error('[Storage] Erro ao carregar agendamentos:', error);
      return [];
    }
  },

  saveAppointment: async (appointment: Appointment): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db
        .insert(appointments)
        .values({
          id: appointment.id,
          protocol: appointment.protocol || '',
          supplierCnpj: (appointment.supplierCnpj || '').replace(/\D/g, '') || 'OUTROS',
          supplierName: appointment.supplierName || '',
          scheduledDate: appointment.scheduledDate || '',
          timeSlot: appointment.timeSlot || '',
          dockId: appointment.dockId || null,
          destinationBranchId: appointment.destinationBranchId || null,
          status: appointment.status,
          totalVolumes: Number(appointment.totalVolumes) || 0,
          weightKg: Number(appointment.weightKg) || 0,
          isWalkIn: Boolean(appointment.isWalkIn),
          payload: appointment,
          // Preserva a data de criação original (ordenação do painel e da API)
          ...(appointment.createdAt ? { createdAt: new Date(appointment.createdAt) } : {}),
          ...(appointment.updatedAt ? { updatedAt: new Date(appointment.updatedAt) } : {}),
        })
        .onConflictDoUpdate({
          target: appointments.id,
          set: {
            protocol: appointment.protocol || '',
            supplierCnpj: (appointment.supplierCnpj || '').replace(/\D/g, '') || 'OUTROS',
            supplierName: appointment.supplierName || '',
            scheduledDate: appointment.scheduledDate || '',
            timeSlot: appointment.timeSlot || '',
            dockId: appointment.dockId || null,
            destinationBranchId: appointment.destinationBranchId || null,
            status: appointment.status,
            totalVolumes: Number(appointment.totalVolumes) || 0,
            weightKg: Number(appointment.weightKg) || 0,
            isWalkIn: Boolean(appointment.isWalkIn),
            payload: appointment,
            updatedAt: new Date(),
          },
        });
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar agendamento:', e);
      return false;
    }
  },

  saveAppointments: async (list: Appointment[]): Promise<boolean> => {
    try {
      if (list.length === 0) {
        await StorageService.cleanAllAppointments();
        return true;
      }
      for (const appt of list) {
        const ok = await StorageService.saveAppointment(appt);
        if (!ok) return false;
      }
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar lista de agendamentos:', e);
      return false;
    }
  },

  deleteAppointment: async (appointment: { id: string }): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db.delete(appointments).where(eq(appointments.id, appointment.id));
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao remover agendamento:', e);
      return false;
    }
  },

  /** Remove todos os agendamentos (equivalente ao antigo cleanCnpjFolders). */
  cleanAllAppointments: async (): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db.delete(appointments);
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao limpar agendamentos:', e);
      return false;
    }
  },

  // ---------------------------------------------------------------
  // Unidades (identidade + config operacional)
  // ---------------------------------------------------------------

  /** Retorna identidade + config operacional mescladas (formato DestinationBranch). */
  loadDestinations: async (): Promise<DestinationBranch[]> => {
    try {
      await ensureMigrated();
      const rows = await db.select().from(destinations).orderBy(destinations.createdAt);
      const configs = await db.select().from(branchConfigs);
      const configByBranch = new Map(configs.map(c => [c.branchId, c.config as Record<string, unknown>]));
      return rows.map(r => ({
        ...(r as unknown as DestinationBranchIdentity),
        ...(configByBranch.get(r.id) || {}),
      })) as DestinationBranch[];
    } catch (error) {
      console.error('[Storage] Erro ao carregar unidades:', error);
      return [];
    }
  },

  /**
   * Salva a lista completa de unidades. Cada elemento vem mesclado
   * (identidade + config), como no formato em memória da API.
   */
  saveDestinations: async (list: DestinationBranch[]): Promise<boolean> => {
    try {
      await ensureMigrated();
      const ids = list.map(b => b.id);
      // Remove unidades que saíram da lista
      if (ids.length > 0) {
        await db.delete(destinations).where(notInArray(destinations.id, ids));
        await db.delete(branchConfigs).where(notInArray(branchConfigs.branchId, ids));
      } else {
        await db.delete(destinations);
        await db.delete(branchConfigs);
      }
      for (const b of list) {
        const identity = identityFromBranch(b);
        await db
          .insert(destinations)
          .values({ ...identity, updatedAt: new Date() })
          .onConflictDoUpdate({ target: destinations.id, set: { ...identity, updatedAt: new Date() } });
        const config = {
          branchId: b.id,
          timeSlots: Array.isArray(b.timeSlots) ? b.timeSlots : undefined,
          slotSupplierLimits:
            b.slotSupplierLimits && typeof b.slotSupplierLimits === 'object' ? b.slotSupplierLimits : undefined,
          allowedDaysOfWeek: Array.isArray(b.allowedDaysOfWeek) ? b.allowedDaysOfWeek : undefined,
          blockedDates: Array.isArray(b.blockedDates) ? b.blockedDates : undefined,
          docks: Array.isArray(b.docks) ? b.docks : undefined,
        };
        await db
          .insert(branchConfigs)
          .values({ branchId: b.id, config })
          .onConflictDoUpdate({ target: branchConfigs.branchId, set: { config, updatedAt: new Date() } });
      }
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar unidades:', e);
      return false;
    }
  },

  loadBranchConfig: async (branchId: string): Promise<BranchOperationalConfigShape> => {
    try {
      await ensureMigrated();
      const rows = await db.select().from(branchConfigs).where(eq(branchConfigs.branchId, branchId)).limit(1);
      if (rows.length === 0) return { branchId };
      const raw = rows[0].config as Partial<BranchOperationalConfigShape>;
      return {
        branchId,
        timeSlots: Array.isArray(raw.timeSlots) ? raw.timeSlots : undefined,
        slotSupplierLimits:
          raw.slotSupplierLimits && typeof raw.slotSupplierLimits === 'object' ? raw.slotSupplierLimits : undefined,
        allowedDaysOfWeek: Array.isArray(raw.allowedDaysOfWeek) ? raw.allowedDaysOfWeek : undefined,
        blockedDates: Array.isArray(raw.blockedDates) ? raw.blockedDates : undefined,
        docks: Array.isArray(raw.docks) ? raw.docks : undefined,
      };
    } catch (e) {
      console.error('[Storage] Erro ao ler config da unidade:', e);
      return { branchId };
    }
  },

  saveBranchConfig: async (config: BranchOperationalConfigShape): Promise<boolean> => {
    try {
      await ensureMigrated();
      const clean: BranchOperationalConfigShape = {
        branchId: config.branchId,
        timeSlots: Array.isArray(config.timeSlots) ? config.timeSlots : undefined,
        slotSupplierLimits:
          config.slotSupplierLimits && typeof config.slotSupplierLimits === 'object'
            ? config.slotSupplierLimits
            : undefined,
        allowedDaysOfWeek: Array.isArray(config.allowedDaysOfWeek) ? config.allowedDaysOfWeek : undefined,
        blockedDates: Array.isArray(config.blockedDates) ? config.blockedDates : undefined,
        docks: Array.isArray(config.docks) ? config.docks : undefined,
      };
      await db
        .insert(branchConfigs)
        .values({ branchId: config.branchId, config: clean })
        .onConflictDoUpdate({ target: branchConfigs.branchId, set: { config: clean, updatedAt: new Date() } });
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar config da unidade:', e);
      return false;
    }
  },

  deleteBranchConfig: async (branchId: string): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db.delete(branchConfigs).where(eq(branchConfigs.branchId, branchId));
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao remover config da unidade:', e);
      return false;
    }
  },

  // ---------------------------------------------------------------
  // Configurações globais (settings chave/valor)
  // ---------------------------------------------------------------

  loadOperatingDays: async (): Promise<number[]> => {
    return getSetting<number[]>(SETTING_KEYS.OPERATING_DAYS, DEFAULT_OPERATING_DAYS);
  },

  saveOperatingDays: (days: number[]): Promise<boolean> => putSetting(SETTING_KEYS.OPERATING_DAYS, days),

  loadTimeSlots: async (): Promise<string[]> => {
    return getSetting<string[]>(SETTING_KEYS.TIME_SLOTS, DEFAULT_TIME_SLOTS);
  },

  saveTimeSlots: (slots: string[]): Promise<boolean> => putSetting(SETTING_KEYS.TIME_SLOTS, slots),

  loadSlotSupplierLimits: async (): Promise<Record<string, number>> => {
    return getSetting<Record<string, number>>(SETTING_KEYS.SLOT_SUPPLIER_LIMITS, DEFAULT_SLOT_SUPPLIER_LIMITS);
  },

  saveSlotSupplierLimits: (limits: Record<string, number>): Promise<boolean> =>
    putSetting(SETTING_KEYS.SLOT_SUPPLIER_LIMITS, limits),

  loadDocks: async (): Promise<Dock[]> => {
    return getSetting<Dock[]>(SETTING_KEYS.DOCKS, DEFAULT_DOCKS);
  },

  saveDocks: (docks: Dock[]): Promise<boolean> => putSetting(SETTING_KEYS.DOCKS, docks),

  // ---------------------------------------------------------------
  // Usuários e fornecedores
  // ---------------------------------------------------------------

  loadUsers: async (): Promise<SystemUser[]> => {
    try {
      await ensureMigrated();
      const rows = await db.select().from(systemUsers);
      return rows.map(r => r.payload as SystemUser);
    } catch (error) {
      console.error('[Storage] Erro ao carregar usuários:', error);
      return [];
    }
  },

  saveUsers: async (users: SystemUser[]): Promise<boolean> => {
    try {
      await ensureMigrated();
      const ids = users.map(u => u.id);
      if (ids.length > 0) {
        await db.delete(systemUsers).where(notInArray(systemUsers.id, ids));
      } else {
        await db.delete(systemUsers);
      }
      for (const u of users) {
        const row = {
          id: u.id,
          username: u.username,
          email: u.email || null,
          role: u.role,
          active: u.active ?? true,
          passwordHash: u.password || null,
          pinHash: u.pin || null,
          payload: u,
        };
        await db
          .insert(systemUsers)
          .values(row)
          .onConflictDoUpdate({ target: systemUsers.id, set: { ...row, updatedAt: new Date() } });
      }
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar usuários:', e);
      return false;
    }
  },

  loadSuppliers: async (): Promise<RegisteredSupplier[]> => {
    try {
      await ensureMigrated();
      const rows = await db.select().from(suppliers);
      return rows.map(r => r.payload as RegisteredSupplier);
    } catch (error) {
      console.error('[Storage] Erro ao carregar fornecedores:', error);
      return [];
    }
  },

  saveSuppliers: async (list: RegisteredSupplier[]): Promise<boolean> => {
    try {
      await ensureMigrated();
      const cnjps = list.map(s => (s.cnpj || '').replace(/\D/g, ''));
      if (cnjps.length > 0) {
        await db.delete(suppliers).where(notInArray(suppliers.cnpj, cnjps));
      } else {
        await db.delete(suppliers);
      }
      for (const s of list) {
        const cnpj = (s.cnpj || '').replace(/\D/g, '');
        if (!cnpj) continue;
        const row = {
          cnpj,
          name: s.name || '',
          tradeName: s.tradeName || null,
          contactEmail: s.contactEmail || null,
          contactPhone: s.contactPhone || null,
          payload: s,
        };
        await db
          .insert(suppliers)
          .values(row)
          .onConflictDoUpdate({ target: suppliers.cnpj, set: { ...row, updatedAt: new Date() } });
      }
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar fornecedores:', e);
      return false;
    }
  },

  // ---------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------

  loadBranding: async (): Promise<BrandSettings> => {
    return getSetting<BrandSettings>(SETTING_KEYS.BRANDING, DEFAULT_BRAND_SETTINGS);
  },

  saveBranding: async (settings: BrandSettings): Promise<boolean> => {
    const success = await putSetting(SETTING_KEYS.BRANDING, settings);

    // Se foi enviado um logo em base64 (Data URL), salvar fisicamente no servidor
    if (settings.logoUrl && settings.logoUrl.startsWith('data:image/')) {
      try {
        const matches = settings.logoUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const extension = matches[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg');
          const buffer = Buffer.from(matches[2], 'base64');

          const customLogoPath = path.join(LEGACY_DATA_DIR, `custom_logo.${extension}`);
          const customFaviconPath = path.join(LEGACY_DATA_DIR, 'custom_favicon.ico');
          fs.mkdirSync(LEGACY_DATA_DIR, { recursive: true });
          fs.writeFileSync(customLogoPath, buffer);
          fs.writeFileSync(customFaviconPath, buffer);

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

  // ---------------------------------------------------------------
  // Notificações operacionais (compartilhadas entre dispositivos)
  // ---------------------------------------------------------------

  loadNotifications: async (limit = 200): Promise<ServerNotification[]> => {
    try {
      await ensureMigrated();
      const rows = await db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(Math.min(Math.max(limit, 1), 500));
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        message: r.message,
        type: r.type as ServerNotification['type'],
        protocol: r.protocol || undefined,
        supplierCnpj: r.supplierCnpj || undefined,
        operatorId: r.operatorId || undefined,
        operatorName: r.operatorName || undefined,
        timestamp: r.createdAt.toISOString(),
      }));
    } catch (e) {
      console.error('[Storage] Erro ao carregar notificações:', e);
      return [];
    }
  },

  saveNotification: async (notif: ServerNotification): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db.insert(notifications).values({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        protocol: notif.protocol || null,
        supplierCnpj: notif.supplierCnpj || null,
        operatorId: notif.operatorId || null,
        operatorName: notif.operatorName || null,
        createdAt: new Date(notif.timestamp),
      });
      // Retenção: mantém apenas as 500 mais recentes (as notificações não são
      // histórico permanente — são feed operacional).
      await db.execute(
        sql`DELETE FROM ${notifications} WHERE id IN (
          SELECT id FROM ${notifications} ORDER BY created_at DESC OFFSET 500
        )`
      );
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao salvar notificação:', e);
      return false;
    }
  },

  clearNotifications: async (): Promise<boolean> => {
    try {
      await ensureMigrated();
      await db.delete(notifications);
      return true;
    } catch (e) {
      console.error('[Storage] Erro ao limpar notificações:', e);
      return false;
    }
  },

  // ---------------------------------------------------------------
  // Retenção do feed: remove notificações mais antigas que N dias
  // (complementa o teto de 500 linhas). Retorna quantas foram removidas.
  // ---------------------------------------------------------------
  pruneNotifications: async (olderThanDays = 30): Promise<number> => {
    try {
      await ensureMigrated();
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const removed = await db
        .delete(notifications)
        .where(sql`${notifications.createdAt} < ${cutoff.toISOString()}`)
        .returning({ id: notifications.id });
      return removed.length;
    } catch (e) {
      console.error('[Storage] Erro ao podar notificações antigas:', e);
      return 0;
    }
  },

  // ---------------------------------------------------------------
  // Diagnósticos
  // ---------------------------------------------------------------

  getStats: async () => {
    await ensureMigrated();
    let totalAppointments = 0;
    try {
      const result = await db.select({ count: sql<number>`count(*)::int` }).from(appointments);
      totalAppointments = result[0]?.count ?? 0;
    } catch (_) {}

    return {
      storageType: 'PostgreSQL (Drizzle ORM)',
      dataDirectory: LEGACY_DATA_DIR,
      isMounted: fs.existsSync(LEGACY_DATA_DIR),
      totalAppointmentsInCnpjFolders: totalAppointments,
      files: [] as Array<{ file: string; exists: boolean; sizeBytes: number; updatedAt: string | null }>,
      timestamp: new Date().toISOString(),
    };
  },

  // ---------------------------------------------------------------
  // Estatísticas reais do banco (tamanho, linhas por tabela, versão)
  // ---------------------------------------------------------------
  getDbStats: async (): Promise<{
    databaseSizeBytes: number | null;
    version: string | null;
    tableCounts: Array<{ table: string; rows: number }>;
  }> => {
    const tableCounts: Array<{ table: string; rows: number }> = [];
    let databaseSizeBytes: number | null = null;
    let version: string | null = null;
    try {
      await ensureMigrated();
      const meta = await db.execute<{ size: string; ver: string }>(
        sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size, version() AS ver`
      );
      const metaRow = (meta.rows?.[0] ?? {}) as { size?: string; ver?: string };
      version = metaRow.ver?.split(' on ')[0] ?? null;
      const sizeResult = await db.execute<{ bytes: string }>(
        sql`SELECT pg_database_size(current_database())::text AS bytes`
      );
      databaseSizeBytes = Number((sizeResult.rows?.[0] as { bytes?: string } | undefined)?.bytes ?? 0) || null;

      const counts = await db.execute<{ table_name: string; row_count: string }>(sql`
        SELECT relname AS table_name, n_live_tup::text AS row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);
      for (const row of (counts.rows ?? []) as Array<{ table_name: string; row_count: string }>) {
        tableCounts.push({ table: row.table_name, rows: Number(row.row_count) || 0 });
      }
    } catch (e) {
      console.error('[Storage] Erro ao coletar estatísticas do banco:', e);
    }
    return { databaseSizeBytes, version, tableCounts };
  },
};

// Formas locais para evitar imports circulares com ../types em tempo de execução
interface BranchOperationalConfigShape {
  branchId: string;
  timeSlots?: string[];
  slotSupplierLimits?: Record<string, number>;
  allowedDaysOfWeek?: number[];
  blockedDates?: string[];
  docks?: Dock[];
}
