
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryService } from '../services/inventoryService';
import { AlertCircle, CheckCircle, ShoppingCart, Printer, Trash2, ArrowUpFromLine, Package, UserCheck, Info, Building2, User as UserIcon, RefreshCw, Loader2, PenTool, Eraser, Layers } from 'lucide-react';
import { UserRole, User as UserType } from '../types';

interface CartItem {
  productName: string;
  requestedQty: number;
  allocations: { productId: string; neId: string; qty: number; unitValue: number; productName: string }[];
  isPossible: boolean;
}

// Interface consolidada para exibição (não mostra batches individuais na UI)
interface ConsolidatedProduct {
  name: string;
  unit: string;
  totalBalance: number;
  batches: any[]; // Mantido caso precise de debug, mas não usado na UI primária
}

const Distribution: React.FC = () => {
  const [availableProducts, setAvailableProducts] = useState<ConsolidatedProduct[]>([]);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [observation, setObservation] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  
  // Assinatura Digital
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const loadData = useCallback(async () => {
     try {
      const user = await inventoryService.getCurrentUser();
      setCurrentUser(user);
      // Carrega estoque consolidado para a UI (Soma de todas as NEs)
      const stock = await inventoryService.getConsolidatedStockForDistribution();
      setAvailableProducts(stock);
     } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = inventoryService.subscribe(loadData);
    const bgSync = async () => { setIsSyncing(true); await inventoryService.refreshData(); setIsSyncing(false); };
    bgSync();
    return unsub;
  }, [loadData, success]);

  // --- ALTERAÇÃO PARA O NOME DO ARQUIVO PDF ---
  // Atualiza o título da página quando o recibo é gerado para sugerir o nome correto ao "Salvar como PDF"
  useEffect(() => {
    if (success && receiptData) {
        const originalTitle = document.title;
        // Substitui barras por hífens para ser um nome de arquivo válido (Ex: REC-001/2026 -> Recibo_REC-001-2026)
        const safeId = receiptData.id.replace(/\//g, '-');
        document.title = `Recibo_${safeId}`;
        
        return () => {
            document.title = originalTitle;
        };
    }
  }, [success, receiptData]);
  
  const handleManualRefresh = async () => {
    setIsSyncing(true);
    await inventoryService.refreshData();
    setIsSyncing(false);
  };

  const isGuest = currentUser?.role === UserRole.GUEST;
  
  // Encontra o produto consolidado selecionado
  const selectedProduct = availableProducts.find(p => p.name === selectedProductName);
  
  // CORREÇÃO: Calcular quantidade já "reservada" no carrinho para este produto
  const reservedInCart = cart
    .filter(item => item.productName === selectedProductName)
    .reduce((acc, item) => acc + item.requestedQty, 0);

  const maxTotalBalance = selectedProduct?.totalBalance || 0;
  const remainingAvailable = Math.max(0, maxTotalBalance - reservedInCart);
  const isQuantityValid = quantity > 0 && quantity <= remainingAvailable;

  // --- CANVAS ---
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current; if(!canvas)return; const ctx=canvas.getContext('2d'); if(!ctx)return;
    setIsDrawing(true); const {offsetX,offsetY} = getCoordinates(e,canvas); ctx.beginPath(); ctx.moveTo(offsetX,offsetY);
  };
  const draw = (e: any) => {
    if(!isDrawing)return; const canvas=canvasRef.current; if(!canvas)return; const ctx=canvas.getContext('2d'); if(!ctx)return;
    const {offsetX,offsetY} = getCoordinates(e,canvas); ctx.lineTo(offsetX,offsetY); ctx.stroke();
  };
  const stopDrawing = () => {
    const canvas=canvasRef.current; if(!canvas)return; const ctx=canvas.getContext('2d'); if(ctx)ctx.closePath(); setIsDrawing(false);
  };
  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
    let clientX, clientY; if('touches' in e){ clientX=e.touches[0].clientX; clientY=e.touches[0].clientY; }else{ clientX=e.clientX; clientY=e.clientY; }
    const rect = canvas.getBoundingClientRect(); return { offsetX: clientX-rect.left, offsetY: clientY-rect.top };
  };
  const clearSignature = () => { const c=canvasRef.current; if(c) c.getContext('2d')?.clearRect(0,0,c.width,c.height); };
  const initCanvas = () => { setTimeout(() => { const c=canvasRef.current; if(c){ const ctx=c.getContext('2d'); if(ctx){ ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='black'; }}}, 100); };

  // --- ACTIONS ---
  const handleAddToDistribution = async () => {
    if (!selectedProductName || quantity <= 0 || !selectedProduct) return;
    
    // Validação extra de segurança
    if (quantity > remainingAvailable) {
        alert(`Quantidade indisponível. Você já tem ${reservedInCart} no carrinho.`);
        return;
    }

    setLoading(true);
    try {
        // CORREÇÃO: Passamos para o serviço a quantidade que JÁ está no carrinho.
        // O serviço vai "pular" essa quantidade dos lotes mais antigos antes de calcular a nova alocação.
        const result = await inventoryService.calculateDistribution(selectedProductName, quantity, reservedInCart);
        
        if (result.itemsToDeduct.length === 0 || result.remainingQty > 0) {
            alert('Erro de cálculo: O saldo disponível já foi comprometido pelos itens no carrinho.');
            setLoading(false);
            return;
        }

        const newItem: CartItem = { 
            productName: selectedProductName, 
            requestedQty: quantity, 
            allocations: result.itemsToDeduct, // Lista de lotes quebrados (ex: 5 da NE-A, 10 da NE-B)
            isPossible: true 
        };
        
        setCart(prev => [...prev, newItem]); 
        setQuantity(0); 
        setSelectedProductName('');
    } catch (e) { alert('Erro ao processar adição.'); } finally { setLoading(false); }
  };

  const handleRemoveItem = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));
  const handleInitiateFinalize = () => { if (cart.length > 0 && !cart.some(c=>!c.isPossible) && !isGuest) { setShowSignatureModal(true); initCanvas(); } };

  const handleConfirmSignatureAndSave = async () => {
    setLoading(true);
    try {
        let signatureDataUrl = null;
        if (canvasRef.current) signatureDataUrl = canvasRef.current.toDataURL('image/png');

        // Flat map das alocações para envio ao backend
        const allMovements: any[] = [];
        cart.forEach(item => item.allocations.forEach(alloc => allMovements.push(alloc)));
        
        const result = await inventoryService.executeDistribution(
          allMovements, 
          currentUser?.email || 'user@email.com', 
          observation
        );
        
        if (result.success) {
          const receiptId = result.receiptId || `REC-${Date.now().toString().slice(-6)}/${new Date().getFullYear()}`;
          setReceiptData({
            id: receiptId,
            date: new Date().toLocaleString('pt-BR'),
            items: cart,
            totalValue: allMovements.reduce((sum, m) => sum + (m.qty * m.unitValue), 0),
            obs: observation,
            receiverName,
            distributorName: currentUser?.name || 'Sistema',
            signature: signatureDataUrl 
          });
          setSuccess(true); setCart([]); setObservation(''); setReceiverName(''); setShowSignatureModal(false);
        }
    } catch (e) { alert('Falha ao executar.'); } 
    finally { setLoading(false); }
  };

  if (success && receiptData) {
    return (
      // Adicionado print:bg-white print:block print:p-0 para limpar o layout na impressão
      <div className="flex flex-col items-center min-h-screen bg-slate-100 pb-12 print:bg-white print:block print:min-h-0 print:pb-0 print:overflow-visible">
        
        {/* Adicionado print:hidden explicitamente para ocultar o cabeçalho de sucesso */}
        <div className="no-print print:hidden w-full max-w-4xl mt-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full text-emerald-600 mb-4 shadow-sm"><CheckCircle size={32} /></div>
          <h2 className="text-2xl font-bold text-slate-800">Distribuição Realizada!</h2>
          <div className="flex justify-center gap-4 mt-6">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-lg"><Printer size={20} /> Imprimir Recibo</button>
            <button onClick={() => { setSuccess(false); setReceiptData(null); }} className="px-6 py-3 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 shadow-sm">Nova Distribuição</button>
          </div>
        </div>

        <div className="sheet-a4 bg-white shadow-2xl print:shadow-none p-[20mm] text-slate-900 box-border relative flex flex-col">
          <div className="flex items-center gap-6 border-b-2 border-black pb-6 mb-6">
            <div className="w-20 h-20 flex items-center justify-center border-2 border-black rounded-lg bg-slate-50 print:bg-transparent"><Building2 size={40} className="text-black" /></div>
            <div className="flex-1 overflow-hidden">
               <h1 className="text-base font-bold uppercase whitespace-nowrap leading-tight">POLICIA MILITAR DO ESTADO DE SÃO PAULO</h1>
               <h2 className="text-sm font-bold uppercase leading-tight mt-1">Diretoria de Tecnologia da Informação e Comunicação</h2>
               <h3 className="text-sm font-bold uppercase mt-1">Seção Logística - 2026</h3>
            </div>
            <div className="text-right shrink-0">
               <div className="border border-black px-3 py-1 rounded"><p className="text-xs font-bold uppercase">Controle Nº</p><p className="text-lg font-mono font-bold">{receiptData.id}</p></div>
            </div>
          </div>
          <div className="text-center mb-8"><h2 className="text-xl font-bold uppercase border bg-slate-100 print:bg-transparent border-black py-2 rounded">Recibo de Entrega de Material</h2></div>
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
             <div className="border border-black p-3 rounded relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-bold uppercase">Origem / Emissor</span>
                <p><span className="font-semibold">Unidade:</span> Seção Logística - DTIC</p>
                <p><span className="font-semibold">Responsável:</span> {receiptData.distributorName}</p>
                <p><span className="font-semibold">Data de Emissão:</span> {receiptData.date}</p>
             </div>
             <div className="border border-black p-3 rounded relative">
                <span className="absolute -top-2 left-2 bg-white px-1 text-xs font-bold uppercase">Destinatário / Requisitante</span>
                <p><span className="font-semibold">Nome:</span> {receiptData.receiverName || '___________________________'}</p>
                <p><span className="font-semibold">Destino/Setor:</span> {receiptData.obs || '___________________________'}</p>
                <p><span className="font-semibold">Status:</span> <span className="uppercase">Atendido</span></p>
             </div>
          </div>
          <div className="flex-1">
            <table className="w-full border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-200 text-black">
                  <th className="border border-black px-2 py-1 w-12 text-center">#</th><th className="border border-black px-2 py-1 text-left">Descrição</th><th className="border border-black px-2 py-1 w-24 text-center">Origem (NE)</th><th className="border border-black px-2 py-1 w-20 text-right">Qtd</th><th className="border border-black px-2 py-1 w-28 text-right">Vl. Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.items.map((item: CartItem, idx: number) => {
                  const totalItemValue = item.allocations.reduce((acc, a) => acc + (a.qty * a.unitValue), 0);
                  const nes = Array.from(new Set(item.allocations.map(a => a.neId))).join(', ');
                  return (
                    <tr key={idx}>
                      <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border border-black px-2 py-1 font-semibold">{item.productName}</td>
                      <td className="border border-black px-2 py-1 text-center text-xs">{nes}</td>
                      <td className="border border-black px-2 py-1 text-right font-bold">{item.requestedQty}</td>
                      <td className="border border-black px-2 py-1 text-right">R$ {totalItemValue.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 print:bg-slate-200 font-bold">
                   <td colSpan={3} className="border border-black px-2 py-1 text-right uppercase">Total Geral</td>
                   <td className="border border-black px-2 py-1 text-right">{receiptData.items.reduce((acc: number, i: any) => acc + i.requestedQty, 0)}</td>
                   <td className="border border-black px-2 py-1 text-right">R$ {receiptData.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-8 border border-black p-4 rounded">
             <p className="text-xs text-justify mb-8 leading-relaxed">DECLARO ter recebido os materiais constantes neste documento em perfeitas condições de uso e conservação, assumindo a responsabilidade pela sua guarda e utilização no serviço público, comprometendo-me a comunicar imediatamente qualquer irregularidade.</p>
             <div className="flex justify-between gap-8 mt-12 mb-4 px-4 items-end">
                <div className="flex-1 text-center flex flex-col justify-end h-full pb-1">
                   <p className="font-bold uppercase text-sm">{receiptData.distributorName}</p>
                   <p className="text-xs">Almoxarifado / Expedidor</p>
                </div>
                <div className="flex-1 text-center flex flex-col items-center">
                   <div className="w-full border-b border-black mb-1 relative h-16 flex items-end justify-center">
                      {receiptData.signature ? <img src={receiptData.signature} alt="Assinatura" className="absolute bottom-0 h-20 object-contain pointer-events-none" /> : null}
                   </div>
                   <p className="font-bold uppercase text-sm">{receiptData.receiverName || '_____________________________'}</p>
                   <p className="text-xs">Recebedor</p>
                </div>
             </div>
          </div>
          <div className="mt-4 text-center text-[10px] text-slate-500">Sistema DTIC-PMESP - Emitido em {receiptData.date}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><ArrowUpFromLine className="text-accent" /> Distribuição de Material</h2>
            <p className="text-slate-500 mt-2">Saída Automática FIFO: O sistema seleciona os lotes mais antigos.</p>
        </div>
        <button onClick={handleManualRefresh} disabled={isSyncing} className={`text-sm text-sky-600 hover:underline flex items-center gap-1 ${isSyncing ? 'opacity-50' : ''}`}>{isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {isSyncing ? 'Sincronizando...' : 'Atualizar Lista'}</button>
      </header>
      {isGuest && <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg flex items-center gap-3"><Info /> <span className="font-medium">Modo Simulação.</span></div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-lg mb-4 text-slate-700">Adicionar Produto</h3>
          {availableProducts.length === 0 && !isSyncing && <div className="bg-orange-50 border border-orange-100 text-orange-700 p-3 rounded text-sm mb-4">Sem saldo.</div>}
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Produto (Saldo Total)</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm" value={selectedProductName} onChange={e => { setSelectedProductName(e.target.value); setQuantity(0); }}>
                    <option value="">Selecione o produto...</option>
                    {availableProducts.map((p, idx) => (
                        <option key={idx} value={p.name}>
                          {p.name} (Total: {p.totalBalance} {p.unit} em {p.batches.length} Lotes)
                        </option>
                    ))}
                </select>
                {selectedProduct && (
                    <div className="mt-2 flex flex-col gap-1 text-sm bg-blue-50 text-blue-700 p-2 rounded border border-blue-100 animate-fade-in">
                        <div className="flex items-center gap-2"><Layers size={16} /> <span>Saída: <strong>Automática (FIFO)</strong></span></div>
                        <div className="flex items-center gap-2"><Package size={16} /> <span>Disponível Total: <strong>{selectedProduct.totalBalance} {selectedProduct.unit}</strong></span></div>
                        {reservedInCart > 0 && (
                            <div className="flex items-center gap-2 text-orange-600"><ShoppingCart size={16} /> <span>No carrinho: <strong>{reservedInCart} {selectedProduct.unit}</strong></span></div>
                        )}
                        {remainingAvailable === 0 ? (
                            <p className="text-xs font-bold text-red-600 mt-1">
                              Todo o estoque disponível já está no carrinho.
                            </p>
                        ) : (
                            <p className="text-xs font-bold text-emerald-600 mt-1">
                                Restam {remainingAvailable} {selectedProduct.unit} para selecionar.
                            </p>
                        )}
                        <p className="text-xs opacity-75 mt-1 border-t border-blue-200 pt-1">
                          Este item está distribuído em <strong>{selectedProduct.batches.length} notas de empenho</strong>. O sistema utilizará as mais antigas primeiro.
                        </p>
                    </div>
                )}
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label><input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} min="0" max={remainingAvailable} disabled={!selectedProductName || remainingAvailable === 0} /></div>
            <button onClick={handleAddToDistribution} disabled={loading || !selectedProductName || !isQuantityValid} className="w-full mt-2 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50">Adicionar à Lista</button>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px]">
          <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2"><ShoppingCart size={20} /> Itens para Saída</h3>
          <div className="flex-1 overflow-y-auto space-y-4">
            {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 rounded-lg"><Package size={48} className="mb-2 opacity-50" /><p>Nenhum item</p></div> : cart.map((item, idx) => {
                // Cálculo visual das NEs usadas
                const usedNEs = Array.from(new Set(item.allocations.map(a => a.neId))).join(', ');
                return (
                    <div key={idx} className={`p-4 rounded-lg border ${item.isPossible ? 'border-slate-200 bg-slate-50' : 'border-red-300 bg-red-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-slate-800">{item.productName}</h4>
                                <p className="text-sm text-slate-500">Qtd: {item.requestedQty} <span className="text-xs bg-slate-200 px-1 rounded ml-2">Origem: {usedNEs}</span></p>
                            </div>
                            <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                        {!item.isPossible ? <div className="flex items-center gap-2 text-red-600 text-sm mt-2"><AlertCircle size={16} /><span>Estoque insuficiente!</span></div> : null}
                    </div>
                );
            })}
          </div>
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Distribuidor</label><div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 flex items-center gap-2"><UserCheck size={18} /><span className="font-medium truncate">{currentUser?.name}</span></div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Recebedor</label><div className="relative"><UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} /><input type="text" className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" placeholder="Quem retira" value={receiverName} onChange={e => setReceiverName(e.target.value)} /></div></div>
            </div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Observações</label><input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg mb-4" placeholder="Destino..." value={observation} onChange={e => setObservation(e.target.value)} />
            <div className="flex justify-end gap-4"><button onClick={() => setCart([])} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Limpar</button><button onClick={handleInitiateFinalize} disabled={loading || cart.length === 0 || cart.some(c => !c.isPossible) || isGuest} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">{isGuest ? 'Login Necessário' : <><CheckCircle size={18} /> Confirmar</>}</button></div>
          </div>
        </div>
      </div>
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><PenTool size={18} /> Assinatura do Recebedor</h3><button onClick={() => setShowSignatureModal(false)} className="text-slate-400 hover:text-white">✕</button></div>
                <div className="p-6 flex flex-col items-center">
                    <p className="text-sm text-slate-600 mb-4 text-center">Assine abaixo.</p>
                    <div className="border-2 border-slate-300 border-dashed bg-slate-50 rounded-lg touch-none overflow-hidden cursor-crosshair relative"><canvas ref={canvasRef} width={400} height={200} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="bg-white" /><div className="absolute bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none select-none">Assinatura</div></div>
                    <div className="mt-6 flex gap-4 w-full"><button onClick={clearSignature} className="flex-1 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"><Eraser size={16} /> Limpar</button><button onClick={handleConfirmSignatureAndSave} disabled={loading} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Salvar</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
export default Distribution;
