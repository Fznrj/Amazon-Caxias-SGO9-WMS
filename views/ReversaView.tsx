import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';
import { PrintService } from '../services/PrintService';
import { getTodayDate, getSaoPauloIso } from '../utils/dateUtils';

interface ScannedItem {
    id: string;
    time: string;
    status: 'success' | 'error';
    rack: number;
}

import { isValidTbr } from '../utils/validation';

export default function ReversaView() {
    const { drivers, addOutboundItem, bulkAddOutboundItems, currentUser, verifyStock, playAudio } = useWms();
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [palletId, setPalletId] = useState('');
    const [origin, setOrigin] = useState('SGO9');
    const [destination, setDestination] = useState('GIG7');
    const [tbrInput, setTbrInput] = useState('');

    const handlePrintLabel = () => {
        if (!palletId) {
            alert("Por favor, informe o código do pallet (Master ID).");
            return;
        }

        const now = getTodayDate();
        const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' BRT';

        PrintService.printPalletLabel({
            palletId: palletId.toUpperCase(),
            origin: origin.toUpperCase(),
            destination: destination.toUpperCase(),
            date: formattedDate,
            packageCount: scannedItems.length
        });
    };

    const handleTbrScan = async (e: any) => {
        if (e.key === 'Enter' && tbrInput.trim()) {
            const input = tbrInput.trim().toUpperCase();

            // Rule Validation
            const validation = isValidTbr(input);
            if (!validation.isValid) {
                alert(validation.message);
                playAudio('error');
                setTbrInput('');
                return;
            }

            // Validate Stock
            const validationStock = await verifyStock(input);
            if (!validationStock.success) {
                alert(validationStock.message);
                playAudio('error');
                setTbrInput('');
                return;
            }

            // Check if already in current list
            if (scannedItems.some(item => item.id === input)) {
                alert('TBR já está no pallet!');
                playAudio('error');
                setTbrInput('');
                return;
            }

            const newItem: ScannedItem = {
                id: input,
                time: getTodayDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                status: 'success',
                rack: Math.floor(Math.random() * 20) + 1 // Simulação de Rack
            };
            setScannedItems(prev => [newItem, ...prev]);
            setTbrInput('');
            playAudio('success');
        }
    };

    const handleExpedition = async () => {
        if (scannedItems.length === 0) {
            alert("O pallet está vazio. Bipe pelo menos uma unidade TBR.");
            return;
        }

        if (!palletId) {
            alert("Informe o Código do Pallet (Master ID) antes de expedir.");
            return;
        }

        if (!selectedDriverId) {
            alert("Selecione um motorista para realizar a expedição.");
            return;
        }

        const driver = drivers.find(d => d.id === selectedDriverId);
        if (!driver) return;

        const confirmExpedicao = window.confirm(`Deseja expedir este pallet com ${scannedItems.length} unidades para o motorista ${driver.name}?`);

        if (confirmExpedicao) {
            try {
                // Registrar a saída de cada item
                const itemsToExpedite = scannedItems.map(item => ({
                    id: item.id,
                    driverName: driver.name,
                    vehicle: driver.plate,
                    time: getSaoPauloIso(),
                    operator: currentUser?.name || 'Sistema',
                    status: 'Reversa - Saiu com Motorista',
                    palletId: palletId.toUpperCase()
                } as any));

                const result = await bulkAddOutboundItems(itemsToExpedite);

                if (result.success) {
                    alert("Pallet expedido com sucesso!");
                    // Limpar estados
                    setScannedItems([]);
                    setPalletId('');
                    setSelectedDriverId('');
                    setTbrInput('');
                } else {
                    alert(`Falha na expedição: ${result.message}`);
                }
            } catch (error) {
                console.error("Erro ao expedir pallet:", error);
                alert("Ocorreu um erro ao processar a expedição. Verifique o console.");
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto w-full p-4 md:p-0 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Reversa & Palletizing</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gerenciamento de unidades TBR e expedição de pallets reversos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-primary">
                                <span className="material-icons-round font-bold">qr_code_scanner</span>
                                <h3 className="font-bold text-sm uppercase tracking-wider">Identificação do Master</h3>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Código do Pallet (Master ID)</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg h-14 px-4 text-lg font-mono focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Scan Master Pallet ID..."
                                        type="text"
                                        value={palletId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPalletId(val);
                                            // Auto-detect destination if possible
                                            const parts = val.split('-');
                                            if (parts.length > 2) {
                                                setDestination(parts[parts.length - 1].toUpperCase());
                                            }
                                        }}
                                    />
                                    <button onClick={handlePrintLabel} className="aspect-square h-14 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-primary dark:hover:bg-primary text-slate-600 dark:text-slate-400 hover:text-white transition-all rounded-lg border border-slate-200 dark:border-slate-700 group" title="Imprimir Etiqueta">
                                        <span className="material-icons-round">print</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Origem</label>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                            value={origin}
                                            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Destino</label>
                                        <input
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                            value={destination}
                                            onChange={(e) => setDestination(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={handlePrintLabel} className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer">
                                        <span className="material-icons-round text-xs">visibility</span> VISUALIZAR ETIQUETA
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#161d2b] border-2 border-primary/30 dark:border-primary/20 rounded-xl p-6 shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3">
                            <span className="flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-4 text-primary">
                            <span className="material-icons-round font-bold">input</span>
                            <h3 className="font-bold text-sm uppercase tracking-wider">Continuous Scan Mode</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Scan TBR Unit</label>
                                <div className="relative group">
                                    <input
                                        autoFocus
                                        className="w-full bg-primary/5 dark:bg-primary/10 border-primary/40 dark:border-primary/30 rounded-lg h-16 px-4 pr-12 text-xl font-mono text-primary focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-primary/40"
                                        placeholder="Waiting for scan..."
                                        type="text"
                                        value={tbrInput}
                                        onChange={(e) => setTbrInput(e.target.value)}
                                        onKeyDown={handleTbrScan}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/60">
                                        <span className="material-icons-round animate-pulse">sensors</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                <span>Status: Pronto para leitura</span>
                                <span className="flex items-center gap-1"><span className="material-icons-round text-xs">volume_up</span> Feedback Sonoro Ativo</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-white dark:bg-[#161d2b] p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">TBRs Scanned</p>
                                <p className="text-4xl font-black text-primary">{scannedItems.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col min-h-[500px]">
                    <div className="bg-white dark:bg-[#161d2b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="flex items-center gap-2">
                                <span className="material-icons-round text-slate-500">list_alt</span>
                                <h3 className="font-bold text-sm uppercase tracking-wider">Unidades no Pallet</h3>
                            </div>
                            <button className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                                <span className="material-icons-round text-sm">delete</span> LIMPAR TUDO
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[600px]">
                            {scannedItems.map((item, index) => (
                                <div key={index} className={`flex items-center justify-between p-3 border rounded-lg group transition-all ${item.status === 'success' ? 'bg-green-500/10 dark:bg-green-500/5 border-green-500/20 hover:border-green-500/40' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-400'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`${item.status === 'success' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'} text-white p-1 rounded-full`}>
                                            <span className="material-icons-round text-sm">{item.status === 'success' ? 'check' : 'inventory_2'}</span>
                                        </div>
                                        <div>
                                            <p className={`font-mono text-sm font-bold ${item.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}>{item.id}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">Scanned at {item.time} • Rack {item.rack}</p>
                                        </div>
                                    </div>
                                    <button className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-all">
                                        <span className="material-icons-round text-lg">close</span>
                                    </button>
                                </div>
                            ))}



                            <div className="flex items-center justify-between p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                <div className="flex items-center gap-4 opacity-30">
                                    <div className="bg-slate-200 dark:bg-slate-800 w-7 h-7 rounded-full"></div>
                                    <div className="space-y-1">
                                        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                                        <div className="h-2 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="w-full md:w-64 space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motorista Designado</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-white dark:bg-[#161d2b] border-slate-200 dark:border-slate-800 rounded-lg text-sm appearance-none h-11 px-3 shadow-inner focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                                            value={selectedDriverId}
                                            onChange={(e) => setSelectedDriverId(e.target.value)}
                                        >
                                            <option value="">Selecione o Motorista...</option>
                                            {drivers.filter(d => d.status === 'Ativo').map(driver => (
                                                <option key={driver.id} value={driver.id}>
                                                    {driver.name} - {driver.plate}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                    <button onClick={handlePrintLabel} className="px-6 py-3.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-lg flex items-center justify-center gap-3 transition-all">
                                        <span className="material-icons-round">print</span>
                                        IMPRIMIR ETIQUETA
                                    </button>
                                    <button
                                        onClick={handleExpedition}
                                        className="flex-1 md:flex-none px-10 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <span className="material-icons-round">local_shipping</span>
                                        EXPEDIR PALLET
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
