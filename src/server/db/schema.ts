import {
  pgTable,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { Appointment, AppointmentStatus, SystemUserRole } from '../../types';

/**
 * Agendamentos — modelo híbrido:
 * - Colunas promovidas para tudo que as validações de capacidade filtram
 *   (data, janela, doca, status, CNPJ, unidade) → queries indexadas.
 * - Payload jsonb com o objeto completo → mapeamento linha→objeto à prova de
 *   regressões (nenhum campo novo exige migration para ser lido).
 */
export const appointments = pgTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    protocol: text('protocol').notNull(),
    supplierCnpj: text('supplier_cnpj').notNull(),
    supplierName: text('supplier_name').notNull().default(''),
    scheduledDate: text('scheduled_date').notNull(), // YYYY-MM-DD (data de negócio, America/Sao_Paulo)
    timeSlot: text('time_slot').notNull(),
    dockId: text('dock_id'),
    destinationBranchId: text('destination_branch_id'),
    status: text('status').notNull().$type<AppointmentStatus>(),
    totalVolumes: integer('total_volumes').notNull().default(0),
    weightKg: doublePrecision('weight_kg').notNull().default(0),
    isWalkIn: boolean('is_walk_in').notNull().default(false),
    payload: jsonb('payload').$type<Appointment>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    // Capacidade diária por doca: WHERE scheduled_date = $1 AND dock_id = $2 AND status NOT IN (...)
    index('appointments_date_dock_idx').on(table.scheduledDate, table.dockId),
    // Lotação por janela: WHERE scheduled_date = $1 AND destination_branch_id = $2 AND time_slot = $3
    index('appointments_date_branch_slot_idx').on(table.scheduledDate, table.destinationBranchId, table.timeSlot),
    // Filtro por CNPJ (portal do fornecedor)
    index('appointments_supplier_cnpj_idx').on(table.supplierCnpj),
    // Listagens do painel por data
    index('appointments_scheduled_date_idx').on(table.scheduledDate),
  ]
);

/** Unidades / filiais — identidade (destinations.json). */
export const destinations = pgTable('destinations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  cnpj: text('cnpj'),
  address: text('address'),
  neighborhood: text('neighborhood'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  receptionInstructions: text('reception_instructions'),
  active: boolean('active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Config operacional por unidade (data/destinations/<id>.config.json).
 * Os campos estruturados (timeSlots, docks...) ficam em jsonb — são lidos
 * sempre em conjunto, nunca filtrados individualmente.
 */
export const branchConfigs = pgTable('branch_configs', {
  branchId: text('branch_id').primaryKey(),
  config: jsonb('config').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Usuários do sistema (ADMIN/OPERATOR/SUPERVISOR/SECURITY_GATE). */
export const systemUsers = pgTable(
  'system_users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email'),
    role: text('role').notNull().$type<SystemUserRole>(),
    active: boolean('active').notNull().default(true),
    passwordHash: text('password_hash'),
    pinHash: text('pin_hash'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('system_users_username_idx').on(table.username)]
);

/** Fornecedores auto-registrados (suppliers.json). */
export const suppliers = pgTable('suppliers', {
  cnpj: text('cnpj').primaryKey(), // apenas dígitos
  name: text('name').notNull(),
  tradeName: text('trade_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Configurações globais chave/valor: branding, timeslots globais,
 * slot_supplier_limits, operating_days. Valor é jsonb puro.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppointmentRow = typeof appointments.$inferSelect;
export type DestinationRow = typeof destinations.$inferSelect;
export type SystemUserRow = typeof systemUsers.$inferSelect;
export type SupplierRow = typeof suppliers.$inferSelect;

// Tipos auxiliares reexportados para clareza nos módulos consumidores
export type { Appointment };
