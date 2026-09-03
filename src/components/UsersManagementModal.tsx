import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Building2,
  Mail,
  User,
  ShieldCheck,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { SystemUser, SystemUserRole } from '../types';
import { authFetch } from '../services/api';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SystemUser | null;
  onUserUpdated?: (updatedUser: SystemUser) => void;
  onShowToast?: (title: string, desc: string, type: 'success' | 'error' | 'info') => void;
}

export const UsersManagementModal: React.FC<UsersManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onShowToast
}) => {
  const isUserAdmin = !currentUser || currentUser.role === 'ADMIN';
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form mode: 'LIST' | 'CREATE' | 'EDIT'
  const [mode, setMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SystemUserRole>('OPERATOR');
  const [department, setDepartment] = useState('Operação de Recebimento');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError('Não foi possível carregar a lista de usuários.');
      }
    } catch (_) {
      setError('Erro ao comunicar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setMode('LIST');
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setUsername('');
    setEmail('');
    setRole('OPERATOR');
    setDepartment('Operação de Recebimento');
    setPassword('');
    setPin('');
    setActive(true);
    setEditingUserId(null);
    setError(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setMode('CREATE');
  };

  const handleStartEdit = (user: SystemUser) => {
    setEditingUserId(user.id);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || '');
    setRole(user.role);
    setDepartment(user.department);
    setPassword(''); // leave blank if unchanged
    setPin(''); // leave blank if unchanged
    setActive(user.active !== false);
    setError(null);
    setMode('EDIT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'CREATE') {
        if (!password.trim() && !pin.trim()) {
          setError('Informe ao menos uma senha ou um PIN de segurança para o usuário.');
          setSubmitting(false);
          return;
        }

        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            username,
            email: email || undefined,
            role,
            department,
            password: password.trim() || undefined,
            pin: pin.trim() || undefined,
          }),
        });

        if (res.ok) {
          onShowToast?.('Usuário Cadastrado', `O operador ${name} foi cadastrado com sucesso.`, 'success');
          resetForm();
          setMode('LIST');
          fetchUsers();
        } else {
          const errData = await res.json();
          setError(errData.error || 'Erro ao cadastrar usuário.');
        }
      } else if (mode === 'EDIT' && editingUserId) {
        const res = await authFetch(`/api/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            username,
            email: email || undefined,
            role,
            department,
            active,
            ...(password.trim() ? { password: password.trim() } : {}),
            ...(pin.trim() ? { pin: pin.trim() } : {}),
          }),
        });

        if (res.ok) {
          const updatedUserData = await res.json();
          onShowToast?.('Usuário Atualizado', `Os dados de ${name} foram atualizados com sucesso.`, 'success');
          if (currentUser && (editingUserId === currentUser.id || currentUser.username === username)) {
            onUserUpdated?.(updatedUserData);
          }
          resetForm();
          setMode('LIST');
          fetchUsers();
        } else {
          const errData = await res.json();
          setError(errData.error || 'Erro ao atualizar usuário.');
        }
      }
    } catch (_) {
      setError('Falha de conexão com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!window.confirm(`Deseja realmente remover o acesso do usuário ${userName}?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onShowToast?.('Usuário Removido', `O usuário ${userName} foi excluído da base.`, 'info');
        fetchUsers();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erro ao remover usuário.');
      }
    } catch (_) {
      alert('Erro de conexão ao remover usuário.');
    }
  };

  if (!isOpen) return null;

  if (!isUserAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Acesso Restrito ao Administrador</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Seu usuário possui perfil de <strong>Operador</strong>. Apenas administradores gerais podem visualizar e gerenciar contas, senhas e PINs de operadores.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Entendido, Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 relative border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-500/20 text-blue-400 rounded-xl sm:rounded-2xl border border-blue-500/30 shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Banco de Usuários & Operadores</h3>
              <p className="text-[11px] sm:text-xs text-slate-300">
                Gerencie as credenciais, PINs e permissões da equipe de Logística, Recebimento e Portaria
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
          
          {error && (
            <div className="p-3 sm:p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl sm:rounded-2xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'LIST' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Operadores e Administradores Cadastrados</h4>
                  <p className="text-xs text-slate-500">Total: {users.length} usuários registrados na base de dados</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={fetchUsers}
                    className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleStartCreate}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Novo Usuário / Operador
                  </button>
                </div>
              </div>

              {users.length === 0 && !loading ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Nenhum usuário cadastrado</p>
                  <p className="text-xs text-slate-500">Cadastre o primeiro administrador ou operador para liberar acessos personalizados.</p>
                  <button
                    onClick={handleStartCreate}
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    Cadastrar Usuário
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Nome / Usuário</th>
                        <th className="py-3 px-4">Cargo / Nível</th>
                        <th className="py-3 px-4">Departamento</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u, uIdx) => (
                        <tr key={`user-row-${u.id}-${uIdx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {u.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">@{u.username}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : u.role === 'SUPERVISOR'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : u.role === 'SECURITY_GATE'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              {u.role === 'ADMIN'
                                ? 'Administrador'
                                : u.role === 'SUPERVISOR'
                                ? 'Supervisor'
                                : u.role === 'SECURITY_GATE'
                                ? 'Portaria'
                                : 'Operador'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">{u.department}</td>
                          <td className="py-3 px-4">
                            {u.active !== false ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 font-bold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleStartEdit(u)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar / Alterar Senha ou PIN"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {users.length > 0 && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs text-slate-400">
                  <span>Ambiente persistente com armazenamento no servidor</span>
                  <span>{users.length} {users.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h4 className="text-sm font-bold text-slate-900">
                  {mode === 'CREATE' ? 'Cadastrar Novo Usuário / Operador' : 'Editar Dados e Credenciais'}
                </h4>
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Voltar para lista
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Silveira"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Login / Matrícula / Usuário *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: carlos.silveira ou 10458"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    placeholder="carlos@empresa.com.br"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Departamento / Setor</label>
                  <input
                    type="text"
                    placeholder="Ex: Recebimento de Docas, Portaria, Logística"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nível de Acesso / Perfil</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as SystemUserRole)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="OPERATOR">Operador (Aprovação e Docas)</option>
                    <option value="SUPERVISOR">Supervisor de Logística</option>
                    <option value="SECURITY_GATE">Portaria & Triagem</option>
                    <option value="ADMIN">Administrador Geral</option>
                  </select>
                </div>

                {mode === 'EDIT' && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="userActive"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="userActive" className="text-xs font-bold text-slate-700">
                      Usuário Ativo no Sistema
                    </label>
                  </div>
                )}
              </div>

              {/* Security Credentials */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>Credenciais de Acesso (Senha e/ou PIN Rápido)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {mode === 'EDIT'
                    ? 'Deixe os campos em branco se não desejar alterar a senha ou PIN atual.'
                    : 'Defina a senha textual ou um PIN numérico (4 a 8 dígitos) para login nos coletores/terminais.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Senha de Acesso</label>
                    <input
                      type="password"
                      placeholder={mode === 'EDIT' ? 'Manter senha atual' : 'Digite a senha...'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Numérico (Opcional para Terminais)</label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder={mode === 'EDIT' ? 'Manter PIN atual' : 'Ex: 4892'}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : mode === 'CREATE' ? 'Cadastrar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
