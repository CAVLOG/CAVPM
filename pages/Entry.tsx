
import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Plus, Trash2, Save, PackagePlus, CheckCircle, Info, Lock, ShieldAlert, Search, AlertCircle, Loader2, List, FileEdit, ChevronDown, ChevronUp, X } from 'lucide-react';
import { User, UserRole, CatalogItem, Product, NotaEmpenho } from '../types';

interface NewItem {
  name: string;
  unit: string;
  qtyPerPackage: number;
  initialQty: number;
  unitValue: number;
  minStock: number;
}

const Entry: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'new' | 'manage'>('new');

  // NE State (Tab New)
  const [neNumber, setNeNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [neDate, setNeDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingNE, setExistingNE] = useState<any>(null);
  const [checkingNE, setCheckingNE] = useState(false);
  
  // Item Form State (Tab New)
  const [currentItem, setCurrentItem] = useState<NewItem>({
    name: '', unit: 'UN', qtyPerPackage: 1, initialQty: 0, unitValue: 0, minStock: 0
  });

  const [itemsList, setItemsList] = useState<NewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Management State (Tab Manage)
  const [recentNEs, setRecentNEs] = useState<NotaEmpenho[]>([]);
  const [expandedNE, setExpandedNE] = useState<string | null>(null);
  const [neItems, setNeItems] = useState<Product[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchManage, setSearchManage] = useState('');

  // Add Item to Existing NE State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetNE, setTargetNE] = useState<NotaEmpenho | null>(null);
  const [manualItem, setManualItem] = useState<NewItem>({
    name: '', unit: 'UN', qtyPerPackage: 1, initialQty: 0, unitValue: 0, minStock: 0
  });

  useEffect(() => {
    const load = async () => {
       try {
         const user = await inventoryService.getCurrentUser();
         setCurrentUser(user);
         const cat = await inventoryService.getCatalog();
         setCatalog(cat);
       } catch (e) {
         console.error(e);
       } finally {
         setPageLoading(false);
       }
    };
    load();
  }, []);

  // Verificar NE ao digitar (Tab New)
  useEffect(() => {
    const verifyNE = async () => {
      if (neNumber.length >= 3) {
        setCheckingNE(true);
        const data = await inventoryService.getNotaEmpenho(neNumber.toUpperCase());
        if (data) {
          setExistingNE(data);
          setSupplier(data.supplier);
          setNeDate(new Date(data.date).toISOString().split('T')[0]);
        } else {
          setExistingNE(null);
        }
        setCheckingNE(false);
      } else {
        setExistingNE(null);
      }
    };
    const timer = setTimeout(verifyNE, 500);
    return () => clearTimeout(timer);
  }, [neNumber]);

  // Carregar NEs Recentes (Tab Manage)
  useEffect(() => {
    if (activeTab === 'manage') {
        const fetchNEs = async () => {
            const nes = await inventoryService.getRecentNEs();
            setRecentNEs(nes);
        };
        fetchNEs();
    }
  }, [activeTab]);

  const hasAccess = currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER);
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Handlers Tab New
  const handleProductSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const found = catalog.find(c => c.name === val);
    setCurrentItem(prev => ({
        ...prev,
        name: val,
        unit: found ? found.unit : prev.unit
    }));
  };

  const handleAddItem = () => {
    if (!currentItem.name || currentItem.initialQty <= 0 || currentItem.unitValue <= 0) return;
    setItemsList(prev => [...prev, currentItem]);
    setCurrentItem({
      name: '', unit: 'UN', qtyPerPackage: 1, initialQty: 0, unitValue: 0, minStock: 0
    });
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveNE = async () => {
    if (!neNumber || !supplier || itemsList.length === 0 || !hasAccess) return;
    setLoading(true);
    try {
        const success = await inventoryService.createNotaEmpenho(
          { number: neNumber.toUpperCase(), supplier, date: neDate },
          itemsList
        );
        if (success) {
          setSuccessMsg(existingNE 
            ? `Itens adicionados à Nota de Empenho ${neNumber}!` 
            : `Nota de Empenho ${neNumber} cadastrada com sucesso!`);
          setNeNumber(''); setSupplier(''); setItemsList([]); setExistingNE(null);
          setTimeout(() => setSuccessMsg(''), 5000);
        } else {
          alert('Erro ao processar a gravação. Verifique se os dados estão corretos.');
        }
    } catch(e) { alert('Erro inesperado ao salvar.'); } 
    finally { setLoading(false); }
  };

  const totalValueNE = itemsList.reduce((acc, item) => acc + (item.initialQty * item.unitValue), 0);

  // Handlers Tab Manage
  const toggleNE = async (neId: string) => {
      if (expandedNE === neId) {
          setExpandedNE(null);
          setNeItems([]);
      } else {
          setExpandedNE(neId);
          setLoadingItems(true);
          const items = await inventoryService.getProductsByNE(neId);
          setNeItems(items);
          setLoadingItems(false);
      }
  };

  const handleDeleteEntryItem = async (product: Product) => {
      if (!isAdmin) {
          alert('Apenas Administradores podem excluir registros.');
          return;
      }
      if (!window.confirm(`ATENÇÃO ADMIN: Tem certeza que deseja excluir "${product.name}"?\n\nO valor será estornado da NE e as movimentações de entrada serão apagadas.`)) return;
      
      const result = await inventoryService.deleteProductEntry(product.id);
      if (result.success) {
          // Atualiza a lista local
          const updatedItems = neItems.filter(p => p.id !== product.id);
          setNeItems(updatedItems);
          
          // Se não houver mais itens, a NE foi excluída no backend, atualizar lista de NEs
          if (updatedItems.length === 0) {
              setRecentNEs(prev => prev.filter(n => n.id !== product.neId));
              setExpandedNE(null);
          } else {
              // Atualiza valor visual da NE na lista
              const valueRemoved = product.initialQty * product.unitValue;
              setRecentNEs(prev => prev.map(n => n.id === product.neId ? { ...n, totalValue: Math.max(0, n.totalValue - valueRemoved) } : n));
          }
          alert(result.message);
      } else {
          alert(result.message);
      }
  };

  // --- Handlers para Adicionar Item em NE Existente ---

  const handleOpenAddModal = (ne: NotaEmpenho) => {
    setTargetNE(ne);
    setManualItem({ name: '', unit: 'UN', qtyPerPackage: 1, initialQty: 0, unitValue: 0, minStock: 0 });
    setIsAddModalOpen(true);
  };

  const handleManualProductSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const found = catalog.find(c => c.name === val);
    setManualItem(prev => ({
        ...prev,
        name: val,
        unit: found ? found.unit : prev.unit
    }));
  };

  const handleSaveItemToExistingNE = async () => {
      if (!targetNE || !manualItem.name || manualItem.initialQty <= 0) return;
      
      setLoading(true);
      try {
          // Reutiliza a função createNotaEmpenho. Como o ID já existe, ela apenas adiciona itens e atualiza o total.
          const success = await inventoryService.createNotaEmpenho(
              { number: targetNE.id, supplier: targetNE.supplier, date: targetNE.date },
              [manualItem]
          );

          if (success) {
              alert('Item adicionado com sucesso!');
              setIsAddModalOpen(false);
              
              // Atualiza a lista de itens da NE aberta
              setLoadingItems(true);
              const updatedItems = await inventoryService.getProductsByNE(targetNE.id);
              setNeItems(updatedItems);
              setLoadingItems(false);

              // Atualiza o valor total na lista de NEs
              const updatedNEs = await inventoryService.getRecentNEs();
              setRecentNEs(updatedNEs);
          } else {
              alert('Erro ao adicionar item.');
          }
      } catch (e) {
          console.error(e);
          alert('Erro ao processar.');
      } finally {
          setLoading(false);
      }
  };

  if (pageLoading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="bg-red-50 p-6 rounded-full mb-4"><ShieldAlert className="w-16 h-16 text-red-600" /></div>
        <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>
        <p className="text-slate-500 mt-2 max-w-md">Seu perfil ({currentUser?.role}) não possui permissão para realizar Entradas.</p>
      </div>
    );
  }

  const filteredNEs = recentNEs.filter(ne => ne.id.includes(searchManage.toUpperCase()) || ne.supplier.toLowerCase().includes(searchManage.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <PackagePlus className="text-emerald-600" /> Entrada de Nota de Empenho
          </h2>
          <p className="text-slate-500 mt-2">Cadastro de NE e inclusão de novos materiais ao estoque.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
          <button 
             onClick={() => setActiveTab('new')}
             className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'new' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
             Nova Entrada
          </button>
          <button 
             onClick={() => setActiveTab('manage')}
             className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'manage' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
             Gerenciar/Corrigir Entradas
          </button>
      </div>

      {activeTab === 'new' ? (
        <>
            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg flex items-center gap-3 animate-fade-in shadow-sm">
                <CheckCircle /> <span className="font-medium">{successMsg}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-700 border-b pb-2">Dados da NE</h3>
                    <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                        Número da NE
                        {checkingNE && <Loader2 size={14} className="animate-spin text-sky-500" />}
                        </label>
                        <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none uppercase font-bold focus:ring-2 focus:ring-sky-500" value={neNumber} onChange={e => setNeNumber(e.target.value)} placeholder="Ex: 2026NE00123" />
                        {existingNE && (
                        <div className="mt-2 text-xs bg-amber-50 text-amber-700 p-2 rounded border border-amber-200 flex items-center gap-2">
                            <AlertCircle size={14} /> <span>NE já cadastrada. Novos itens serão <strong>anexados</strong> a ela.</span>
                        </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
                        <input type="text" className={`w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none ${existingNE ? 'opacity-70 bg-slate-100 cursor-not-allowed' : ''}`} value={supplier} onChange={e => setSupplier(e.target.value)} disabled={!!existingNE} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão</label>
                        <input type="date" className={`w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none ${existingNE ? 'opacity-70 bg-slate-100 cursor-not-allowed' : ''}`} value={neDate} onChange={e => setNeDate(e.target.value)} disabled={!!existingNE} />
                    </div>
                    </div>
                </div>
                <div className={`p-6 rounded-xl shadow-lg transition-colors ${existingNE ? 'bg-amber-600' : 'bg-slate-800'} text-white`}>
                    <p className="text-sm text-white/70 mb-1">Valor Total do Lote</p>
                    <p className="text-3xl font-bold font-mono">R$ {totalValueNE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-white/70 mt-2">{itemsList.length} itens no lote atual</p>
                    <button onClick={handleSaveNE} disabled={loading || !neNumber || itemsList.length === 0} className={`mt-6 w-full py-3 ${existingNE ? 'bg-white text-amber-700 hover:bg-amber-50' : 'bg-emerald-500 hover:bg-emerald-600 text-white'} font-bold rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}>
                    {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> {existingNE ? 'Anexar Itens' : 'Salvar e Confirmar'}</>}
                    </button>
                </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-700 flex items-center gap-2"><Plus size={20} className="text-emerald-600" /> Adicionar Item</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Busque no Catálogo)</label>
                        <input list="catalog-list" type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-accent" value={currentItem.name} onChange={handleProductSelect} placeholder="Digite para buscar..." />
                        <datalist id="catalog-list">{catalog.map((c, i) => <option key={i} value={c.name} />)}</datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                        <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none bg-slate-50" value={currentItem.unit} onChange={e => setCurrentItem({...currentItem, unit: e.target.value})}>
                        <option value="UN">UN</option><option value="CX">CX</option><option value="PCT">PCT</option><option value="KG">KG</option><option value="L">L</option><option value="RESMA">RESMA</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Qtd (Unidades)</label>
                        <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-accent" value={currentItem.initialQty} onChange={e => { const qty = parseFloat(e.target.value) || 0; setCurrentItem({ ...currentItem, initialQty: qty, minStock: Math.ceil(qty * 0.10) }); }} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unit. (R$)</label>
                        <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-accent" value={currentItem.unitValue} onChange={e => setCurrentItem({...currentItem, unitValue: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mín. (Sugestão 10%)</label>
                        <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-slate-600" value={currentItem.minStock} onChange={e => setCurrentItem({...currentItem, minStock: parseFloat(e.target.value) || 0})} />
                    </div>
                    </div>
                    <div className="flex justify-end">
                    <button onClick={handleAddItem} disabled={!currentItem.name || currentItem.initialQty <= 0} className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">Incluir Item no Lote</button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Lote de Novos Itens</h3>
                    <span className="text-sm bg-slate-200 px-2 py-1 rounded text-slate-600">{itemsList.length} itens prontos</span>
                    </div>
                    {itemsList.length > 0 ? (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr><th className="p-3">Produto</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Ação</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {itemsList.map((item, idx) => (
                            <tr key={idx}>
                            <td className="p-3 text-slate-800 font-medium">{item.name}</td>
                            <td className="p-3 text-right font-bold">{item.initialQty}</td>
                            <td className="p-3 text-right">R$ {(item.initialQty * item.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center"><button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    ) : <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2"><Search size={32} className="opacity-20" /><span>Adicione itens acima para listar aqui.</span></div>}
                </div>
                </div>
            </div>
        </>
      ) : (
          <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <Search className="text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar NE por número ou fornecedor..." 
                    className="flex-1 outline-none bg-transparent"
                    value={searchManage}
                    onChange={e => setSearchManage(e.target.value)}
                  />
              </div>

              <div className="space-y-4">
                  {filteredNEs.length === 0 ? (
                      <div className="text-center p-8 text-slate-500">Nenhuma Nota de Empenho encontrada.</div>
                  ) : (
                      filteredNEs.map(ne => (
                          <div key={ne.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                              <div 
                                onClick={() => toggleNE(ne.id)}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                                      <div className="font-bold text-slate-800 font-mono text-lg">{ne.id}</div>
                                      <div className="text-sm text-slate-500">{ne.supplier}</div>
                                      <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{new Date(ne.date).toLocaleDateString('pt-BR')}</div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <div className="font-bold text-emerald-600">R$ {ne.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                      {expandedNE === ne.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                  </div>
                              </div>
                              
                              {expandedNE === ne.id && (
                                  <div className="border-t border-slate-100 bg-slate-50 p-4 animate-fade-in">
                                      {loadingItems ? (
                                          <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
                                      ) : (
                                        <div className="space-y-4">
                                          {/* Barra de Ações da NE */}
                                          {hasAccess && (
                                              <div className="flex justify-end">
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenAddModal(ne); }}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
                                                  >
                                                      <Plus size={16} /> Adicionar Item a esta NE
                                                  </button>
                                              </div>
                                          )}

                                          {neItems.length === 0 ? (
                                              <div className="text-center text-slate-500 text-sm">Nenhum item encontrado (NE Vazia).</div>
                                          ) : (
                                              <table className="w-full text-sm text-left">
                                                  <thead className="text-slate-500 font-medium border-b border-slate-200">
                                                      <tr>
                                                          <th className="pb-2">Produto</th>
                                                          <th className="pb-2 text-right">Qtd Inicial</th>
                                                          <th className="pb-2 text-right">Saldo Atual</th>
                                                          <th className="pb-2 text-right">Valor Unit.</th>
                                                          <th className="pb-2 text-center">Ações</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-200">
                                                      {neItems.map(item => (
                                                          <tr key={item.id}>
                                                              <td className="py-2 text-slate-700">{item.name}</td>
                                                              <td className="py-2 text-right">{item.initialQty} {item.unit}</td>
                                                              <td className={`py-2 text-right font-bold ${item.currentBalance < item.initialQty ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                                  {item.currentBalance} {item.unit}
                                                              </td>
                                                              <td className="py-2 text-right">R$ {item.unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                              <td className="py-2 text-center">
                                                                  {isAdmin ? (
                                                                      item.currentBalance === item.initialQty ? (
                                                                          <button 
                                                                            onClick={() => handleDeleteEntryItem(item)}
                                                                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                                            title="Excluir item (apenas se não houver saída)"
                                                                          >
                                                                              <Trash2 size={16} />
                                                                          </button>
                                                                      ) : (
                                                                          <span className="text-xs text-orange-400 cursor-help" title="Item já distribuído/movimentado. Estorne a saída antes de excluir.">
                                                                              <Lock size={16} />
                                                                          </span>
                                                                      )
                                                                  ) : (
                                                                    <span title="Apenas Administradores podem excluir"><ShieldAlert size={16} className="text-slate-300 mx-auto" /></span>
                                                                  )}
                                                              </td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                          )}
                                        </div>
                                      )}
                                      <div className="mt-4 text-xs text-slate-400 flex items-center gap-2">
                                          <Info size={12} />
                                          <p>Só é possível excluir itens que ainda <strong>não tiveram saídas</strong>. Caso necessário, realize o estorno da saída na aba Relatórios primeiro.</p>
                                          {!isAdmin && <p className="ml-4 font-bold text-orange-500">Exclusão restrita a Administradores.</p>}
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* Modal de Adição de Item em NE Existente */}
      {isAddModalOpen && targetNE && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Plus size={18} /> Adicionar Item à NE {targetNE.id}
                    </h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Busque no Catálogo)</label>
                        <input list="modal-catalog-list" type="text" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={manualItem.name} onChange={handleManualProductSelect} placeholder="Digite para buscar..." autoFocus />
                        <datalist id="modal-catalog-list">{catalog.map((c, i) => <option key={i} value={c.name} />)}</datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                            <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={manualItem.unit} onChange={e => setManualItem({...manualItem, unit: e.target.value})}>
                                <option value="UN">UN</option><option value="CX">CX</option><option value="PCT">PCT</option><option value="KG">KG</option><option value="L">L</option><option value="RESMA">RESMA</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                            <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={manualItem.initialQty} onChange={e => { const qty = parseFloat(e.target.value) || 0; setManualItem({ ...manualItem, initialQty: qty, minStock: Math.ceil(qty * 0.10) }); }} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unit. (R$)</label>
                            <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={manualItem.unitValue} onChange={e => setManualItem({...manualItem, unitValue: parseFloat(e.target.value) || 0})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mínimo</label>
                            <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={manualItem.minStock} onChange={e => setManualItem({...manualItem, minStock: parseFloat(e.target.value) || 0})} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100">Cancelar</button>
                    <button 
                        onClick={handleSaveItemToExistingNE} 
                        disabled={loading || !manualItem.name || manualItem.initialQty <= 0} 
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar Item
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Entry;
