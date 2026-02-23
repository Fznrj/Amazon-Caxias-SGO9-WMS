import React, { useState, useMemo } from 'react';
import { useWms } from '../context/WmsContext';

const RtsView: React.FC = () => {
    const {
        expeditions,
        updateExpeditionDelivered,
        verifyReturn,
        playAudio
    } = useWms();

    const [filter, setFilter] = useState('');
    const [scannerInput, setScannerInput] = useState('');
    const [selectedExpedition, setSelectedExpedition] = useState<string | null>(null);
    const [scannedTbrs, setScannedTbrs] = useState<string[]>([]);

    const filteredExpeditions = useMemo(() => {
        return expeditions.filter(e => {
            const search = filter.toLowerCase();
            const nameMatch = (e.driver_name || '').toLowerCase().includes(search);
            const plateMatch = (e.plate || '').toLowerCase().includes(search);
            const dateMatch = (e.dispatch_date || '').includes(search);
            return nameMatch || plateMatch || dateMatch;
        });
    }, [expeditions, filter]);

    const stats = useMemo(() => {
        const totalSaida = filteredExpeditions.reduce((acc, e) => acc + e.total_packages, 0);
        const totalEntregue = filteredExpeditions.reduce((acc, e) => acc + e.delivered_count, 0);
        const totalRts = filteredExpeditions.reduce((acc, e) => acc + e.returned_count, 0);
        const rtsDrivers = new Set(filteredExpeditions.filter(e => e.returned_count > 0).map(e => e.driver_name));

        return {
            totalSaida,
            totalEntregue,
            totalRts,
            totalMotoristasRts: rtsDrivers.size
        };
    }, [filteredExpeditions]);

    const handleVerifyScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannerInput || !selectedExpedition) {
            playAudio('error');
            return;
        }

        const expedition = expeditions.find(exp => exp.id === selectedExpedition);
        if (!expedition) return;

        const result = await verifyReturn(scannerInput.trim().toUpperCase(), expedition.driver_name);

        if (result.success) {
            playAudio('success');
            const cleanTbr = scannerInput.trim().toUpperCase();
            if (!scannedTbrs.includes(cleanTbr)) {
                setScannedTbrs(prev => [cleanTbr, ...prev]);
            }
            setScannerInput('');
        } else {
            playAudio('error');
            alert(result.message);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const headers = ['Motorista', 'Placa', 'Data', 'Total Pacotes', 'Entregues', 'Devolvidos'];
        const rows = filteredExpeditions.map(e => [
            e.driver_name,
            e.plate,
            e.dispatch_date,
            e.total_packages,
            e.delivered_count,
            e.returned_count
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rts_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 border-blue-500">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Saída</p>
                    <p className="text-2xl font-display font-bold text-blue-500 mt-1">{stats.totalSaida}</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 border-emerald-500">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Entregue</p>
                    <p className="text-2xl font-display font-bold text-emerald-500 mt-1">{stats.totalEntregue}</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 border-orange-500">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total RTS</p>
                    <p className="text-2xl font-display font-bold text-orange-500 mt-1">{stats.totalRts}</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 border-l-4 border-purple-500">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Motorista RTS</p>
                    <p className="text-2xl font-display font-bold text-purple-500 mt-1">{stats.totalMotoristasRts}</p>
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-800 dark:text-white tracking-tight">
                        RTS Tracking
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gerenciamento de retornos e prestação de contas de motoristas.
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-all shadow-sm font-bold"
                >
                    <span className="material-icons-round">download</span>
                    Exportar Planilha
                </button>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                        <span className="material-icons-round">filter_list</span>
                        <h2 className="font-bold">Filtrar Expedições</h2>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por motorista, placa ou data..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white"
                    />
                </div>

                <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-3 text-orange-500">
                        <span className="material-icons-round">qr_code_scanner</span>
                        <h2 className="font-bold">Verificar Devolução</h2>
                    </div>
                    <form onSubmit={handleVerifyScan} className="flex gap-2">
                        <select
                            value={selectedExpedition || ''}
                            onChange={(e) => setSelectedExpedition(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 outline-none dark:text-white"
                        >
                            <option value="">Selecione o Motorista</option>
                            {expeditions.filter(e => e.status !== 'FINALIZADO').map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.driver_name} ({e.plate})
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Scan TBR..."
                            value={scannerInput}
                            onChange={(e) => setScannerInput(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none transition-all dark:text-white"
                        />
                        <button
                            type="submit"
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold"
                        >
                            OK
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={!selectedExpedition}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${selectedExpedition ? 'bg-slate-700 hover:bg-slate-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'}`}
                        >
                            <span className="material-icons-round text-sm">print</span>
                            COMPROVANTE
                        </button>
                    </form>
                </div>
            </div>

            {/* Print Section (Hidden by default) */}
            <div id="receipt-print-section" className="hidden print:block bg-white p-8 text-black font-sans min-h-screen">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        body * { visibility: hidden; }
                        #receipt-print-section, #receipt-print-section * { visibility: visible; }
                        #receipt-print-section { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
                        @page { margin: 1cm; }
                    }
                `}} />

                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tighter">Amazon Caxias <span className="text-slate-500 font-light">SGO9</span></h1>
                        <p className="text-sm font-bold mt-1 uppercase text-slate-700">Comprovante de Devolução (RTS)</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Data e Hora</p>
                        <p className="text-xs font-bold">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Sao_Paulo' })}</p>
                        <p className="text-xs font-bold">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</p>
                    </div>
                </div>

                {/* Driver Info */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Motorista</p>
                        <p className="text-lg font-bold uppercase">{expeditions.find(e => e.id === selectedExpedition)?.driver_name || 'NÃO SELECIONADO'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Placa / Veículo</p>
                        <p className="text-lg font-bold uppercase font-mono">{expeditions.find(e => e.id === selectedExpedition)?.plate || '---'}</p>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="text-center border py-3 rounded">
                        <p className="text-[9px] font-bold uppercase text-slate-500">Expedidos</p>
                        <p className="text-xl font-bold">{expeditions.find(e => e.id === selectedExpedition)?.total_packages || 0}</p>
                    </div>
                    <div className="text-center border py-3 rounded">
                        <p className="text-[9px] font-bold uppercase text-slate-500">Entregues</p>
                        <p className="text-xl font-bold text-emerald-600">{expeditions.find(e => e.id === selectedExpedition)?.delivered_count || 0}</p>
                    </div>
                    <div className="text-center border py-3 rounded">
                        <p className="text-[9px] font-bold uppercase text-slate-500">Devolvidos</p>
                        <p className="text-xl font-bold text-orange-600">{expeditions.find(e => e.id === selectedExpedition)?.returned_count || 0}</p>
                    </div>
                    <div className="text-center border py-3 rounded">
                        <p className="text-[9px] font-bold uppercase text-slate-500">Pendentes</p>
                        <p className="text-xl font-bold text-blue-600">
                            {(expeditions.find(e => e.id === selectedExpedition)?.total_packages || 0) -
                                ((expeditions.find(e => e.id === selectedExpedition)?.delivered_count || 0) +
                                    (expeditions.find(e => e.id === selectedExpedition)?.returned_count || 0))}
                        </p>
                    </div>
                </div>

                {/* Scanned Items */}
                <div className="mb-12">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 bg-slate-100 p-2 mb-4">Lista de Pacotes Devolvidos (Escaneados agora)</h3>
                    {scannedTbrs.length === 0 ? (
                        <p className="text-xs italic text-slate-400">Nenhum pacote escaneado nesta sessão.</p>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {scannedTbrs.map((tbr, idx) => (
                                <div key={idx} className="font-mono text-[10px] border p-1 text-center bg-slate-50">{tbr}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer / Signatures */}
                <div className="mt-20 grid grid-cols-2 gap-16">
                    <div className="text-center">
                        <div className="border-t border-slate-900 pt-2">
                            <p className="text-xs font-bold uppercase">Assinatura do Conferente</p>
                            <p className="text-[10px] text-slate-500 mt-1">{currentUser?.name || 'Sistema'}</p>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-slate-900 pt-2">
                            <p className="text-xs font-bold uppercase">Assinatura do Motorista</p>
                            <p className="text-[10px] text-slate-500 mt-1">Declaro que os itens acima foram conferidos</p>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="mt-12 text-center text-[8px] text-slate-400 uppercase tracking-widest">
                    <p>Este documento é gerado automaticamente pelo Sistema WMS SGO9 - © Amazon Caxias</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest font-bold">
                                <th className="px-6 py-4">Motorista</th>
                                <th className="px-6 py-4">Placa</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4 text-center">Total Saída</th>
                                <th className="px-6 py-4 text-center">Entregues</th>
                                <th className="px-6 py-4 text-center">Devolvidos</th>
                                <th className="px-6 py-4 text-center">Pendente</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredExpeditions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                        Nenhuma expedição encontrada.
                                    </td>
                                </tr>
                            ) : (
                                filteredExpeditions.map((e) => {
                                    const pending = e.total_packages - (e.delivered_count + e.returned_count);
                                    return (
                                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{e.driver_name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{e.plate}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{e.dispatch_date}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md font-bold">
                                                    {e.total_packages}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="number"
                                                    value={e.delivered_count}
                                                    onChange={(ev) => updateExpeditionDelivered(e.id, parseInt(ev.target.value) || 0)}
                                                    className="w-20 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md font-bold">
                                                    {e.returned_count}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-md font-bold ${pending === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                                                    {pending}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RtsView;
