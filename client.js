function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let clientSupabase = null;
let currentProfile = null;
let currentSession = null;

// ─── HELPERS ───────────────────────────────────────────────────────────────

function parseStoreIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(Number);
    if (typeof raw === 'number') return [raw];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [Number(p)]; } catch { return []; }
}

function euro(val) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

function fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateLong(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_COLORS = {
    pending: '#f1c40f',
    confirmed: '#2980ef',
    processing: '#8e44ad',
    shipping: '#2980ef',
    shipped: '#2980ef',
    delivered: '#27ae60',
    complete: '#27ae60',
    completed: '#27ae60',
    cancelled: '#e74c3c',
    canceled: '#e74c3c',
    active: '#27ae60',
    inactive: '#e74c3c'
};

const ROLE_BADGE = {
    client: 'badge-client',
    operator: 'badge-operator',
    owner: 'badge-owner',
    developer: 'badge-developer'
};

const ROLE_LABEL = {
    client: 'Cliente',
    operator: 'Operador',
    owner: 'Owner',
    developer: 'Developer'
};

function statusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    const color = STATUS_COLORS[s] || '#bbb';
    return `<span style="background:${color};color:#fff;padding:2px 10px;border-radius:999px;font-size:0.62rem;letter-spacing:1.2px;font-weight:700;text-transform:uppercase;flex-shrink:0;">${s}</span>`;
}

// ─── TABS ──────────────────────────────────────────────────────────────────

function switchTab(name) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}
window.switchTab = switchTab;

// ─── AUTH & INIT ───────────────────────────────────────────────────────────

async function logout() {
    await clientSupabase.auth.signOut();
    localStorage.removeItem('nicedrop_user');
    window.location.href = '/auth.html';
}

async function init() {
    waitForSupabase(async () => {
        clientSupabase = window.supabaseConfig.init();

        const { data: { session } } = await clientSupabase.auth.getSession();
        if (!session) { window.location.href = '/auth.html'; return; }
        currentSession = session;

        const { data: profile, error } = await clientSupabase
            .from('profiles')
            .select('id, username, role, store_id, favorites, avatar')
            .eq('id', session.user.id)
            .single();

        if (error || !profile) { window.location.href = '/auth.html'; return; }
        currentProfile = { ...profile, email: session.user.email };

        renderProfile();
        setupDashLink();
        setupTabs();
        bindEvents();

        await Promise.all([
            loadOrders(),
            loadCart(),
            loadAddresses(),
            loadFavorites()
        ]);

        const role = (profile.role || '').trim().toLowerCase();
        if (role === 'operator') {
            await loadStoreData();
        }

        if (typeof AOS !== 'undefined') AOS.init({ once: true, duration: 500 });
    });
}

// ─── PROFILE ───────────────────────────────────────────────────────────────

function renderProfile() {
    const { username, email, role } = currentProfile;
    const r = (role || 'client').trim().toLowerCase();
    const initial = (username || email || 'U')[0].toUpperCase();

    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent = username || '—';
    document.getElementById('profileEmail').textContent = email || '—';
    document.getElementById('editUsername').value = username || '';
    document.getElementById('userName').textContent = username || '—';

    const badge = document.getElementById('profileRoleBadge');
    badge.textContent = ROLE_LABEL[r] || r;
    badge.className = 'badge ' + (ROLE_BADGE[r] || '');

    const createdAt = currentSession.user.created_at;
    if (createdAt) {
        document.getElementById('profileSince').textContent = 'Membro desde ' + fmtDateLong(createdAt);
    }
}

function setupDashLink() {
    const r = (currentProfile.role || '').trim().toLowerCase();
    const container = document.getElementById('dashLink');
    const anchor = document.getElementById('dashAnchor');
    if (r === 'developer') {
        container.style.display = 'block';
        anchor.href = '/admin.html';
        anchor.textContent = '← Admin Panel';
    } else if (r === 'owner') {
        container.style.display = 'block';
        anchor.href = '/dashboard.html';
        anchor.textContent = '← Dashboard';
    }
}

