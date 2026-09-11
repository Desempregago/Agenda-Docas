/**
 * Importação única: JSON legado (data/) → PostgreSQL.
 *
 * Uso (com DATABASE_URL configurada):
 *   npm run db:import
 *
 * - Idempotente: usa upsert; rodar novamente apenas sobrescreve com os mesmos dados.
 * - Preserva IDs, protocolos e timestamps originais.
 * - Não apaga os arquivos JSON — após validar o sistema, remova/mova a pasta data/
 *   manualmente (mantenha data/.session_secret se você não usa SESSION_SECRET).
 */
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { getDb, getPool, closeDb, ensureMigrated } from '../src/server/db';
import { appointments, appSettings, branchConfigs, destinations, suppliers, systemUsers } from '../src/server/db/schema';
import { SETTING_KEYS, DEFAULT_BRAND_SETTINGS, DEFAULT_OPERATING_DAYS } from '../src/server/storage';
import type { Appointment, DestinationBranch, Dock, RegisteredSupplier, SystemUser } from '../src/types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const db = getDb();

function readJson<T>(rel: string, fallback: T): T {
  const p = path.join(DATA_DIR, rel);
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[Import] Aviso: falha ao ler ${rel}:`, e);
    return fallback;
  }
}

async function importAppointments(): Promise<number> {
  const cnpjDir = path.join(DATA_DIR, 'cnpjs');
  if (!fs.existsSync(cnpjDir)) return 0;
  const all: Appointment[] = [];
  for (const folder of fs.readdirSync(cnpjDir)) {
    const folderPath = path.join(cnpjDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    for (const file of fs.readdirSync(folderPath)) {
      if (!file.endsWith('.json')) continue;
      try {
        const appt = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf-8')) as Appointment;
        if (appt && appt.id) all.push(appt);
      } catch (e) {
        console.warn(`[Import] Agendamento inválido ignorado: ${folder}/${file}`);
      }
    }
  }
  for (const appt of all) {
    await db
      .insert(appointments)
      .values({
        id: appt.id,
        protocol: appt.protocol || '',
        supplierCnpj: (appt.supplierCnpj || '').replace(/\D/g, '') || 'OUTROS',
        supplierName: appt.supplierName || '',
        scheduledDate: appt.scheduledDate || '',
        timeSlot: appt.timeSlot || '',
        dockId: appt.dockId || null,
        destinationBranchId: appt.destinationBranchId || null,
        status: appt.status,
        totalVolumes: Number(appt.totalVolumes) || 0,
        weightKg: Number(appt.weightKg) || 0,
        isWalkIn: Boolean(appt.isWalkIn),
        payload: appt,
        ...(appt.createdAt ? { createdAt: new Date(appt.createdAt) } : {}),
        ...(appt.updatedAt ? { updatedAt: new Date(appt.updatedAt) } : {}),
      })
      .onConflictDoUpdate({
        target: appointments.id,
        set: { payload: appt, status: appt.status, updatedAt: new Date() },
      });
  }
  return all.length;
}

async function main() {
  console.log('[Import] Aplicando schema (migrations)…');
  await ensureMigrated();

  console.log('[Import] Importando agendamentos (data/cnpjs/)…');
  const apptCount = await importAppointments();
  console.log(`[Import]   → ${apptCount} agendamentos importados.`);

  console.log('[Import] Importando unidades + configs (destinations.json, destinations/*.config.json)…');
  const branchList = readJson<DestinationBranch[]>('destinations.json', []);
  let branchCount = 0;
  for (const b of branchList) {
    if (!b?.id) continue;
    const identity = {
      id: b.id,
      name: b.name || '',
      code: b.code || null,
      cnpj: b.cnpj || null,
      address: b.address || null,
      neighborhood: b.neighborhood || null,
      city: b.city || null,
      state: b.state || null,
      zipCode: b.zipCode || null,
      contactPhone: b.contactPhone || null,
      contactEmail: b.contactEmail || null,
      receptionInstructions: b.receptionInstructions || null,
      active: b.active ?? true,
      isDefault: Boolean(b.isDefault),
    };
    await db.insert(destinations).values(identity).onConflictDoUpdate({ target: destinations.id, set: identity });
    // Config embutida (modelo antigo) ou do arquivo descentralizado
    const configFile = path.join(DATA_DIR, 'destinations', `${b.id}.config.json`);
    const embedded = {
      branchId: b.id,
      timeSlots: Array.isArray(b.timeSlots) ? b.timeSlots : undefined,
      slotSupplierLimits: b.slotSupplierLimits && typeof b.slotSupplierLimits === 'object' ? b.slotSupplierLimits : undefined,
      allowedDaysOfWeek: Array.isArray(b.allowedDaysOfWeek) ? b.allowedDaysOfWeek : undefined,
      blockedDates: Array.isArray(b.blockedDates) ? b.blockedDates : undefined,
      docks: Array.isArray(b.docks) ? b.docks : undefined,
    };
    let config = embedded;
    if (fs.existsSync(configFile)) {
      try {
        const fromFile = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        config = { ...embedded, ...fromFile, branchId: b.id };
      } catch (_) {}
    }
    await db
      .insert(branchConfigs)
      .values({ branchId: b.id, config })
      .onConflictDoUpdate({ target: branchConfigs.branchId, set: { config, updatedAt: new Date() } });
    branchCount++;
  }
  console.log(`[Import]   → ${branchCount} unidades importadas.`);

  console.log('[Import] Importando usuários (users.json)…');
  const users = readJson<SystemUser[]>('users.json', []);
  for (const u of users) {
    if (!u?.id) continue;
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
    await db.insert(systemUsers).values(row).onConflictDoUpdate({ target: systemUsers.id, set: row });
  }
  console.log(`[Import]   → ${users.length} usuários importados (hashes preservados).`);

  console.log('[Import] Importando fornecedores (suppliers.json)…');
  const supplierList = readJson<RegisteredSupplier[]>('suppliers.json', []);
  for (const s of supplierList) {
    const cnpj = (s?.cnpj || '').replace(/\D/g, '');
    if (!cnpj) continue;
    const row = {
      cnpj,
      name: s.name || '',
      tradeName: s.tradeName || null,
      contactEmail: s.contactEmail || null,
      contactPhone: s.contactPhone || null,
      payload: s,
    };
    await db.insert(suppliers).values(row).onConflictDoUpdate({ target: suppliers.cnpj, set: row });
  }
  console.log(`[Import]   → ${supplierList.length} fornecedores importados.`);

  console.log('[Import] Importando configurações globais…');
  const settings: Array<{ key: string; value: unknown }> = [
    { key: SETTING_KEYS.TIME_SLOTS, value: readJson<string[]>('timeslots.json', []) },
    { key: SETTING_KEYS.SLOT_SUPPLIER_LIMITS, value: readJson<Record<string, number>>('slot_supplier_limits.json', {}) },
    { key: SETTING_KEYS.OPERATING_DAYS, value: readJson<number[]>('operating_days.json', DEFAULT_OPERATING_DAYS) },
    { key: SETTING_KEYS.DOCKS, value: readJson<Dock[]>('docks.json', []) },
    { key: SETTING_KEYS.BRANDING, value: readJson('branding.json', DEFAULT_BRAND_SETTINGS) },
  ];
  for (const s of settings) {
    await db
      .insert(appSettings)
      .values({ key: s.key, value: s.value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: s.value, updatedAt: new Date() } });
  }
  console.log('[Import]   → timeslots, limites, dias operacionais, docas e branding importados.');

  console.log('\n[Import] ✅ Concluído. Valide o sistema e só então arquive a pasta data/ (não apague data/.session_secret se você não define SESSION_SECRET).');
}

main()
  .catch(err => {
    console.error('[Import] Falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
