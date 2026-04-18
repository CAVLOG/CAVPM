
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Product, User, UserRole } from '../types';
import { Search, Filter, ChevronLeft, ChevronRight, AlertTriangle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ConsolidatedItem {
  name: string;
  totalQty: number;
  totalValue: number;
  unit: string;
  details: Product[];
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'consolidated' | 'detailed'>('consolidated');
  const [loading, setLoading] = useState(true);
  
  // Filtro de Críticos
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const location = useLocation();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await inventoryService.getCurrentUser();
        setCurrentUser(user);
        setProducts(await inventoryService.getProducts());
      } catch (e) {
        console.error("Failed to load inventory:", e);
      } finally {
        setLoading(false);
      }
    };
    
    load();
    return inventoryService.subscribe(load);
  }, []);

  // Verificar se veio do Dashboard com pedido de filtro
  useEffect(() => {
    if (location.state && location.state.filterCritical) {
        setShowCriticalOnly(true);
        setViewMode('detailed'); 
        window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Reset pagination when search or view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewMode, itemsPerPage, showCriticalOnly]);

  // Filter Logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.neId.toLowerCase().includes(search.toLowerCase());
    const matchesCritical = showCriticalOnly ? (p.currentBalance <= p.minStock) : true;
    return matchesSearch && matchesCritical;
  });

  // Logic for Consolidated View
  const consolidated = Object.values(filteredProducts.reduce((acc, curr) => {
    if (!acc[curr.name]) {
      acc[curr.name] = {
        name: curr.name,
        totalQty: 0,
        totalValue: 0,
        unit: curr.unit,
        details: []
      };
    }
    acc[curr.name].totalQty += curr.currentBalance;
    acc[curr.name].totalValue += (curr.currentBalance * curr.unitValue);
    acc[curr.name].details.push(curr);
    return acc;
  }, {} as Record<string, ConsolidatedItem>)) as ConsolidatedItem[];

  const dataToRender = viewMode === 'consolidated' ? consolidated : filteredProducts;
  const totalPages = Math.ceil(dataToRender.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = dataToRender.slice(startIndex, startIndex + itemsPerPage);
  
  const isAdmin = currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER);

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando estoque...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Estoque Geral</h2>
          <p className="text-slate-500">Consulta de saldos atuais</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <button 
            onClick={() => setViewMode('consolidated')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'consolidated' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Consolidado
          </button>
          <button 
             onClick={() => setViewMode('detailed')}
             className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Detalhado (por NE)
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center sticky top-0 z-10">
        <div className="flex-1 flex items-center gap-2 w-full border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-sky-500">
             <Search className="text-slate-400" />
             <input 
               type="text" 
               placeholder="Buscar por produto ou NE..." 
               className="flex-1 outline-none bg-transparent text-slate-800 placeholder-slate-400"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
        </div>
        
        <button
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                showCriticalOnly 
                ? 'bg-red-50 text-red-600 border-red-200 shadow-inner' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
        >
            {showCriticalOnly ? <X size={16} /> : <Filter size={16} />}
            {showCriticalOnly ? 'Remover Filtro' : 'Filtrar Críticos'}
            {showCriticalOnly && <AlertTriangle size={16} className="ml-1 fill-red-100" />}
        </button>
      </div>

      {showCriticalOnly && (
          <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-sm text-red-700 animate-fade-in">
              <AlertTriangle size={18} />
              <span>Exibindo apenas itens com estoque abaixo ou igual ao mínimo.</span>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600 text-sm">Produto</th>
                {viewMode === 'detailed' && <th className="p-4 font-semibold text-slate-600 text-sm">NE (Origem)</th>}
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Unidade</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Saldo Atual</th>
                {viewMode === 'detailed' && <th className="p-4 font-semibold text-slate-600 text-sm text-right">Valor Unit.</th>}
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Valor Total</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                  <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                          {showCriticalOnly 
                            ? "Nenhum item crítico encontrado." 
                            : "Nenhum produto cadastrado."}
                      </td>
                  </tr>
              ) : viewMode === 'consolidated' ? (
                (paginatedData as ConsolidatedItem[]).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{item.name}</td>
                    <td className="p-4 text-center text-slate-500 text-sm">{item.unit}</td>
                    <td className="p-4 text-right font-bold text-slate-700">{item.totalQty}</td>
                    <td className="p-4 text-right text-slate-600">R$ {item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                      {item.totalQty > 0 
                        ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        : <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                      }
                    </td>
                  </tr>
                ))
              ) : (
                (paginatedData as Product[]).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 font-medium text-slate-800">{item.name}</td>
                    <td className="p-4 text-slate-500 text-sm font-mono bg-slate-50 inline-block rounded m-2 px-2 py-1 border border-slate-200">{item.neId}</td>
                    <td className="p-4 text-center text-slate-500 text-sm">{item.unit}</td>
                    <td className={`p-4 text-right font-bold ${item.currentBalance <= item.minStock ? 'text-red-500' : 'text-slate-700'}`}>
                      {item.currentBalance}
                    </td>
                    <td className="p-4 text-right text-slate-500 text-sm">R$ {item.unitValue.toFixed(2)}</td>
                    <td className="p-4 text-right text-slate-600">R$ {(item.currentBalance * item.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                       {item.currentBalance <= item.minStock && item.currentBalance > 0 && (
                         <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-medium" title={`Mínimo: ${item.minStock}`}>Baixo</span>
                       )}
                       {item.currentBalance === 0 && (
                         <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full font-medium">Zerado</span>
                       )}
                       {item.currentBalance > item.minStock && (
                         <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full font-medium">OK</span>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <div className="text-sm text-slate-500">
                Exibindo {paginatedData.length > 0 ? startIndex + 1 : 0} a {Math.min(startIndex + itemsPerPage, dataToRender.length)} de {dataToRender.length} registros
            </div>
            <div className="flex items-center gap-2">
                <div className="mr-4">
                    <select 
                        value={itemsPerPage} 
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); }}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none"
                    >
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                    </select>
                </div>
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-medium px-2">
                    Página {currentPage} de {Math.max(1, totalPages)}
                </span>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