function setupTabs() {
    const r = (currentProfile.role || '').trim().toLowerCase();
    if (r === 'operator') {
        const btn = document.getElementById('lojaTabBtn');
        if (btn) btn.style.display = 'block';
    }
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

// ─── ORDERS ────────────────────────────────────────────────────────────────

async function loadOrders() {
    const { data } = await clientSupabase
        .from('orders')
        .select('id, store, store_id, price, status, address, date, created_at, drone_id, weight')
        .eq('client_id', currentProfile.id)
        .order('created_at', { ascending: false });

    const orders = data || [];
    const totalSpent = orders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const uniqueStores = new Set(orders.map(o => o.store_id).filter(Boolean)).size;

    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statSpent').textContent = euro(totalSpent);
    document.getElementById('statStores').textContent = uniqueStores;
    document.getElementById('ordersTotal').textContent = orders.length + ' encomenda' + (orders.length !== 1 ? 's' : '');

    renderRecentOrders(orders.slice(0, 3));
    renderOrdersTable(orders);
}

function renderRecentOrders(orders) {
    const el = document.getElementById('recentOrdersList');
    if (!orders.length) { el.innerHTML = '<div class="empty-section">Sem encomendas ainda</div>'; return; }
    el.innerHTML = orders.map(o => `
        <div class="data-row">
            <div class="data-row-left">
                <div class="data-row-title">#${o.id} — ${o.store || '—'}</div>
                <div class="data-row-sub">${o.address || '—'}</div>
            </div>
            ${statusBadge(o.status)}
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-weight:600;">${euro(o.price)}</div>
                <div style="font-size:0.72rem;color:var(--ink-faint);">${fmtDate(o.date || o.created_at)}</div>
            </div>
        </div>`).join('');
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:30px;">Sem encomendas</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><strong>#${o.id}</strong></td>
            <td>${o.store || '—'}</td>
            <td>${euro(o.price)}</td>
            <td>${statusBadge(o.status)}</td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.address || '—'}</td>
            <td style="white-space:nowrap;">${fmtDate(o.date || o.created_at)}</td>
        </tr>`).join('');
}

// ─── CART ──────────────────────────────────────────────────────────────────

async function loadCart() {
    const { data } = await clientSupabase
        .from('cart')
        .select('id, name, price, quantity, store, image, weight, date')
        .eq('user_id', currentProfile.id)
        .order('date', { ascending: false });

    const items = data || [];
    const totalCart = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1), 0);
    document.getElementById('cartTotal').textContent =
        items.length + ' item' + (items.length !== 1 ? 's' : '') + ' · ' + euro(totalCart);

    const el = document.getElementById('cartList');
    if (!items.length) { el.innerHTML = '<div class="empty-section">Carrinho vazio</div>'; return; }

    el.innerHTML = items.map(i => `
        <div class="data-row">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                ${i.image ? `<img src="${i.image}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                <div class="data-row-left">
                    <div class="data-row-title">${i.name || '—'}</div>
                    <div class="data-row-sub">${i.store || '—'}${i.weight ? ' · ' + i.weight + 'g' : ''}</div>
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-weight:600;">${euro(i.price)}</div>
                <div style="font-size:0.72rem;color:var(--ink-faint);">x${i.quantity || 1}</div>
            </div>
        </div>`).join('');
}

// ─── ADDRESSES ─────────────────────────────────────────────────────────────

