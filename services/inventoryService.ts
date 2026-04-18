
import { Product, NotaEmpenho, Movement, MovementType, DashboardStats, NEStatus, User, UserRole, CatalogItem } from '../types';
import { supabase } from './supabaseClient';

class InventoryService {
  private listeners: (() => void)[] = [];
  private cachedUser: User | null = null;

  constructor() {}

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notifyListeners() { this.listeners.forEach(l => l()); }

  async testConnection() {
    try {
      const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      if (error) throw error;
      return { success: true, message: "Conectado ao Banco de Dados SQL (Supabase)!" };
    } catch (e: any) {
      console.error(e);
      return { success: false, message: `Erro de conexão: ${e.message}. Verifique o arquivo supabaseClient.ts` };
    }
  }

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = encoder.encode("DTIC_ALMOXARIFADO_SECURE_SALT_2026");
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const exported = await crypto.subtle.exportKey("raw", key);
    return Array.from(new Uint8Array(exported)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async getCurrentUser(): Promise<User> {
    const storedEmail = localStorage.getItem('almoxarifado_user');
    if (!storedEmail) return { email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true };
    if (storedEmail === 'admin@resgate') return { email: 'admin@resgate', name: 'Admin Resgate', role: UserRole.ADMIN, active: true };
    if (this.cachedUser && this.cachedUser.email === storedEmail) return this.cachedUser;

    const { data } = await supabase.from('users').select('*').ilike('email', storedEmail).eq('active', true).maybeSingle();
    if (data) {
      this.cachedUser = { email: data.email, name: data.name, role: data.role as UserRole, active: data.active, password: data.password };
      return this.cachedUser;
    }
    return { email: 'public@guest.com', name: 'Visitante', role: UserRole.GUEST, active: true };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    if (!password || password.trim() === '') return false;
    const { data: user } = await supabase.from('users').select('*').ilike('email', normalizedEmail).eq('active', true).maybeSingle();
    if (user) {
      const storedPass = (user.password || '').trim();
      if (storedPass.length === 64 && /^[0-9a-fA-F]+$/.test(storedPass)) {
          const inputHash = await this.hashPassword(password.trim());
          if (storedPass === inputHash) { this.setCurrentUser(user); return true; }
      } else if (storedPass === password.trim()) {
          const newHash = await this.hashPassword(password.trim());
          await supabase.from('users').update({ password: newHash }).eq('id', user.id);
          this.setCurrentUser(user); return true;
      }
      return false;
    }
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if ((count === 0 || count === null) && (normalizedEmail === 'admin' || normalizedEmail === 'admin@resgate')) {
       if (password === 'admin') {
         this.setCurrentUser({ email: 'admin@resgate', name: 'Admin Resgate', role: UserRole.ADMIN, active: true });
         return true;
       }
    }
    return false;
  }

  async logout() { localStorage.removeItem('almoxarifado_user'); this.cachedUser = null; this.notifyListeners(); }
  private setCurrentUser(user: any) { localStorage.setItem('almoxarifado_user', user.email); this.cachedUser = user; this.notifyListeners(); }

  async getUsers() {
    const { data } = await supabase.from('users').select('*').order('name');
    return (data || []).map((u: any) => ({ ...u, role: u.role as UserRole }));
  }

  async saveUser(user: User) {
    const { data: existing } = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle();
    const payload: any = { email: user.email.toLowerCase(), name: user.name, role: user.role, active: user.active };
    if (user.password) payload.password = user.password;
    let error = null;
    if (existing) { const result = await supabase.from('users').update(payload).eq('id', existing.id); error = result.error; }
    else { const result = await supabase.from('users').insert([payload]); error = result.error; }
    return { success: !error, error: error?.message };
  }

  async changeOwnPassword(oldP: string, newP: string) {
    const currentUser = await this.getCurrentUser();
    const { data: userInDb } = await supabase.from('users').select('*').ilike('email', currentUser.email).single();
    if (!userInDb) return { success: false, message: 'Usuário não encontrado.' };
    const storedPass = (userInDb.password || '').trim();
    let isOldCorrect = false;
    if (storedPass.length === 64) { const oldH = await this.hashPassword(oldP.trim()); isOldCorrect = (oldH === storedPass); }
    else { isOldCorrect = (storedPass === oldP.trim()); }
    if (!isOldCorrect) return { success: false, message: 'Senha atual incorreta.' };
    const newHash = await this.hashPassword(newP);
    const { error } = await supabase.from('users').update({ password: newHash }).eq('id', userInDb.id);
    return { success: !error, message: error ? error.message : 'Sucesso' };
  }

  async getCatalog() { const { data } = await supabase.from('catalog').select('*').order('name'); return data || []; }
  async saveCatalogItem(item: CatalogItem) {
    const { data: existing } = await supabase.from('catalog').select('id').ilike('name', item.name).maybeSingle();
    if (existing) { const { error } = await supabase.from('catalog').update(item).eq('id', existing.id); return !error; }
    else { const { error } = await supabase.from('catalog').insert([item]); return !error; }
  }
  async deleteCatalogItem(item: CatalogItem) { const { error } = await supabase.from('catalog').delete().ilike('name', item.name); return !error; }

  async getProducts() {
    const { data } = await supabase.from('products').select('*');
    return (data || []).map((p: any) => ({ id: p.id, neId: p.ne_id, name: p.name, unit: p.unit, qtyPerPackage: p.qty_per_package, initialQty: p.initial_qty, unitValue: p.unit_value, currentBalance: p.current_balance, minStock: p.min_stock, createdAt: p.created_at }));
  }

  // --- NOVOS MÉTODOS PARA GERENCIAMENTO DE ENTRADAS ---

  async getRecentNEs() {
    const { data } = await supabase.from('nota_empenho').select('*').order('date', { ascending: false }).limit(50);
    // FIX: Mapeando corretamente de snake_case (banco) para camelCase (app) para evitar erros de renderização
    return (data || []).map((n: any) => ({
      id: n.id,
      supplier: n.supplier,
      date: n.date,
      status: n.status as NEStatus,
      totalValue: n.total_value
    }));
  }

  async getProductsByNE(neId: string) {
    const { data } = await supabase.from('products').select('*').eq('ne_id', neId);
    return (data || []).map((p: any) => ({
      id: p.id, neId: p.ne_id, name: p.name, unit: p.unit, qtyPerPackage: p.qty_per_package,
      initialQty: p.initial_qty, unitValue: p.unit_value, currentBalance: p.current_balance,
      minStock: p.min_stock, createdAt: p.created_at
    }));
  }

  async deleteProductEntry(productId: string) {
    // 1. Busca o produto
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    if (!product) return { success: false, message: 'Produto não encontrado.' };

    // 2. Verifica se já foi usado (distribuído)
    if (product.current_balance < product.initial_qty) {
      return { success: false, message: 'Não é possível excluir: Este item já possui saídas registradas. Realize o estorno na aba Relatórios primeiro.' };
    }

    const neId = product.ne_id;
    const valueToRemove = product.initial_qty * product.unit_value;

    // 3. Deleta as movimentações de ENTRADA desse produto
    const { error: movError } = await supabase.from('movements').delete().eq('product_id', productId).eq('type', MovementType.ENTRY);
    if (movError) return { success: false, message: 'Erro ao excluir movimentação.' };

    // 4. Deleta o produto
    const { error: prodError } = await supabase.from('products').delete().eq('id', productId);
    if (prodError) return { success: false, message: 'Erro ao excluir produto.' };

    // 5. Atualiza o valor total da NE ou deleta a NE se ficar vazia
    const { data: remainingProducts } = await supabase.from('products').select('id').eq('ne_id', neId);
    
    if (!remainingProducts || remainingProducts.length === 0) {
       await supabase.from('nota_empenho').delete().eq('id', neId);
    } else {
       const { data: ne } = await supabase.from('nota_empenho').select('total_value').eq('id', neId).single();
       if (ne) {
         const newTotal = Math.max(0, ne.total_value - valueToRemove);
         await supabase.from('nota_empenho').update({ total_value: newTotal }).eq('id', neId);
       }
    }

    this.notifyListeners();
    return { success: true, message: 'Item excluído com sucesso.' };
  }

  async updateProductName(productId: string, newName: string) {
      const { error } = await supabase.from('products').update({ name: newName }).eq('id', productId);
      // Nota: Não atualizamos a tabela 'movements' antiga para preservar o histórico de como foi a entrada na época,
      // mas o 'products' atualizado garantirá o agrupamento correto na distribuição.
      this.notifyListeners();
      return !error;
  }

  // ----------------------------------------------------

  async getConsolidatedStock() {
    const products = await this.getProducts();
    const map = new Map();
    products.forEach(p => {
      const nameKey = p.name.trim(); 
      if (!map.has(nameKey)) { map.set(nameKey, { name: p.name, totalBalance: 0, unit: p.unit }); }
      const item = map.get(nameKey)!;
      item.totalBalance += p.currentBalance;
    });
    return Array.from(map.values()).filter((item: any) => item.totalBalance > 0);
  }

  private normalizeKey(str: string) {
    if (!str) return '';
    return str
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/\s+/g, ' ') 
        .trim()
        .toUpperCase();
  }

