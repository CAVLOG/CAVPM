
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { CatalogItem, UserRole } from '../types';
import { Book, Plus, Search, Trash2, Save, X, Tag, Wand2, AlertTriangle } from 'lucide-react';

const PREDEFINED_CATEGORIES = [
  "Material de Escritório",
  "Material de Expediente",
  "Material de Informática / TIC",
  "Equipamentos de Comunicação",
  "Materiais de Limpeza e Higiene",
  "Materiais de Copa e Cozinha",
  "Gêneros Alimentícios",
  "Equipamentos Permanentes / Bens Duráveis",
  "Ferramentas e Ferragens",
  "Materiais Elétricos",
  "Materiais Hidráulicos",
  "Materiais de Construção",
  "Materiais de Segurança / EPIs",
  "Materiais de Saúde",
  "Materiais de Manutenção",
  "Materiais Automotivos",
  "Materiais Diversos"
];

// Mapeamento de Palavras-Chave para Categorias
const CATEGORY_RULES: Record<string, string[]> = {
  "Material de Escritório": ["papel", "sulfite", "a4", "caneta", "lápis", "lapiseira", "pasta", "clips", "grampo", "grampeador", "post-it", "bloco", "toner", "cartucho", "tinta impressora", "corretivo", "marcador", "regua", "tesoura", "perfurador"],
  "Material de Expediente": ["etiqueta", "envelope", "carimbo", "bobina", "talão", "livro ata", "protocolo", "crachá"],
  "Material de Informática / TIC": ["mouse", "teclado", "monitor", "hd", "ssd", "nobreak", "estabilizador", "roteador", "switch", "cabo rede", "rj45", "hdmi", "usb", "pendrive", "webcam", "headset", "notebook", "computador", "servidor"],
  "Equipamentos de Comunicação": ["transceptor", "ht", "radio", "antena", "fonte", "coaxial", "bateria radio", "microfone", "ptt"],
  "Materiais de Limpeza e Higiene": ["detergente", "desinfetante", "agua sanitaria", "cloro", "sabão", "sabao", "pano", "esponja", "luva latex", "saco lixo", "papel higienico", "papel toalha", "vassoura", "rodo", "balde", "limpa vidros", "cera", "multiuso", "alcool"],
  "Materiais de Copa e Cozinha": ["copo", "prato", "talher", "garfo", "faca", "colher", "guardanapo", "saco", "embalagem", "filme pvc", "aluminio", "fosforo", "isquerio"],
  "Gêneros Alimentícios": ["arroz", "feijão", "feijao", "açucar", "acucar", "sal", "oleo", "azeite", "café", "cafe", "leite", "achocolatado", "macarrão", "macarrao", "farinha", "fuba", "biscoito", "bolacha", "tempero", "agua mineral", "suco", "refrigerante", "carne", "frango", "pão", "pao"],
  "Equipamentos Permanentes / Bens Duráveis": ["mesa", "cadeira", "armario", "estante", "arquivo", "ar condicionado", "ventilador", "bebedouro", "geladeira", "microondas", "tv", "televisao", "projetor"],
  "Ferramentas e Ferragens": ["furadeira", "parafusadeira", "serra", "alicate", "chave", "martelo", "trena", "parafuso", "bucha", "prego", "fechadura", "dobradiça", "cadeado"],
  "Materiais Elétricos": ["extensão", "extensao", "lampada", "lâmpada", "disjuntor", "tomada", "plug", "cabo eletrico", "fio", "reator", "bocal", "fita isolante"],
  "Materiais Hidráulicos": ["cano", "pvc", "conexão", "conexao", "registro", "torneira", "mangueira", "vedante", "veda rosca", "sifão", "ralo"],
  "Materiais de Construção": ["tinta", "massa", "areia", "cimento", "cal", "tijolo", "piso", "argamassa", "tela", "grade"],
  "Materiais de Segurança / EPIs": ["capacete", "luva raspa", "oculos", "protetor auricular", "mascara", "colete", "bota", "extintor", "cone", "fita zebrada"],
  "Materiais de Saúde": ["termometro", "curativo", "gaze", "esparadrapo", "algodão", "algodao"],
  "Materiais de Manutenção": ["oleo lubrificante", "graxa", "desengripante", "wd40", "cola", "adesivo"],
  "Materiais Automotivos": ["filtro oleo", "filtro ar", "lampada auto", "pneu", "aditivo", "fluido"]
};