async function loadAddresses() {
    const { data } = await clientSupabase
        .from('addresses')
        .select('id, name, address, latitude, longitude, created_at')
        .eq('user_id', currentProfile.id)
        .order('created_at', { ascending: false });

    const list = data || [];
    document.getElementById('statAddresses').textContent = list.length;
    document.getElementById('addressesCount').textContent = list.length + ' morada' + (list.length !== 1 ? 's' : '');

    const el = document.getElementById('addressesList');
    if (!list.length) { el.innerHTML = '<div class="empty-section">Sem moradas guardadas</div>'; return; }

    el.innerHTML = list.map(a => `
        <div class="data-row">
            <div class="data-row-left">
                <div class="data-row-title">${a.name || 'Morada'}</div>
                <div class="data-row-sub">${a.address || '—'}</div>
            </div>
            ${a.latitude && a.longitude
                ? `<a href="https://www.google.com/maps?q=${a.latitude},${a.longitude}" target="_blank" class="btn-outline" style="font-size:0.65rem;padding:6px 12px;flex-shrink:0;">Ver mapa</a>`
                : ''}
        </div>`).join('');
}

// ─── FAVORITES ─────────────────────────────────────────────────────────────

async function loadFavorites() {
    let ids = [];
    const raw = currentProfile.favorites;
    if (Array.isArray(raw)) ids = raw;
    else if (raw) { try { ids = JSON.parse(raw); } catch {} }

    document.getElementById('favoritesCount').textContent = ids.length + ' favorito' + (ids.length !== 1 ? 's' : '');

    const el = document.getElementById('favoritesList');
    if (!ids.length) { el.innerHTML = '<div class="empty-section">Sem favoritos ainda</div>'; return; }

    const { data: products } = await clientSupabase
        .from('products')
        .select('id, name, price, category, image, store')
        .in('id', ids);

    if (!products || !products.length) { el.innerHTML = '<div class="empty-section">Produtos não encontrados</div>'; return; }

    el.innerHTML = `<div class="products-grid">${products.map(p => `
        <div class="product-card">
            ${p.image
                ? `<img src="${p.image}" class="product-img" onerror="this.style.display='none'">`
                : '<div class="product-img" style="display:flex;align-items:center;justify-content:center;color:var(--ink-faint);font-size:0.7rem;">SEM IMAGEM</div>'}
            <div class="product-name">${p.name}</div>
            <div class="product-cat">${p.category || '—'} · ${p.store || '—'}</div>
            <div class="product-price">${euro(p.price)}</div>
        </div>`).join('')}</div>`;
}

// ─── STORE DATA (OPERATOR / OWNER) ─────────────────────────────────────────

