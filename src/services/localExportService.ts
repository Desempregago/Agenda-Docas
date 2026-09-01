import { Appointment, Dock } from '../types';

/**
 * Trigger direct local browser download of any text or binary blob.
 * Works 100% offline with zero external cloud dependencies.
 */
export function triggerLocalDownload(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Appointments to Excel-compatible CSV (UTF-8 BOM, semicolon delimited)
 */
export function exportAppointmentsToExcelCSV(appointments: Appointment[], dateFilter?: string): { count: number; filename: string } {
  const list = appointments;
  const dateTag = dateFilter ? `_${dateFilter}` : `_${new Date().toISOString().split('T')[0]}`;
  const filename = `Relatorio_Agendamentos${dateTag}.csv`;

  const headers = [
    'Protocolo',
    'Data Agendada',
    'Janela Horário',
    'Status',
    'Fornecedor / Razão Social',
    'CNPJ Fornecedor',
    'Transportadora',
    'Motorista',
    'CPF Motorista',
    'Telefone Motorista',
    'Placa Veículo',
    'Tipo Veículo',
    'Tipo Carga',
    'Notas Fiscais',
    'Série NF',
    'Chaves de Acesso NF-e (44 dígitos)',
    'Valor Total das Notas (R$)',
    'Vencimento do Boleto',
    'Double Check Prevenção',
    'Operador Prevenção',
    'Data/Hora Double Check',
    'Volumes',
    'Peso (kg)',
    'Doca ID',
    'Encaixe / Walk-In',
    'Contrato Pré-Aprovado',
    'Data Criação',
    'Observações'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = list.map(a => {
    const keysJoined = Array.isArray(a.nfeAccessKeys) && a.nfeAccessKeys.length > 0
      ? a.nfeAccessKeys.join(' | ')
      : '';

    const formattedValue = a.invoiceTotalValue !== undefined && a.invoiceTotalValue !== null
      ? Number(a.invoiceTotalValue).toFixed(2).replace('.', ',')
      : '';

    const dueDateFormatted = a.invoiceDueDate
      ? (a.invoiceDueDate.includes('-')
          ? a.invoiceDueDate.split('-').reverse().join('/')
          : a.invoiceDueDate)
      : '';

    return [
      escapeCSV(a.protocol),
      escapeCSV(a.scheduledDate),
      escapeCSV(a.timeSlot),
      escapeCSV(a.status),
      escapeCSV(a.supplierName),
      escapeCSV(a.supplierCnpj),
      escapeCSV(a.carrierName || ''),
      escapeCSV(a.driverName || ''),
      escapeCSV(a.driverCpf || ''),
      escapeCSV(a.driverPhone || ''),
      escapeCSV(a.vehiclePlate || ''),
      escapeCSV(a.vehicleType),
      escapeCSV(a.cargoType),
      escapeCSV(Array.isArray(a.invoiceNumbers) && a.invoiceNumbers.length > 0 ? a.invoiceNumbers.join(' / ') : a.invoiceNumber),
      escapeCSV(a.invoiceSeries || '1'),
      escapeCSV(keysJoined),
      escapeCSV(formattedValue),
      escapeCSV(dueDateFormatted),
      escapeCSV(a.preventionDoubleChecked ? 'SIM' : 'NÃO'),
      escapeCSV(a.preventionCheckedBy || ''),
      escapeCSV(a.preventionCheckedAt ? new Date(a.preventionCheckedAt).toLocaleString('pt-BR') : ''),
      escapeCSV(a.totalVolumes),
      escapeCSV(a.weightKg),
      escapeCSV(a.dockId || 'Não atribuída'),
      escapeCSV(a.isWalkIn ? 'SIM' : 'NÃO'),
      escapeCSV(a.isPreApprovedContract ? 'SIM' : 'NÃO'),
      escapeCSV(a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR') : ''),
      escapeCSV(a.notes || '')
    ];
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens UTF-8 special characters (ç, ã, é, etc.) correctly
  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  triggerLocalDownload(csvContent, filename, 'text/csv;charset=utf-8');

  return { count: list.length, filename };
}

/**
 * Export SQL Backup file containing DDL and INSERT statements ready for On-Premise PostgreSQL / MySQL / SQLite
 */
export function exportAppointmentsToSQL(appointments: Appointment[], docks: Dock[] = []): { count: number; filename: string } {
  const dateTag = new Date().toISOString().split('T')[0];
  const filename = `Backup_Agenda_Docas_${dateTag}.sql`;

  const escapeSQL = (val: any) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  let sql = `-- ============================================================================
-- BACKUP EXPORTADO LOCALMENTE - AGENDA-DOCAS
-- Data do Backup: ${new Date().toLocaleString('pt-BR')}
-- Quantidade de Agendamentos: ${appointments.length}
-- ============================================================================

-- Desativar verificação temporária de chaves estrangeiras se necessário
`;

  // Insert Docks
  if (docks.length > 0) {
    sql += `\n-- 1. DOCAS CADASTRADAS\n`;
    docks.forEach(d => {
      const docNum = parseInt(d.id.replace(/\D/g, '')) || 1;
      const statusStr = d.isOperational ? 'AVAILABLE' : 'MAINTENANCE';
      sql += `INSERT INTO docas (id, numero, nome, tipo, status, daily_limit, limit_unit) VALUES (${escapeSQL(d.id)}, ${docNum}, ${escapeSQL(d.name)}, ${escapeSQL(d.type)}, ${escapeSQL(statusStr)}, ${Number(d.dailyLimit || 5000)}, ${escapeSQL(d.limitUnit || 'volumes')}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, daily_limit = EXCLUDED.daily_limit;\n`;
    });
  }

  // Insert Appointments
  sql += `\n-- 2. AGENDAMENTOS REGISTRADOS\n`;
  appointments.forEach(a => {
    const nfList = Array.isArray(a.invoiceNumbers) && a.invoiceNumbers.length > 0 ? a.invoiceNumbers.join(', ') : a.invoiceNumber;
    const nfeKeysStr = Array.isArray(a.nfeAccessKeys) && a.nfeAccessKeys.length > 0 ? a.nfeAccessKeys.join(';') : '';
    sql += `INSERT INTO agendamentos (id, protocolo, fornecedor_nome, fornecedor_cnpj, transportadora_nome, motorista_nome, motorista_cpf, motorista_telefone, veiculo_placa, veiculo_tipo, tipo_carga, notas_fiscais, chaves_nfe, valor_total_nf, vencimento_boleto, prevention_double_checked, prevention_checked_by, prevention_checked_at, total_volumes, peso_kg, data_agendamento, horario_janela, doca_id, status, observacoes, is_walk_in, is_pre_approved, created_at, updated_at) VALUES (${escapeSQL(a.id)}, ${escapeSQL(a.protocol)}, ${escapeSQL(a.supplierName)}, ${escapeSQL(a.supplierCnpj)}, ${escapeSQL(a.carrierName)}, ${escapeSQL(a.driverName)}, ${escapeSQL(a.driverCpf)}, ${escapeSQL(a.driverPhone)}, ${escapeSQL(a.vehiclePlate)}, ${escapeSQL(a.vehicleType)}, ${escapeSQL(a.cargoType)}, ${escapeSQL(nfList)}, ${escapeSQL(nfeKeysStr)}, ${a.invoiceTotalValue !== undefined ? Number(a.invoiceTotalValue) : 'NULL'}, ${escapeSQL(a.invoiceDueDate)}, ${a.preventionDoubleChecked ? 'TRUE' : 'FALSE'}, ${escapeSQL(a.preventionCheckedBy)}, ${escapeSQL(a.preventionCheckedAt)}, ${Number(a.totalVolumes || 0)}, ${Number(a.weightKg || 0)}, ${escapeSQL(a.scheduledDate)}, ${escapeSQL(a.timeSlot)}, ${escapeSQL(a.dockId)}, ${escapeSQL(a.status)}, ${escapeSQL(a.notes)}, ${a.isWalkIn ? 'TRUE' : 'FALSE'}, ${a.isPreApprovedContract ? 'TRUE' : 'FALSE'}, ${escapeSQL(a.createdAt)}, ${escapeSQL(a.updatedAt)}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;\n`;
  });

  triggerLocalDownload(sql, filename, 'application/sql;charset=utf-8');

  return { count: appointments.length, filename };
}

/**
 * Export complete JSON state file for instant local restoration
 */
export function exportAppointmentsToJSON(appointments: Appointment[]): { count: number; filename: string } {
  const dateTag = new Date().toISOString().split('T')[0];
  const filename = `Backup_Agendamentos_${dateTag}.json`;
  const jsonContent = JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    totalRecords: appointments.length,
    appointments,
  }, null, 2);

  triggerLocalDownload(jsonContent, filename, 'application/json;charset=utf-8');
  return { count: appointments.length, filename };
}