const Catalog: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.GUEST);

  const [newItem, setNewItem] = useState<CatalogItem>({ name: '', unit: 'UN', category: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      // Tenta carregar usuário e catálogo
      const user = await inventoryService.getCurrentUser();
      setCurrentUserRole(user.role);
      
      const data = await inventoryService.getCatalog();
      setCatalog(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const suggestCategory = (name: string): string => {
    const lowerName = name.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return category;
        }
    }
    return '';
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      const suggested = suggestCategory(name);
      setNewItem(prev => ({
          ...prev,
          name: name,
          category: suggested || prev.category
      }));
  };

  // Helper para normalizar strings (remove acentos e espaços extras)
  const normalizeText = (text: string) => {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, ' ') // Remove múltiplos espaços
        .trim()
        .toUpperCase();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;

    // VERIFICAÇÃO DE DUPLICIDADE
    const normalizedNewName = normalizeText(newItem.name);
    const existingItem = catalog.find(item => normalizeText(item.name) === normalizedNewName);

    if (existingItem) {
        alert(`O produto "${existingItem.name}" já existe no catálogo.\nEvite cadastrar itens duplicados com pequenas variações de nome.`);
        return;
    }

    setLoading(true);
    const itemToSave = {
        ...newItem,
        category: newItem.category || "Materiais Diversos"
    };
    const success = await inventoryService.saveCatalogItem(itemToSave);
    if (success) {
      setIsModalOpen(false);
      setNewItem({ name: '', unit: 'UN', category: '' });
      await loadData();
    } else {
        alert("Erro ao salvar. Verifique sua conexão.");
        setLoading(false);
    }
  };

  const handleDelete = async (item: CatalogItem) => {
    if (!window.confirm(`Excluir "${item.name}" do catálogo?`)) return;
    setLoading(true);
    await inventoryService.deleteCatalogItem(item);
    await loadData();
  };

  const filteredCatalog = catalog.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = [UserRole.ADMIN, UserRole.MANAGER].includes(currentUserRole);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Book className="text-purple-600" /> Catálogo de Produtos
          </h2>
          <p className="text-slate-500 mt-2">Padronização de nomes e categorias para entrada de estoque.</p>
        </div>
        {canEdit && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Plus size={18} /> Novo Item
            </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por nome ou categoria..." 
                className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                    <th className="p-4">Nome Padronizado</th>
                    <th className="p-4 text-center">Unidade</th>
                    <th className="p-4 text-center">Categoria</th>
                    {canEdit && <th className="p-4 text-center">Ações</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Carregando...</td></tr>
                ) : filteredCatalog.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                        <AlertTriangle className="opacity-50" />
                        <span>Nenhum item encontrado no catálogo.</span>
                        {canEdit && <span className="text-xs">Cadastre o primeiro item acima.</span>}
                    </td></tr>
                ) : (
                    filteredCatalog.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">{item.name}</td>
                            <td className="p-4 text-center text-slate-600 bg-slate-50 mx-auto rounded text-xs font-mono w-20 block mt-3">{item.unit}</td>
                            <td className="p-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                    <Tag size={12} /> {item.category || 'Geral'}
                                </span>
                            </td>
                            {canEdit && (
                                <td className="p-4 text-center">
                                    <button onClick={() => handleDelete(item)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Novo Item do Catálogo</h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
                        <div className="relative">
                            <input 
                                type="text" required autoFocus
                                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 pr-8"
                                placeholder="Ex: Caneta Esferográfica Azul"
                                value={newItem.name}
                                onChange={handleNameChange}
                            />
                            {newItem.category && (
                                <Wand2 className="absolute right-3 top-3 text-purple-400 animate-pulse" size={16} />
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">A categoria será sugerida automaticamente ao digitar.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Unidade Padrão</label>
                        <select 
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
                            value={newItem.unit}
                            onChange={e => setNewItem({...newItem, unit: e.target.value})}
                        >
                            <option value="UN">UN - Unidade</option>
                            <option value="CX">CX - Caixa</option>
                            <option value="PCT">PCT - Pacote</option>
                            <option value="KG">KG - Quilo</option>
                            <option value="L">L - Litro</option>
                            <option value="M">M - Metro</option>
                            <option value="RESMA">RESMA</option>
                            <option value="PAR">PAR</option>
                            <option value="JOGO">JOGO</option>
                            <option value="KIT">KIT</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Categoria (Automática)</label>
                        <select
                            className={`w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none transition-colors ${newItem.category ? 'border-purple-300 bg-purple-50 text-purple-900 font-medium' : ''}`}
                            value={newItem.category}
                            onChange={e => setNewItem({...newItem, category: e.target.value})}
                            required
                        >
                            <option value="">Selecione uma categoria...</option>
                            {PREDEFINED_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? 'Salvando...' : <><Save size={18} /> Salvar no Catálogo</>}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;
