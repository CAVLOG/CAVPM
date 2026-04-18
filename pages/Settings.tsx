
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';
import { Users, UserPlus, Shield, Edit, Trash2, Check, X, Database, Save, Key, Lock, ShieldAlert, RefreshCw, Eye, EyeOff, HelpCircle } from 'lucide-react';

const Settings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [formData, setFormData] = useState<User>({ email: '', name: '', role: UserRole.OPERATOR, active: true, password: '' });
  const [showUserPass, setShowUserPass] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await inventoryService.getUsers();
      const current = await inventoryService.getCurrentUser();
      setCurrentUser(current);
      setUsers([...data]); 
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleOpenUserModal = (user?: User) => { setShowUserPass(false); if (user) { setEditingUser(user); setFormData({ ...user, password: '' }); } else { setEditingUser(null); setFormData({ email: '', name: '', role: UserRole.OPERATOR, active: true, password: '' }); } setIsUserModalOpen(true); };
  const handleOpenResetModal = (user: User) => { setEditingUser(user); setResetPassword(''); setShowUserPass(false); setIsResetModalOpen(true); };
  
  const handleResetPasswordSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!editingUser || !resetPassword) return; 
      setLoading(true); 
      const hash = await inventoryService.hashPassword(resetPassword); 
      const result = await inventoryService.saveUser({ ...editingUser, password: hash }); 
      
      if (result.success) {
          alert('Senha redefinida!'); 
          setIsResetModalOpen(false); 
          setEditingUser(null); 
          setResetPassword(''); 
      } else {
          alert("Erro ao redefinir senha: " + result.error);
      }
      setLoading(false); 
  };
  
  const handleSubmitUser = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!formData.email || !formData.name) return; 
      let userToSave = { ...formData }; 
      if (formData.password && formData.password.trim() !== '') { 
          const hash = await inventoryService.hashPassword(formData.password); 
          userToSave.password = hash; 
      } else { 
          if (editingUser) { userToSave.password = ''; } 
      } 
      setLoading(true); 
      const result = await inventoryService.saveUser(userToSave);
      
      if (result.success) {
          await loadUsers(); 
          setIsUserModalOpen(false); 
      } else {
          alert("Erro ao salvar usuário: " + result.error);
      }
      setLoading(false); 
  };
  
  const handleDelete = async (email: string) => { 
      if (!window.confirm('Excluir?')) return; 
      setLoading(true); 
      const user = users.find(u => u.email === email); 
      if (user) { 
          const result = await inventoryService.saveUser({ ...user, active: false }); 
          if (!result.success) alert("Erro ao excluir: " + result.error);
      } 
      await loadUsers(); 
      setLoading(false); 
  };
  
  const handleTestConnection = async () => { setTestingConnection(true); setConnectionStatus(null); const result = await inventoryService.testConnection(); setConnectionStatus(result); setTestingConnection(false); };
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  if (!isAdmin && currentUser?.role !== UserRole.GUEST) { return <div className="p-8 text-center text-red-600">Acesso Restrito</div>; }
  
  // No modo SQL, o Admin Resgate consegue acessar aqui para criar o primeiro usuário
  if (currentUser?.role === UserRole.GUEST) { 
      return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-slate-50 rounded-xl border border-slate-200 m-4">
        <div className="bg-orange-100 p-6 rounded-full mb-4"><Lock className="w-16 h-16 text-orange-600" /></div>
        <h2 className="text-2xl font-bold text-slate-800">Configurações Bloqueadas</h2>
        <p className="text-slate-600 mt-2 max-w-md mb-6">Apenas Administradores podem gerenciar usuários.</p>
        <p className="text-sm text-slate-400">Dica: Se este é o primeiro acesso ao Banco SQL, faça login com <strong>admin / admin</strong> para criar os usuários.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Shield className="text-sky-600" /> Configurações do Sistema</h2><p className="text-slate-500 mt-2">Gerenciamento de usuários e banco de dados.</p></div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2 mb-4"><Database size={20} className="text-emerald-600" /> Status do Banco de Dados (Supabase)</h3>
         <div className="space-y-4">
             <p className="text-sm text-slate-600">O sistema está conectado ao banco de dados SQL na nuvem. Você não precisa mais configurar URLs manualmente.</p>
             <div className="flex flex-wrap items-center gap-4 pt-2">
                 <button onClick={handleTestConnection} disabled={testingConnection} className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2">{testingConnection ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>} {testingConnection ? 'Testando...' : 'Verificar Conexão'}</button>
             </div>
             {connectionStatus && (<div className={`px-4 py-3 rounded-lg border text-sm animate-fade-in ${connectionStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{connectionStatus.message}</div>)}
         </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2"><Users size={20} /> Usuários Cadastrados</h3>
           <button onClick={() => handleOpenUserModal()} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-sky-600 transition-colors font-medium shadow-sm"><UserPlus size={18} /> Novo Usuário</button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr><th className="p-4">Nome</th><th className="p-4">E-mail</th><th className="p-4 text-center">Perfil</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (<tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum usuário encontrado no banco de dados.</td></tr>) : (
              users.map(user => (
                <tr key={user.email} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{user.name}</td>
                  <td className="p-4 text-slate-600 font-mono text-sm">{user.email}</td>
                  <td className="p-4 text-center text-sm font-bold uppercase">{user.role}</td>
                  <td className="p-4 text-center">{user.active ? <Check size={16} className="text-emerald-500 inline"/> : <X size={16} className="text-red-400 inline"/>}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleOpenUserModal(user)} className="p-2 text-slate-400 hover:text-accent" title="Editar"><Edit size={16} /></button>
                      <button onClick={() => handleOpenResetModal(user)} className="p-2 text-slate-400 hover:text-orange-500" title="Resetar Senha"><Key size={16} /></button>
                      {user.email !== 'admin@resgate' && (<button onClick={() => handleDelete(user.email)} className="p-2 text-slate-400 hover:text-red-500" title="Excluir"><Trash2 size={16} /></button>)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isResetModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><RefreshCw size={20} className="text-orange-500" /> Resetar Senha</h3>
               <button onClick={() => setIsResetModalOpen(false)}><X size={20} /></button>
             </div>
             <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                <div className="bg-orange-50 text-orange-800 p-3 rounded text-sm border border-orange-100">Redefinindo senha para <strong>{editingUser.name}</strong>. Crie uma senha temporária e informe ao usuário.</div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha Temporária</label>
                   <div className="relative">
                        <input type={showUserPass ? "text" : "password"} required autoFocus className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono pr-10" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowUserPass(!showUserPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">{showUserPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                   </div>
                </div>
                <div className="pt-4 flex gap-3">
                   <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button>
                   <button type="submit" className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold">Salvar Nova Senha</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setIsUserModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nome</label><input type="text" required className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label><input type="email" required disabled={!!editingUser} className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none disabled:opacity-60" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <div className="relative">
                    <Key className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type={showUserPass ? "text" : "password"} className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono pr-10" placeholder={editingUser ? "Mantenha vazio para não alterar" : "Crie uma senha"} value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                    <button type="button" onClick={() => setShowUserPass(!showUserPass)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">{showUserPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
                <select className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                   <option value={UserRole.ADMIN}>Administrador (Total)</option>
                   <option value={UserRole.MANAGER}>Gestor (Entradas/Saídas)</option>
                   <option value={UserRole.OPERATOR}>Operador</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="w-4 h-4" />
                <label className="text-sm text-slate-700">Usuário Ativo</label>
              </div>
              <div className="pt-4 flex gap-3">
                 <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-2 border rounded-lg">Cancelar</button>
                 <button type="submit" className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
