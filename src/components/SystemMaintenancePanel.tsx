import React, { useState, useEffect } from 'react';
import {
  Database,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Activity,
  HardDrive,
  Calendar,
  Layers,
  ShieldCheck,
  Download,
  Settings
} from 'lucide-react';
import { Appointment, Dock } from '../types';
import { exportAppointmentsToExcelCSV } from '../services/localExportService';
import { authFetch } from '../services/api';

interface SystemMaintenancePanelProps {
  appointments?: Appointment[];
  docks?: Dock[];
  onClearAllAppointments?: () => void;
  onOpenResetModal?: () => void;
  onOpenBrandingModal?: () => void;
}

export const SystemMaintenancePanel: React.FC<SystemMaintenancePanelProps> = ({
  appointments = [],
  docks = [],
  onClearAllAppointments,
  onOpenResetModal,
  onOpenBrandingModal
}) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [dbStats, setDbStats] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [exportNotification, setExportNotification] = useState<{ message: string; isError?: boolean } | null>(null);

  const handleExportCSV = () => {
    try {
      const res = exportAppointmentsToExcelCSV(appointments);
      setExportNotification({
        message: `Planilha Excel exportada com sucesso! Arquivo: ${res.filename} (${res.count} agendamentos).`,
      });
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err: any) {
      setExportNotification({
        message: err.message || 'Erro ao gerar arquivo de exportação.',
        isError: true,
      });
    }
  };

  // Backup REAL do banco: baixa o pg_dump completo (restaurável com psql < arquivo.sql)
  const handleExportSQL = async () => {
    setExportNotification({ message: 'Gerando backup do banco de dados...' });
    try {
      const res = await authFetch('/api/backup/database');
      if (!res.ok) {
        let detail = '';
        try {
          const data = await res.json();
          detail = data?.error ? ` — ${data.error}` : '';
        } catch {
          // resposta sem JSON (stream corrompido etc.)
        }
        throw new Error(`Falha no backup (HTTP ${res.status})${detail}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] || `Backup_Agenda_Docas_${new Date().toISOString().slice(0, 10)}.sql`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportNotification({
        message: `Backup do banco baixado com sucesso! Arquivo: ${filename}. Restaure com: psql "$DATABASE_URL" < ${filename}`,
      });
      setTimeout(() => setExportNotification(null), 8000);
    } catch (err: any) {
      setExportNotification({
        message: err.message || 'Erro ao gerar backup do banco.',
        isError: true,
      });
      setTimeout(() => setExportNotification(null), 8000);
    }
  };

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (e) {
      setHealthData({ status: 'offline', error: 'Servidor inacessível' });
    } finally {
      setLoadingHealth(false);
    }
  };

  // Estatísticas reais do banco (tamanho, linhas por tabela, versão) — ADMIN
  const fetchDbStats = async () => {
    try {
      const res = await authFetch('/api/db/stats');
      if (res.ok) setDbStats(await res.json());
    } catch (_) {
      // silencioso: o card apenas não mostra dados
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchDbStats();
  }, []);

  const formatDbSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return 'N/D';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number | null | undefined): string => {
    if (!seconds || seconds <= 0) return 'recém-iniciado';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  };

  const totalVolumes = appointments.reduce((acc, a) => acc + (Number(a.totalVolumes) || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Banner & Server Health */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <Database className="w-3.5 h-3.5 text-indigo-400" /> Gestão de Dados & Backups
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel de Backups & Sistema</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Exporte planilhas operacionais, realize downloads de backups SQL completos e monitore a integridade do servidor local.
            </p>
          </div>

          {/* Live Status Card */}
          <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl shrink-0 space-y-2.5 text-xs min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-medium">Status do Servidor:</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {healthData?.status === 'ok' ? 'Ativo & Saudável' : 'Carregando...'}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center justify-between">
              <span>Porta Ativa:</span>
              <strong className="text-white font-mono">{healthData?.port ?? '—'}</strong>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center justify-between">
              <span>Uptime do Processo:</span>
              <strong className="text-white font-mono" title={healthData?.bootedAt ? `Iniciado em ${new Date(healthData.bootedAt).toLocaleString('pt-BR')}` : undefined}>
                {healthData?.status === 'ok' ? formatUptime(healthData?.uptimeSeconds) : '—'}
              </strong>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loadingHealth}
              className="w-full mt-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-1.5 rounded-xl transition-colors text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              {loadingHealth ? 'Verificando...' : 'Testar Conexão /api/health'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Agendamentos</div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">{appointments.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Docas Cadastradas</div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">{docks.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Volume Total</div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">{totalVolumes.toLocaleString('pt-BR')} vol</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Armazenamento</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-600" title={dbStats?.version ? `PostgreSQL: ${dbStats.version}` : undefined}>
              PostgreSQL (Drizzle ORM)
            </div>
            {dbStats?.databaseSizeBytes ? (
              <div className="text-[10px] text-slate-400 font-mono">{formatDbSize(dbStats.databaseSizeBytes)}</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Estatísticas do Banco (linhas por tabela) */}
      {dbStats?.tableCounts?.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-indigo-600" /> Banco de Dados — Linhas por Tabela
          </h2>
          <div className="flex flex-wrap gap-2">
            {dbStats.tableCounts.map((t: { table: string; rows: number }) => (
              <span
                key={t.table}
                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg font-mono"
                title={`${t.rows.toLocaleString('pt-BR')} linhas em ${t.table}`}
              >
                {t.table}
                <span className="text-indigo-600 font-bold">{t.rows.toLocaleString('pt-BR')}</span>
              </span>
            ))}
          </div>
          {dbStats.version && (
            <p className="mt-3 text-[10px] text-slate-400 font-mono">{dbStats.version}</p>
          )}
        </div>
      )}

      {/* Identidade Visual (Marca) — movida do cabeçalho para o Sistema */}
      {onOpenBrandingModal && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" /> Identidade Visual da Empresa
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Personalize nome, logotipo e cores exibidos no portal para toda a equipe e fornecedores.
            </p>
          </div>
          <button
            onClick={onOpenBrandingModal}
            className="shrink-0 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Personalizar Marca</span>
          </button>
        </div>
      )}

      {/* Operações de Dados & Backups */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" /> Ações de Exportação e Manutenção
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gere cópias de segurança em formatos compatíveis com Excel e bancos de dados SQL, ou realize manutenções na base.
          </p>
        </div>

        {/* Buttons Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold p-3.5 rounded-2xl shadow-xs transition-all cursor-pointer"
            title="Exportar agendamentos formatados para planilha Excel (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel (.csv)</span>
          </button>

          <button
            onClick={handleExportSQL}
            className="flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold p-3.5 rounded-2xl shadow-xs transition-all cursor-pointer"
            title="Baixar backup completo do banco (pg_dump). Restaure com: psql $DATABASE_URL < arquivo.sql"
          >
            <Download className="w-4 h-4" />
            <span>Backup do Banco (.sql)</span>
          </button>

          {(onOpenResetModal || onClearAllAppointments) && (
            <button
              onClick={() => {
                if (onOpenResetModal) {
                  onOpenResetModal();
                } else if (onClearAllAppointments) {
                  onClearAllAppointments();
                }
              }}
              className="flex items-center justify-center gap-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs sm:text-sm font-bold p-3.5 rounded-2xl shadow-xs transition-all cursor-pointer"
              title="Abrir menu para zerar ou gerenciar dados do banco"
            >
              <Trash2 className="w-4 h-4" />
              <span>Gerenciar Base ({appointments.length})</span>
            </button>
          )}
        </div>

        {/* Local Export Notification Banner */}
        {exportNotification && (
          <div
            className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in ${
              exportNotification.isError
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className={`w-5 h-5 shrink-0 ${exportNotification.isError ? 'text-rose-600' : 'text-emerald-600'}`} />
              <span>{exportNotification.message}</span>
            </div>
            <button
              onClick={() => setExportNotification(null)}
              className="px-3 py-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* Persistence Note */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3 text-xs text-slate-600">
        <HardDrive className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-900">Armazenamento PostgreSQL & Processo PM2 Ativo</span>
          <p>
            Todos os dados (agendamentos, unidades, docas, usuários, fornecedores e notificações) vivem no banco PostgreSQL via Drizzle ORM, gerenciado pelo PM2. Arquivos locais restam apenas para o logo personalizado e o segredo de sessão. O feed de notificações é retido por 30 dias / 500 entradas.
          </p>
        </div>
      </div>
    </div>
  );
};