async function loadStoreData() {
    const ids = parseStoreIds(currentProfile.store_id);
    const tabEl = document.getElementById('tab-loja');

    if (!ids.length) {
        tabEl.innerHTML = '<div class="empty-section">Sem lojas associadas</div>';
        return;
    }

    const storesData = await Promise.all(ids.map(async (storeId) => {
        const [
            { data: store },
            { data: orders },
            { data: drones },
            { data: products }
        ] = await Promise.all([
            clientSupabase.from('stores').select('id, name, service').eq('id', storeId).single(),
            clientSupabase.from('orders').select('id, username, price, status, created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(10),
            clientSupabase.from('drones').select('id, name, status, capacity').eq('store_id', storeId),
            clientSupabase.from('products').select('id, name, price, category, weight').eq('store_id', storeId)
        ]);
        return { store, orders: orders || [], drones: drones || [], products: products || [] };
    }));

    const multiple = storesData.length > 1;

    tabEl.innerHTML = storesData.map(({ store, orders, drones, products }) => {
        const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
        const activeDrones = drones.filter(d => d.status === 'active' || d.status === 'shipping').length;
        const isActive = store?.service === true || store?.service === 1;

        return `
        <div class="loja-store-section" style="display:flex;flex-direction:column;gap:20px;">
            ${multiple ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:1.5px;">${store?.name || 'Loja'}</div>` : ''}
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-label">Loja</div>
                    <div class="stat-number" style="font-size:1.05rem;padding-top:6px;">${store?.name || '—'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Receita Total</div>
                    <div class="stat-number" style="font-size:1.4rem;">${euro(totalRevenue)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Encomendas</div>
                    <div class="stat-number">${orders.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Drones Ativos</div>
                    <div class="stat-number">${activeDrones}<span style="font-size:1rem;color:var(--ink-faint);">/${drones.length}</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Produtos</div>
                    <div class="stat-number">${products.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Estado</div>
                    <div class="stat-number" style="font-size:1rem;padding-top:6px;color:${isActive ? '#27ae60' : '#e74c3c'};">${isActive ? 'Ativa' : 'Inativa'}</div>
                </div>
            </div>
            <div class="loja-grid">
                <div class="card glass-card">
                    <div class="card-header">
                        <h2 class="card-title" style="font-size:1.1rem;">Encomendas Recentes</h2>
                    </div>
                    <div>${orders.length
                        ? orders.map(o => `
                            <div class="data-row">
                                <div class="data-row-left">
                                    <div class="data-row-title">#${o.id} — ${o.username || '—'}</div>
                                    <div class="data-row-sub">${fmtDate(o.created_at)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    ${statusBadge(o.status)}
                                    <span style="font-weight:600;font-size:0.82rem;flex-shrink:0;">${euro(o.price)}</span>
                                </div>
                            </div>`).join('')
                        : '<div class="empty-section">Sem encomendas</div>'}</div>
                </div>
                <div class="card glass-card">
                    <div class="card-header">
                        <h2 class="card-title" style="font-size:1.1rem;">Drones</h2>
                    </div>
                    <div>${drones.length
                        ? drones.map(d => `
                            <div class="data-row">
                                <div class="data-row-left">
                                    <div class="data-row-title">${d.name}</div>
                                    <div class="data-row-sub">${d.capacity ? d.capacity + 'g cap.' : ''}</div>
                                </div>
                                ${statusBadge(d.status)}
                            </div>`).join('')
                        : '<div class="empty-section">Sem drones</div>'}</div>
                </div>
            </div>
            <div class="card glass-card">
                <div class="card-header">
                    <h2 class="card-title" style="font-size:1.1rem;">Produtos da Loja</h2>
                    <span class="badge">${products.length} produto${products.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="table-vertical-scroll" style="max-height:320px;">
                    <table class="glass-table">
                        <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Peso</th></tr></thead>
                        <tbody>${products.length
                            ? products.map(p => `
                                <tr>
                                    <td><strong>${p.name}</strong></td>
                                    <td>${p.category || '—'}</td>
                                    <td>${euro(p.price)}</td>
                                    <td>${p.weight ? p.weight + 'g' : '—'}</td>
                                </tr>`).join('')
                            : '<tr><td colspan="4" style="text-align:center;color:var(--ink-faint);padding:20px;">Sem produtos</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ─── MODAL ─────────────────────────────────────────────────────────────────

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('show');
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
    document.getElementById('modalOverlay').classList.remove('show');
}

window.openModal = openModal;
window.closeModal = closeModal;

// ─── EVENTS ────────────────────────────────────────────────────────────────

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('editProfileBtn').addEventListener('click', () => openModal('editProfileModal'));
    document.getElementById('modalOverlay').addEventListener('click', () => closeModal('editProfileModal'));

    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('editError');
        errorDiv.style.display = 'none';
        const newName = document.getElementById('editUsername').value.trim();
        if (!newName) { errorDiv.textContent = 'Introduza um nome.'; errorDiv.style.display = 'block'; return; }

        const { error } = await clientSupabase.from('profiles').update({ username: newName }).eq('id', currentProfile.id);
        if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; return; }

        currentProfile.username = newName;
        document.getElementById('profileName').textContent = newName;
        document.getElementById('profileAvatar').textContent = newName[0].toUpperCase();
        document.getElementById('userName').textContent = newName;
        closeModal('editProfileModal');
        if (typeof showToast === 'function') showToast('Perfil atualizado!', 'success');
    });
}

document.addEventListener('DOMContentLoaded', init);