  async getConsolidatedStockForDistribution() {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .gt('current_balance', 0)
      .order('created_at', { ascending: true });

    if (!products) return [];

    const map = new Map();
    products.forEach((p: any) => {
      const key = this.normalizeKey(p.name);
      
      if (!map.has(key)) {
        map.set(key, {
            name: p.name.trim(),
            unit: p.unit,
            totalBalance: 0,
            batches: []
        });
      }
      const item = map.get(key);
      item.totalBalance += p.current_balance;
      item.batches.push({
          id: p.id,
          neId: p.ne_id,
          currentBalance: p.current_balance,
          unitValue: p.unit_value,
          createdAt: p.created_at
      });
    });

    return Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }

  async getNotaEmpenho(id: string) {
    const { data, error } = await supabase.from('nota_empenho').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      supplier: data.supplier,
      date: data.date,
      status: data.status as NEStatus,
      totalValue: data.total_value
    };
  }

  async createNotaEmpenho(ne: any, items: any[]) {
    const { data: existingNE } = await supabase.from('nota_empenho').select('id, total_value').eq('id', ne.number).maybeSingle();
    
    const itemsTotalValue = items.reduce((a, i) => a + (i.initialQty * i.unitValue), 0);
    
    if (existingNE) {
      const newTotal = Number(existingNE.total_value) + itemsTotalValue;
      const { error: updateError } = await supabase.from('nota_empenho').update({ total_value: newTotal }).eq('id', ne.number);
      if (updateError) { console.error("Erro ao atualizar NE", updateError); return false; }
    } else {
      const { error: neError } = await supabase.from('nota_empenho').insert([{
        id: ne.number,
        supplier: ne.supplier,
        date: ne.date,
        status: NEStatus.OPEN,
        total_value: itemsTotalValue
      }]);
      if (neError) { console.error("Erro ao criar NE", neError); return false; }
    }

    const user = await this.getCurrentUser();
    const ts = new Date().toISOString();
    const productsPayload = [];
    const movementsPayload = [];

    items.forEach((i, idx) => {
      const pid = `P-${Date.now()}-${idx}`;
      productsPayload.push({ id: pid, ne_id: ne.number, name: i.name, unit: i.unit, qty_per_package: i.qtyPerPackage, initial_qty: i.initialQty, unit_value: i.unitValue, current_balance: i.initialQty, min_stock: i.minStock, created_at: ts });
      movementsPayload.push({ id: `MOV-IN-${Date.now()}-${idx}`, date: ts, type: MovementType.ENTRY, ne_id: ne.number, product_id: pid, product_name: i.name, quantity: i.initialQty, value: i.initialQty * i.unitValue, user_email: user.email, observation: 'Entrada Inicial', is_reversed: false });
    });

    const { error: prodError } = await supabase.from('products').insert(productsPayload);
    if (prodError) return false;

    const { error: movError } = await supabase.from('movements').insert(movementsPayload);
    if (movError) return false;

    this.notifyListeners();
    return true;
  }

  async calculateDistribution(productName: string, requestedQty: number, reservedQty: number = 0) {
    const { data: allBatches } = await supabase
        .from('products')
        .select('*')
        .gt('current_balance', 0)
        .order('created_at', { ascending: true });

    if (!allBatches || allBatches.length === 0) return { itemsToDeduct: [], remainingQty: requestedQty };

    const targetKey = this.normalizeKey(productName);
    const batches = allBatches.filter(b => this.normalizeKey(b.name) === targetKey);

    let qtyToSkip = reservedQty; 
    let qtyNeeded = requestedQty;
    const itemsToDeduct = [];

    for (const b of batches) {
      if (qtyNeeded <= 0) break;

      let availableInBatch = Number(b.current_balance);

      if (qtyToSkip > 0) {
          if (availableInBatch > qtyToSkip) {
              availableInBatch -= qtyToSkip;
              qtyToSkip = 0;
          } else {
              qtyToSkip -= availableInBatch;
              availableInBatch = 0; 
          }
      }

      if (availableInBatch <= 0) continue;

      const take = Math.min(availableInBatch, qtyNeeded);

      itemsToDeduct.push({ 
          productId: b.id, 
          neId: b.ne_id, 
          qty: take, 
          unitValue: b.unit_value,
          productName: b.name
      });

      qtyNeeded -= take;
    }

    return { itemsToDeduct, remainingQty: qtyNeeded };
  }

  async executeDistribution(movementsAllocated: any[], userEmail: string, obs: string) {
    const now = new Date();
    const timestamp = now.toISOString();
    const year = now.getFullYear();

    // Filtros para contar apenas as movimentações do ano corrente
    const startOfYear = `${year}-01-01T00:00:00.000Z`;
    const endOfYear = `${year}-12-31T23:59:59.999Z`;

    // Conta quantos registros existem neste ano para gerar o sequencial anual
    const { count } = await supabase
      .from('movements')
      .select('*', { count: 'exact', head: true })
      .gte('date', startOfYear)
      .lte('date', endOfYear);

    const seq = (count || 0) + 1;
    const receiptId = `REC-${String(seq).padStart(4, '0')}/${year}`;

    const movementsPayload = [];
    for (const m of movementsAllocated) {
      movementsPayload.push({ 
          id: `MOV-OUT-${Date.now()}-${Math.floor(Math.random()*10000)}`, 
          date: timestamp, 
          type: MovementType.EXIT, 
          ne_id: m.neId, 
          product_id: m.productId, 
          product_name: m.productName, 
          quantity: m.qty, 
          value: m.qty * m.unitValue, 
          user_email: userEmail, 
          observation: obs, 
          is_reversed: false 
      });
      
      const { data: currentP } = await supabase.from('products').select('current_balance').eq('id', m.productId).single();
      if (currentP) {
          await supabase.from('products').update({ current_balance: Number(currentP.current_balance) - Number(m.qty) }).eq('id', m.productId);
      }
    }
    const { error } = await supabase.from('movements').insert(movementsPayload);
    if (!error) { this.notifyListeners(); return { success: true, receiptId }; }
    return { success: false };
  }

  async getMovements() {
    const { data } = await supabase.from('movements').select('*').order('date', { ascending: false });
    return (data || []).map((m: any) => ({ id: m.id, date: m.date, type: m.type as MovementType, neId: m.ne_id, productId: m.product_id, productName: m.product_name, quantity: m.quantity, value: m.value, userEmail: m.user_email, observation: m.observation, isReversed: m.is_reversed }));
  }

  async reverseMovement(id: string, email: string) {
    const { data: original } = await supabase.from('movements').select('*').eq('id', id).single();
    if (!original) return false;
    await supabase.from('movements').update({ is_reversed: true }).eq('id', id);
    const reversal = { ...original, id: `REV-${Date.now()}`, type: MovementType.REVERSAL, user_email: email, observation: `Estorno de ${original.id}`, is_reversed: false, date: new Date().toISOString() };
    delete reversal.created_at; 
    await supabase.from('movements').insert([reversal]);
    const { data: prod } = await supabase.from('products').select('current_balance').eq('id', original.product_id).single();
    if (prod) await supabase.from('products').update({ current_balance: prod.current_balance + original.quantity }).eq('id', original.product_id);
    this.notifyListeners(); return true;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const { data: products } = await supabase.from('products').select('current_balance, unit_value, name, min_stock, unit');
    const { data: movements } = await supabase.from('movements').select('value, date, type, is_reversed, quantity, product_name');
    const totalValueStock = (products || []).reduce((acc, p) => acc + (p.current_balance * p.unit_value), 0);
    const lowStockCount = (products || []).filter(p => p.current_balance <= p.min_stock).length;
    const criticalItems = (products || []).filter(p => p.current_balance <= p.min_stock && p.current_balance >= 0).sort((a,b) => a.current_balance - b.current_balance).slice(0, 5).map(p => ({ name: p.name, balance: p.current_balance, min: p.min_stock, unit: p.unit }));
    const now = new Date();
    const currentMonthOutflow = (movements || []).filter(m => m.type === MovementType.EXIT && !m.is_reversed && new Date(m.date).getMonth() === now.getMonth() && new Date(m.date).getFullYear() === now.getFullYear()).reduce((acc, m) => acc + m.value, 0);
    const consumptionMap = new Map<string, number>();
    (movements || []).forEach(m => { if (m.type === MovementType.EXIT && !m.is_reversed) { const current = consumptionMap.get(m.product_name) || 0; consumptionMap.set(m.product_name, current + m.quantity); } });
    const topProducts = Array.from(consumptionMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    return { totalValueStock, totalItems: (products || []).length, lowStockCount, monthlyOutflow: [], topProducts, currentMonthOutflow, criticalItems };
  }
  
  getApiUrl() { return 'SUPABASE_CONNECTED'; }
  public networkErrorStatus = { isError: false, type: null };
  async refreshData() { this.notifyListeners(); }
}

export const inventoryService = new InventoryService();
