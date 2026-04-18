import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ArrowUpFromLine, FileText, Settings, LogIn, LogOut, RefreshCw, PackageSearch, Lock, X, ShieldCheck, Eye, EyeOff, KeyRound, User as UserIcon, Book, WifiOff } from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Inicializa como VISITANTE por padrão
  const [currentUser, setCurrentUser] = useState<User>({ 
      email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true 
  });
  const [networkError, setNetworkError] = useState(false);
  const location = useLocation();
  
  // Login Modal State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  
  // Change Password Modal State
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changePassMsg, setChangePassMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const [showChangePass, setShowChangePass] = useState(false);

  const [loading, setLoading] = useState(false);

  // Versão e Data (Fixos do Build via Vite env)
  // O uso de 'as any' evita erros de TS se a tipagem do vite-env não estiver configurada
  // @ts-ignore
  const appVersion = import.meta.env.VITE_APP_VERSION || '2.0.0';
  // @ts-ignore
  const buildDate = import.meta.env.VITE_BUILD_DATE || 'Data N/D';

  useEffect(() => {
    const loadUser = async () => {
      const user = await inventoryService.getCurrentUser();
      setCurrentUser(user);
      setNetworkError(inventoryService.networkErrorStatus.isError);
    };
    
    loadUser();
    const unsubscribe = inventoryService.subscribe(() => {
      loadUser();
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  const canAccess = (allowedRoles: UserRole[]) => {
    if (!currentUser) return false;
    return allowedRoles.includes(currentUser.role);
  };

  const allNavItems = [
    { name: 'Painel de Gestão', path: '/', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] },
    { name: 'Entrada / NE', path: '/entry', icon: <Box size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Distribuição', path: '/distribution', icon: <ArrowUpFromLine size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] },
    { name: 'Estoque Geral', path: '/inventory', icon: <PackageSearch size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] },
    { name: 'Relatórios', path: '/reports', icon: <FileText size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.GUEST] },
    { name: 'Catálogo', path: '/catalog', icon: <Book size={20} />, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Configurações', path: '/settings', icon: <Settings size={20} />, roles: [UserRole.ADMIN] },
  ];

  const filteredNav = allNavItems.filter(item => canAccess(item.roles));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const success = await inventoryService.login(loginEmail, loginPass);
    if (success) { setIsLoginOpen(false); setLoginEmail(''); setLoginPass(''); } 
    else { setLoginError('E-mail ou senha incorretos.'); }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setChangePassMsg({ type: 'error', text: 'Senhas não conferem.' }); return; }
    if (newPass.length < 4) { setChangePassMsg({ type: 'error', text: 'Senha muito curta.' }); return; }
    setLoading(true); setChangePassMsg(null);
    const result = await inventoryService.changeOwnPassword(oldPass, newPass);
    if (result.success) { setChangePassMsg({ type: 'success', text: 'Senha alterada!' }); setTimeout(() => { setIsChangePassOpen(false); setOldPass(''); setNewPass(''); setConfirmPass(''); setChangePassMsg(null); setShowChangePass(false); }, 2000); } 
    else { setChangePassMsg({ type: 'error', text: result.message || 'Erro ao alterar.' }); }
    setLoading(false);
  };

  const handleLogout = async () => await inventoryService.logout();
  const handleRefresh = async () => await inventoryService.refreshData();
  const isGuest = currentUser?.role === UserRole.GUEST;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl z-10 print:hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-lg font-bold text-sky-400 tracking-tight leading-tight">SISTEMA <span className="text-white">DTIC-PRÓ</span></h1>
          <p className="text-xs font-medium text-slate-400 mt-2 uppercase tracking-wide">Gestão de Almoxarifado</p>
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-sm font-bold text-slate-200 uppercase tracking-widest">SEÇÃO LOGÍSTICA - {new Date().getFullYear()}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                {item.icon} {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700 bg-slate-900">
           {currentUser && !isGuest ? (
             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-1">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sky-400 font-bold shadow-inner shrink-0"><UserIcon size={20} /></div>
                    <div className="overflow-hidden"><p className="text-sm font-bold text-white truncate" title={currentUser.name}>{currentUser.name}</p><p className="text-[10px] text-slate-400 truncate uppercase">{currentUser.role}</p></div>
                </div>
                <div className="grid grid-cols-1 gap-2 mt-1">
                    <button onClick={() => setIsChangePassOpen(true)} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-bold uppercase tracking-wide border border-slate-700 hover:border-sky-500" title="Alterar Senha"><KeyRound size={14} /> Alterar Senha</button>
                    <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-bold uppercase tracking-wide border border-slate-700 hover:border-red-500" title="Sair"><LogOut size={14} /> Sair</button>
                </div>
             </div>
           ) : (
             <div className="text-center"><p className="text-xs text-slate-400 mb-3 uppercase font-bold tracking-wider">Modo Visitante</p><button onClick={() => setIsLoginOpen(true)} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"><LogIn size={18} /> Acessar Sistema</button></div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Network Error Banner */}
        {networkError && (
            <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-lg z-50 print:hidden">
                <div className="flex items-center gap-3">
                    <WifiOff className="h-6 w-6 animate-pulse" />
                    <div>
                        <p className="font-bold text-sm uppercase">Conexão com Banco de Dados Bloqueada</p>
                        <p className="text-xs opacity-90">A rede corporativa (Firewall) está impedindo o acesso ao Banco de Dados. Contate o Suporte Técnico.</p>
                    </div>
                </div>
                <button onClick={handleRefresh} className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-50">Tentar Novamente</button>
            </div>
        )}

        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20 print:hidden">
           <div className="md:hidden font-bold text-slate-800 flex flex-col leading-none"><span>SISTEMA</span><span className="text-sky-600 text-sm">DTIC-PRÓ</span></div>
           <div className="flex items-center gap-3 ml-auto">
              <button onClick={handleRefresh} className="p-2 text-slate-400 hover:text-sky-600 rounded-full hover:bg-sky-50 transition-colors" title="Atualizar"><RefreshCw size={20} /></button>
              {currentUser && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${isGuest ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                    {isGuest ? <Eye size={14} /> : <ShieldCheck size={14} />}
                    <span className="uppercase hidden sm:inline">{currentUser.role}</span>
                    {!isGuest && (<div className="flex items-center gap-2 pl-2 ml-2 border-l border-sky-200 md:hidden"><button onClick={() => setIsChangePassOpen(true)} className="text-sky-600 hover:text-sky-800"><KeyRound size={16} /></button><button onClick={handleLogout} className="text-red-500 hover:text-red-700"><LogOut size={16} /></button></div>)}
                </div>
              )}
           </div>
        </header>
        <main className="flex-1 overflow-auto p-6 md:p-8 print:p-0 print:overflow-visible flex flex-col">
            <div className="flex-1">
                {children}
            </div>
            
            {/* FOOTER DA VERSÃO */}
            <footer className="mt-8 pt-6 border-t border-slate-200 text-center print:hidden text-slate-500">
                <div className="flex flex-col items-center justify-center text-xs font-mono gap-1">
                    <p className="uppercase font-bold tracking-wider text-slate-400">Sistema de Controle Patrimonial DTIC-PRÓ</p>
                    <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">v{appVersion}</span>
                        <span>&bull;</span>
                        <span className="font-semibold">{buildDate}</span>
                    </div>
                </div>
            </footer>
        </main>
      </div>

      {/* Modals (Login/Pass) */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 text-center bg-slate-50 border-b border-slate-100"><div className="mx-auto w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mb-4 text-sky-600"><Lock size={24} /></div><h3 className="text-xl font-bold text-slate-800">Acesso Restrito</h3></div>
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                 {loginError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><X size={16} /> {loginError}</div>}
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label><input type="text" className="w-full p-3 bg-slate-50 border rounded-xl" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoFocus /></div>
                 <div><label className="block text-sm font-medium text-slate-700 mb-1">Senha</label><div className="relative"><input type={showLoginPass ? "text" : "password"} className="w-full p-3 bg-slate-50 border rounded-xl pr-10" value={loginPass} onChange={e => setLoginPass(e.target.value)} /><button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-3 top-3 text-slate-400">{showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                 <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl">{loading ? '...' : 'Entrar'}</button>
              </form>
              <div className="p-4 bg-slate-50 text-center border-t"><button onClick={() => setIsLoginOpen(false)} className="text-sm text-slate-500">Continuar como Visitante</button></div>
           </div>
        </div>
      )}
      {isChangePassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 flex justify-between bg-slate-50 border-b"><h3 className="font-bold flex gap-2"><KeyRound/> Senha</h3><button onClick={()=>setIsChangePassOpen(false)}><X/></button></div>
                <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                    {changePassMsg && <div className={`p-3 text-sm rounded ${changePassMsg.type==='error'?'bg-red-50 text-red-600':'bg-green-50 text-green-600'}`}>{changePassMsg.text}</div>}
                    <div className="space-y-3">
                        <div><label className="block text-sm font-medium">Atual</label><div className="relative"><input type={showChangePass?"text":"password"} className="w-full p-2 border rounded" value={oldPass} onChange={e=>setOldPass(e.target.value)}/><button type="button" onClick={()=>setShowChangePass(!showChangePass)} className="absolute right-2 top-2"><Eye size={16}/></button></div></div>
                        <div><label className="block text-sm font-medium">Nova</label><input type={showChangePass?"text":"password"} className="w-full p-2 border rounded" value={newPass} onChange={e=>setNewPass(e.target.value)}/></div>
                        <div><label className="block text-sm font-medium">Confirmar</label><input type={showChangePass?"text":"password"} className="w-full p-2 border rounded" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}/></div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-sky-600 text-white font-bold rounded">Salvar</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;