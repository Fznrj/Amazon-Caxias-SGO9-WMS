import React, { useState, useMemo } from 'react';
import { useWms } from '../context/WmsContext';
import { getSaoPauloDate } from '../utils/dateUtils';
import PullToRefresh from '../components/PullToRefresh';

const RtsView: React.FC = () => {
    const {
        expeditions,
        stockItems,
        outboundItems,
        updateExpeditionDelivered,
        verifyReturn,
        playAudio,
        currentUser,
        refreshData
    } = useWms();

    const [filter, setFilter] = useState('');
    const [scannerInput, setScannerInput] = useState('');
    const [scannerInputPending, setScannerInputPending] = useState('');
    const [selectedExpedition, setSelectedExpedition] = useState<string | null>(null);
    const [scannedTbrs, setScannedTbrs] = useState<string[]>([]);
    const [scannedTbrsPending, setScannedTbrsPending] = useState<string[]>([]);

    const groupedExpeditions = useMemo(() => {
        const groups: Record<string, any> = {};
        expeditions.forEach(e => {
            const key = `${(e.driver_name || '').trim()}-${e.dispatch_date}`;
            if (!groups[key]) {
                const cleanPlate = (e.plate || '').replace(/\)+$/, '').trim();
                groups[key] = {
                    ...e,
                    plate: cleanPlate,
                    total_packages: Number(e.total_packages || 0),
                    delivered_count: Number(e.delivered_count || 0),
                    returned_count: Number(e.returned_count || 0)
                };
            } else {
                groups[key].total_packages += Number(e.total_packages || 0);
                groups[key].delivered_count += Number(e.delivered_count || 0);
                groups[key].returned_count += Number(e.returned_count || 0);
            }
        });
        return Object.values(groups);
    }, [expeditions]);

    const stats = useMemo(() => {
        const totalSaida = groupedExpeditions.reduce((acc, e) => acc + (e.total_packages || 0), 0);
        const totalEntregue = groupedExpeditions.reduce((acc, e) => acc + (e.delivered_count || 0), 0);
        const totalRts = groupedExpeditions.reduce((acc, e) => acc + (e.returned_count || 0), 0);
        const totalPendente = totalSaida - (totalEntregue + totalRts);
        const rtsDrivers = new Set(groupedExpeditions.filter(e => (e.returned_count || 0) > 0).map(e => e.driver_name));
        return { totalSaida, totalEntregue, totalRts, totalPendente, totalMotoristasRts: rtsDrivers.size };
    }, [groupedExpeditions]);

    const filteredExpeditions = useMemo(() => {
        const today = getSaoPauloDate();
        return groupedExpeditions.filter(e => {
            const search = filter.toLowerCase();
            const nameMatch = (e.driver_name || '').toLowerCase().includes(search);
            const plateMatch = (e.plate || '').toLowerCase().includes(search);
            const dateMatch = (e.dispatch_date || '').includes(search);
            const isToday = e.dispatch_date === today;
            return search.length > 0 ? (nameMatch || plateMatch || dateMatch) : isToday;
        });
    }, [groupedExpeditions, filter]);

    const handleVerifyScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannerInput || !selectedExpedition) { playAudio('error'); return; }
        const expedition = expeditions.find(exp => exp.id === selectedExpedition);
        if (!expedition) return;
        const result = await verifyReturn(scannerInput.trim().toUpperCase(), expedition.driver_name);
        if (result.success) {
            playAudio('success');
            const cleanTbr = scannerInput.trim().toUpperCase();
            if (!scannedTbrs.includes(cleanTbr)) setScannedTbrs(prev => [cleanTbr, ...prev]);
            setScannerInput('');
        } else {
            playAudio('error');
            alert(result.message);
        }
    };

    const handlePendingScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannerInputPending || !selectedExpedition) { playAudio('error'); return; }
        const cleanTbr = scannerInputPending.trim().toUpperCase();
        const isReturnedInDb = stockItems.some(item => item.id === cleanTbr && item.status === 'Em Estoque');
        if (scannedTbrs.includes(cleanTbr) || isReturnedInDb) {
            playAudio('error');
            alert(`ATENÇÃO: Este pacote (${cleanTbr}) já foi bipado como DEVOLUÇÃO.`);
            setScannerInputPending('');
            return;
        }
        if (!scannedTbrsPending.includes(cleanTbr)) {
            setScannedTbrsPending(prev => [cleanTbr, ...prev]);
            playAudio('success');
        } else {
            playAudio('error');
        }
        setScannerInputPending('');
    };

    const handlePrint = () => window.print();

    const handleExport = () => {
        const headers = ['Motorista', 'Placa', 'Data', 'Total Pacotes', 'Entregues', 'Devolvidos'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" +
            filteredExpeditions.map(e => [e.driver_name, e.plate, e.dispatch_date, e.total_packages, e.delivered_count, e.returned_count].join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `rts_report.csv`);
        link.click();
    };

    return (
        <PullToRefresh onRefresh={refreshData}>
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Saída</p>
                        <p className="text-2xl font-bold text-blue-500">{stats.totalSaida}</p>
                    </div>
                    <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border-l-4 border-emerald-500">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Entregue</p>
                        <p className="text-2xl font-bold text-emerald-500">{stats.totalEntregue}</p>
                    </div>
                    <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border-l-4 border-orange-500">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total RTS</p>
                        <p className="text-2xl font-bold text-orange-500">{stats.totalRts}</p>
                    </div>
                    <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Pendente</p>
                        <p className="text-2xl font-bold text-red-500">{stats.totalPendente}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">RTS Tracking</h1>
                    </div>
                    <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                        <span className="material-icons-round">download</span> Exportar
                    </button>
                </div>

                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="xl:w-1/4 bg-white dark:bg-card-dark p-4 rounded-xl border">
                        <input type="text" placeholder="Filtro..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg px-4 py-2 text-sm outline-none" />
                    </div>
                    <div className="flex-1 bg-white dark:bg-card-dark p-4 rounded-xl border">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <select value={selectedExpedition || ''} onChange={(e) => setSelectedExpedition(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 py-1.5 text-sm outline-none">
                                <option value="">Selecione o Motorista</option>
                                {groupedExpeditions.filter(e => e.status !== 'FINALIZADO').map(e => <option key={e.id} value={e.id}>{e.driver_name} ({e.plate})</option>)}
                            </select>
                            <button onClick={handlePrint} disabled={!selectedExpedition} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-white disabled:bg-slate-200">
                                <span className="material-icons-round text-xs">print</span> COMPROVANTE
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <form onSubmit={handleVerifyScan} className="flex-1 flex gap-2">
                                <input type="text" placeholder="Devolução..." value={scannerInput} onChange={(e) => setScannerInput(e.target.value)} className="flex-1 bg-slate-50 border rounded-lg px-4 py-2 text-sm outline-none" />
                                <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase">DEV</button>
                            </form>
                            <form onSubmit={handlePendingScan} className="flex-1 flex gap-2">
                                <input type="text" placeholder="Pendente..." value={scannerInputPending} onChange={(e) => setScannerInputPending(e.target.value)} className="flex-1 bg-blue-50 border rounded-lg px-4 py-2 text-sm outline-none" />
                                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase">PEN</button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-xl border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold uppercase tracking-widest text-slate-500">
                                    <th className="px-6 py-4">Motorista</th>
                                    <th className="px-6 py-4">Placa</th>
                                    <th className="px-6 py-4 text-center">Saída</th>
                                    <th className="px-6 py-4 text-center">Entregues</th>
                                    <th className="px-6 py-4 text-center">RTS</th>
                                    <th className="px-6 py-4 text-center">Pendente</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredExpeditions.map((e) => {
                                    const pending = (e.total_packages || 0) - ((e.delivered_count || 0) + (e.returned_count || 0));
                                    return (
                                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                            <td className="px-6 py-4 font-bold">{e.driver_name}</td>
                                            <td className="px-6 py-4 font-mono">{e.plate}</td>
                                            <td className="px-6 py-4 text-center font-bold">{e.total_packages}</td>
                                            <td className="px-6 py-4 text-center">
                                                <input type="number" value={e.delivered_count} onChange={(ev) => updateExpeditionDelivered(e.id, parseInt(ev.target.value) || 0)} className="w-16 text-center border rounded p-1 font-bold outline-none" />
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-orange-600">{e.returned_count}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded font-bold ${pending === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pending}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PullToRefresh>
    );
};

export default RtsView;
