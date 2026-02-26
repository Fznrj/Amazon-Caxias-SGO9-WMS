import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWms } from '../context/WmsContext';
import { Driver, VehicleProfile } from '../types';
import { downloadCSV } from '../utils/download';
import * as XLSX from 'xlsx';

const DriversView: React.FC = () => {
    const { currentUser } = useAuth();
    const { drivers, addDriver, bulkAddDrivers, updateDriver, deleteDriver, playAudio } = useWms();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canUnblock = ['admin', 'superadmin', 'coordinator', 'supervisor'].includes(currentUser?.role || '');
    const [formData, setFormData] = useState({
        name: '',
        cpf: '',
        plate: '',
        company: '',
        vehicleProfile: 'Passeio' as VehicleProfile,
        status: 'Ativo' as const
    });

    const vehicleProfiles: VehicleProfile[] = ['Moto', 'Passeio', 'Utilitário', 'Van', 'Vuc', 'Carreta'];

    const handleImportQLP = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Remove header and map rows
                const rows = data.slice(1);
                const newDrivers: Omit<Driver, 'id' | 'lastActivity'>[] = [];

                rows.forEach(row => {
                    const name = String(row[0] || '').trim();
                    const cpf = String(row[1] || '').trim();
                    const plate = String(row[2] || '').trim().toUpperCase();
                    const rawProfile = String(row[3] || '').trim().toLowerCase();
                    const company = String(row[4] || 'Transportadora').trim();

                    if (!name || !plate) return;

                    // Mapping profile
                    let profile: VehicleProfile = 'Passeio';
                    if (rawProfile.includes('moto')) profile = 'Moto';
                    else if (rawProfile.includes('van')) profile = 'Van';
                    else if (rawProfile.includes('vuc') || rawProfile.includes('bongo')) profile = 'Vuc';
                    else if (rawProfile.includes('utilit')) profile = 'Utilitário';
                    else if (rawProfile.includes('carreta') || rawProfile.includes('trunk')) profile = 'Carreta';

                    newDrivers.push({
                        name,
                        cpf,
                        plate,
                        company,
                        vehicleProfile: profile,
                        status: 'Ativo'
                    });
                });

                if (newDrivers.length > 0) {
                    await bulkAddDrivers(newDrivers);
                    playAudio('success');
                } else {
                    alert('Nenhum dado válido encontrado no arquivo!');
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao processar o arquivo QLP.');
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleOpenModal = (driver?: Driver) => {
        if (driver) {
            setEditingDriver(driver);
            setFormData({
                name: driver.name,
                cpf: driver.cpf,
                plate: driver.plate,
                company: driver.company,
                vehicleProfile: driver.vehicleProfile,
                status: driver.status as any
            });
        } else {
            setEditingDriver(null);
            setFormData({
                name: '',
                cpf: '',
                plate: '',
                company: '',
                vehicleProfile: 'Passeio',
                status: 'Ativo'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDriver) {
            await updateDriver(editingDriver.id, formData);
        } else {
            await addDriver(formData);
        }
        setIsModalOpen(false);
    };

    const handleDownloadQLP = () => {
        const data = [
            ['Nome', 'CPF', 'Placa', 'Perfil Veículo', 'Transportadora', 'Status'],
            ...drivers.map(d => [d.name, d.cpf, d.plate, d.vehicleProfile, d.company, d.status])
        ];
        downloadCSV(`QLP_ATUAL_${new Date().toLocaleDateString()}.csv`, data);
    };

    // Summary counts
    const activeCount = drivers.filter(d => d.status === 'Ativo').length;
    const inactiveCount = drivers.filter(d => d.status === 'Inativo').length;
    const blockedCount = drivers.filter(d => d.status === 'Bloqueado').length;

    // UI remains below...
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Gestão de Motoristas (QLP)</h2>
                        <p className="text-slate-500 dark:text-slate-400">Cadastre e gerencie motoristas e frotas.</p>
                    </div>

                    {/* Status Summary */}
                    <div className="flex items-center gap-6 px-6 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Ativos</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono leading-none mt-0.5">{activeCount}</span>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Inativos</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono leading-none mt-0.5">{inactiveCount}</span>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Bloqueados</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-mono leading-none mt-0.5">{blockedCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportQLP}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-primary rounded font-bold uppercase text-[10px] tracking-wider transition-all border border-primary/20 shadow-sm"
                    >
                        <span className="material-icons-round text-sm">cloud_upload</span> Subir QLP
                    </button>
                    <button
                        onClick={handleDownloadQLP}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold uppercase text-[10px] tracking-wider transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <span className="material-icons-round text-sm">download</span> Baixar
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded font-bold uppercase text-[10px] tracking-wider transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-icons-round text-sm">person_add</span> Adicionar Novo
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Placa</th>
                                <th className="px-6 py-4">Veículo</th>
                                <th className="px-6 py-4">Empresa</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {drivers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                        Nenhum motorista cadastrado no QLP.
                                    </td>
                                </tr>
                            ) : (
                                drivers.map((driver) => (
                                    <tr key={driver.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white">{driver.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{driver.cpf}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm uppercase text-slate-600 dark:text-slate-400">
                                            {driver.plate}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-bold uppercase text-slate-600 dark:text-slate-300">
                                                {driver.vehicleProfile}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {driver.company}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${driver.status === 'Ativo'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/30'
                                                : driver.status === 'Bloqueado'
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                                    : 'bg-slate-500/10 text-slate-500 border-slate-500/30'
                                                }`}>
                                                {driver.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1">
                                            <button
                                                onClick={async () => {
                                                    if (driver.status === 'Bloqueado' && !canUnblock) return;
                                                    await updateDriver(driver.id, { status: driver.status === 'Bloqueado' ? 'Ativo' : 'Bloqueado' });
                                                }}
                                                disabled={driver.status === 'Bloqueado' && !canUnblock}
                                                className={`p-2 transition-colors ${driver.status === 'Bloqueado'
                                                    ? (canUnblock ? 'text-red-500 hover:text-green-500' : 'text-red-300 cursor-not-allowed')
                                                    : 'text-slate-400 hover:text-red-500'}`}
                                                title={driver.status === 'Bloqueado'
                                                    ? (canUnblock ? 'Desbloquear' : 'Desbloqueio restrito a Supervisão/Coordenação')
                                                    : 'Bloquear'}
                                            >
                                                <span className="material-icons-round text-sm">
                                                    {driver.status === 'Bloqueado' ? 'lock_open' : 'lock'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(driver)}
                                                className="p-2 text-slate-400 hover:text-primary transition-colors"
                                                title="Editar"
                                            >
                                                <span className="material-icons-round text-sm">edit</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm(`Tem certeza que deseja excluir o motorista ${driver.name}? Esta ação não pode ser desfeita.`)) {
                                                        await deleteDriver(driver.id);
                                                    }
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <span className="material-icons-round text-sm">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white uppercase tracking-tight">
                                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Nome Completo</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">CPF</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white"
                                        value={formData.cpf}
                                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Placa</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white uppercase"
                                        value={formData.plate}
                                        onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Empresa / Transportadora</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white"
                                    value={formData.company}
                                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Perfil do Veículo</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white"
                                        value={formData.vehicleProfile}
                                        onChange={e => setFormData({ ...formData, vehicleProfile: e.target.value as VehicleProfile })}
                                    >
                                        {vehicleProfiles.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">
                                        Status {editingDriver?.status === 'Bloqueado' && !canUnblock && '(Bloqueado por Superior)'}
                                    </label>
                                    <select
                                        disabled={editingDriver?.status === 'Bloqueado' && !canUnblock}
                                        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:text-white ${editingDriver?.status === 'Bloqueado' && !canUnblock ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    >
                                        <option value="Ativo">Ativo</option>
                                        <option value="Inativo">Inativo</option>
                                        <option value="Bloqueado">Bloqueado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-bold uppercase text-xs tracking-wider"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded font-bold uppercase text-xs tracking-wider shadow-lg shadow-primary/20"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriversView;
