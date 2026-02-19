import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';
import { Role, UserStatus, User } from '../../types';

const UserManagementView: React.FC = () => {
  const { users, currentUser, updateUserStatus, updateUser, deleteUser } = useWms();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | UserStatus>('All');

  // Only Admin can see this page, but double check in render
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
    return <div className="p-8">Acesso Negado: Apenas administradores podem gerenciar usuários.</div>;
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.badge || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'All' || user.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (user: User) => {
    // Default role for new users is operator, admin can change later
    await updateUserStatus(user.id, 'active', 'operator');
  };

  const handleBlock = async (user: User) => {
    await updateUserStatus(user.id, 'blocked');
  };

  const handleActivate = async (user: User) => {
    await updateUserStatus(user.id, 'active');
  };

  const handleDelete = async (user: User) => {
    if (confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      await deleteUser(user.id);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    // Find current status to preserve it
    const user = users.find(u => u.id === userId);
    if (user) {
      await updateUserStatus(userId, user.status, newRole);
    }
  };


  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editId, setEditId] = useState('');

  const openEditUserModal = (user: User) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditId(user.id);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    const result = await updateUser(selectedUser.id, {
      name: editName,
      email: editEmail,
      id: editId
    });

    if (result.success) {
      setIsEditModalOpen(false);
    } else {
      alert(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Usuários</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie permissões, aprovações e bloqueios.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
        <div className="xl:col-span-12 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-all"
              placeholder="Buscar por nome, email ou crachá..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none cursor-pointer"
            onChange={(e) => setFilterStatus(e.target.value as any)}
            value={filterStatus}
          >
            <option value="All">Todos os Status</option>
            <option value="pending">Pendentes</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
          </select>
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
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{u.name}</p>
                      <p className="text-[10px] text-slate-500">Criado em: {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{u.email}</span>
                    <span className="text-[10px] text-slate-400 font-bold">ID: {u.id}</span>
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
                </td>
                <td className="px-6 py-4">
                  <select
                    value={u.role || ''}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-medium rounded p-1 focus:ring-1 focus:ring-primary"
                    disabled={u.status === 'pending' && u.role === null}
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="operator">Operador</option>
                    <option value="coordinator">Coordenador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="Leader">Líder</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditUserModal(u)}
                      className="p-1 text-slate-400 hover:text-primary transition-colors"
                      title="Editar Usuário"
                    >
                      <span className="material-icons-round text-lg">edit</span>
                    </button>
                    {u.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(u)}
                        className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 transition-colors"
                      >
                        Aprovar
                      </button>
                    )}
                    {u.status === 'active' && (
                      <button
                        onClick={() => handleBlock(u)}
                        title="Bloquear Acesso"
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-icons-round text-lg">block</span>
                      </button>
                    )}
                    {u.status === 'blocked' && (
                      <button
                        onClick={() => handleActivate(u)}
                        title="Desbloquear"
                        className="p-1 text-slate-400 hover:text-green-500 transition-colors"
                      >
                        <span className="material-icons-round text-lg">check_circle</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(u)}
                      title="Excluir Usuário"
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <span className="material-icons-round text-lg">delete_outline</span>
                    </button>
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
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID do Usuário</label>
                <input
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-slate-800 dark:text-white"
                />
                <p className="text-[10px] text-yellow-600 mt-1">Cuidado: Alterar o ID pode afetar registros históricos.</p>
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
    </div>
  );
};

export default UserManagementView;
