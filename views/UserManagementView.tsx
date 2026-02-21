import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';
import { Role, UserStatus, User } from '../types';

const ROLE_RANK: Record<Role, number> = {
  'superadmin': 100,
  'admin': 80,
  'coordinator': 60,
  'supervisor': 40,
  'leader': 20,
  'operator': 10
};

const UserManagementView: React.FC = () => {
  const { users, currentUser, updateUserStatus, updateUser, deleteUser, inviteUser, adminResetPassword } = useWms();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | UserStatus>('All');

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Access check: coordinator and above can see this page
  const allowedRoles: Role[] = ['superadmin', 'admin', 'coordinator', 'supervisor', 'leader'];
  if (!currentUser?.role || !allowedRoles.includes(currentUser.role)) {
    return <div className="p-8">Acesso Negado: Você não tem permissão para gerenciar usuários.</div>;
  }

  const currentUserRank = ROLE_RANK[currentUser.role];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.badge || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'All' || user.status === filterStatus;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => (ROLE_RANK[b.role || 'operator'] || 0) - (ROLE_RANK[a.role || 'operator'] || 0));

  const canManage = (targetUser: User) => {
    if (!targetUser.role) return true; // Can manage pending users
    return currentUserRank > ROLE_RANK[targetUser.role];
  };

  const handleApprove = async (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    await updateUserStatus(user.id, 'active', 'operator');
  };

  const handleBlock = async (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    await updateUserStatus(user.id, 'blocked');
  };

  const handleActivate = async (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    await updateUserStatus(user.id, 'active');
  };

  const handleDelete = async (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    if (confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      await deleteUser(user.id);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      if (!canManage(user)) return alert('Permissão insuficiente para alterar este usuário.');
      if (ROLE_RANK[newRole] >= currentUserRank && currentUser.role !== 'superadmin') {
        return alert('Você só pode atribuir cargos menores que o seu.');
      }
      await updateUserStatus(userId, user.status, newRole);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    const result = await inviteUser(inviteEmail);
    setIsInviting(false);

    if (result.success) {
      alert(result.message);
      setInviteEmail('');
    } else {
      alert('Erro: ' + result.message);
    }
  };

  const openEditUserModal = (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditBadge(user.badge || '');
    setIsEditModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    if (!canManage(user)) return alert('Permissão insuficiente.');
    setSelectedUser(user);
    setNewPassword('');
    setIsResetModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    const result = await updateUser(selectedUser.id, {
      name: editName,
      email: editEmail,
      badge: editBadge
    });

    if (result.success) {
      setIsEditModalOpen(false);
    } else {
      alert(result.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) return alert('A senha deve ter pelo menos 6 caracteres.');

    setIsResetting(true);
    const result = await adminResetPassword(selectedUser.id, newPassword);
    setIsResetting(false);

    if (result.success) {
      alert('Senha resetada com sucesso! O usuário deverá trocá-la no próximo acesso.');
      setIsResetModalOpen(false);
    } else {
      alert('Erro ao resetar senha: ' + result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Usuários</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie permissões, aprovações e cargos conforme hierarquia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <div className="xl:col-span-12 flex flex-col md:flex-row gap-4">
          <div className="relative flex-[0.3] group">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-all dark:text-white"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none cursor-pointer dark:text-white"
            onChange={(e) => setFilterStatus(e.target.value as any)}
            value={filterStatus}
          >
            <option value="All">Todos os Status</option>
            <option value="pending">Pendentes</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
          </select>

          <form onSubmit={handleInvite} className="flex-1 flex gap-2">
            <input
              type="email"
              required
              className="flex-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none dark:text-white"
              placeholder="Email para convite..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={isInviting}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
            >
              <span className="material-icons-round text-sm">person_add</span>
              {isInviting ? 'Enviando...' : 'Convidar'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-sidebar-dark/50 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Email / ID</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Função (Role)</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUsers.map((u) => (
              <tr key={u.id} className={`hover:bg-primary/5 transition-colors ${u.status === 'blocked' ? 'opacity-50' : ''} ${u.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold dark:text-white font-mono">
                      {u.name ? u.name.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{u.name || 'Sem Nome'}</p>
                      <p className="text-[10px] text-slate-500">Criado em: {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{u.email}</span>
                    <span className="text-[10px] text-slate-400 font-bold">ID: {u.badge || 'N/A'}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-wide
                                        ${u.status === 'active' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : ''}
                                        ${u.status === 'pending' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                                        ${u.status === 'blocked' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : ''}
                                    `}>
                    {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                  </span>
                  {u.force_password_reset && (
                    <span className="ml-2 px-2 py-1 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold">
                      Novo / Reset
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={u.role || ''}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-medium rounded p-1 focus:ring-1 focus:ring-primary dark:text-white disabled:opacity-50"
                    disabled={(u.status === 'pending' && u.role === null) || !canManage(u)}
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="operator">Operador</option>
                    <option value="leader">Líder</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="coordinator">Coordenador</option>
                    <option value="admin">Administrador</option>
                    <option value="superadmin" disabled={currentUser.role !== 'superadmin'}>Super Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canManage(u) && (
                      <>
                        <button
                          onClick={() => openResetPasswordModal(u)}
                          className="p-1 text-slate-400 hover:text-orange-500 transition-colors"
                          title="Resetar Senha"
                        >
                          <span className="material-icons-round text-lg">lock_reset</span>
                        </button>
                        <button
                          onClick={() => openEditUserModal(u)}
                          className="p-1 text-slate-400 hover:text-primary transition-colors"
                          title="Editar Usuário"
                        >
                          <span className="material-icons-round text-lg">edit</span>
                        </button>
                      </>
                    )}
                    {u.status === 'pending' && canManage(u) && (
                      <button
                        onClick={() => handleApprove(u)}
                        className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 transition-colors"
                      >
                        Aprovar
                      </button>
                    )}
                    {u.status === 'active' && canManage(u) && (
                      <button
                        onClick={() => handleBlock(u)}
                        title="Bloquear Acesso"
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-icons-round text-lg">block</span>
                      </button>
                    )}
                    {u.status === 'blocked' && canManage(u) && (
                      <button
                        onClick={() => handleActivate(u)}
                        title="Desbloquear"
                        className="p-1 text-slate-400 hover:text-green-500 transition-colors"
                      >
                        <span className="material-icons-round text-lg">check_circle</span>
                      </button>
                    )}
                    {canManage(u) && (
                      <button
                        onClick={() => handleDelete(u)}
                        title="Excluir Usuário"
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <span className="material-icons-round text-lg">delete_outline</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                  Nenhum usuário encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Editar Usuário</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Personalizado / Crachá</label>
                <input
                  value={editBadge}
                  onChange={(e) => setEditBadge(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white"
                  placeholder="Ex: fluizdes"
                />
                <p className="text-[10px] text-slate-500 mt-1">Este ID será usado para buscas e identificação visual.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-primary/90"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isResetModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-xl font-bold mb-1 dark:text-white">Resetar Senha</h3>
            <p className="text-xs text-slate-500 mb-6">Redefinindo senha para: <span className="font-bold text-primary">{selectedUser.name}</span></p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nova Senha Temporária</label>
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">lock</span>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <span className="material-icons-round text-xs align-middle mr-1">info</span>
                O usuário será obrigado a criar uma nova senha pessoal assim que fizer o próximo login.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-8">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                disabled={isResetting}
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting || !newPassword}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95 flex items-center gap-2"
              >
                {isResetting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Resetando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-sm">vpn_key</span>
                    Confirmar Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
