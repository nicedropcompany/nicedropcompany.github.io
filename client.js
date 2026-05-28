function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let clientSupabase = null;
let currentProfile = null;
let currentSession = null;

async function logout() {
    await clientSupabase.auth.signOut();
    localStorage.removeItem('nicedrop_user');
    window.location.href = '/auth.html';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const roleBadgeClass = {
    client: 'badge-client',
    operator: 'badge-operator',
    owner: 'badge-owner',
    developer: 'badge-developer'
};

const roleLabel = {
    client: 'Cliente',
    operator: 'Operador',
    owner: 'Owner',
    developer: 'Developer'
};

const statusColors = {
    pending: '#f1c40f',
    confirmed: '#2980ef',
    shipping: '#2980ef',
    delivered: '#27ae60',
    cancelled: '#e74c3c',
    active: '#27ae60'
};

async function init() {
    waitForSupabase(async () => {
        clientSupabase = window.supabaseConfig.init();

        const { data: { session } } = await clientSupabase.auth.getSession();
        if (!session) { window.location.href = '/auth.html'; return; }

        currentSession = session;

        const { data: profile, error } = await clientSupabase
            .from('profiles')
            .select('id, username, role, store_id')
            .eq('id', session.user.id)
            .single();

        if (error || !profile) { window.location.href = '/auth.html'; return; }

        currentProfile = { ...profile, email: session.user.email };

        renderProfile(currentProfile, session);
        showDashLink(currentProfile.role);
        await loadOrders(currentProfile.id);
        await loadWorkStores(currentProfile);
        bindEvents();

        if (typeof AOS !== 'undefined') AOS.init({ once: true, duration: 500 });
    });
}

function renderProfile(profile, session) {
    const role = (profile.role || 'client').trim().toLowerCase();
    const initial = (profile.username || profile.email || 'U')[0].toUpperCase();

    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent = profile.username || '—';
    document.getElementById('profileEmail').textContent = profile.email || '—';
    document.getElementById('editUsername').value = profile.username || '';

    const badgeEl = document.getElementById('profileRoleBadge');
    badgeEl.textContent = roleLabel[role] || role;
    badgeEl.className = 'badge ' + (roleBadgeClass[role] || '');

    const createdAt = session.user.created_at;
    if (createdAt) {
        document.getElementById('profileSince').textContent = 'Membro desde ' + formatDate(createdAt);
    }

    document.getElementById('userName').textContent = profile.username || '—';
    document.getElementById('userRole').textContent = (roleLabel[role] || role).toUpperCase();

    document.getElementById('statRole').textContent = roleLabel[role] || role;
    document.getElementById('statStatus').textContent = 'Ativo';
    document.getElementById('statStatus').style.color = '#27ae60';
}

function showDashLink(role) {
    const container = document.getElementById('dashLink');
    const anchor = document.getElementById('dashAnchor');
    const r = (role || '').trim().toLowerCase();

    if (r === 'developer') {
        container.style.display = 'block';
        anchor.href = '/admin.html';
        anchor.textContent = '← Admin Panel';
    } else if (r === 'owner') {
        container.style.display = 'block';
        anchor.href = '/dashboard.html';
        anchor.textContent = '← Dashboard';
    } else if (r === 'operator') {
        // operador não tem painel próprio, o link não é necessário
        container.style.display = 'none';
    }
}

async function loadOrders(userId) {
    let orders = [];

    // Try 'orders' table with client_id first, then user_id
    const attempts = [
        () => clientSupabase.from('orders').select('id, store_id, status, created_at, total, store_name').eq('client_id', userId).order('created_at', { ascending: false }).limit(20),
        () => clientSupabase.from('orders').select('id, store_id, status, created_at, total, store_name').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ];

    for (const attempt of attempts) {
        const { data, error } = await attempt();
        if (!error && data) { orders = data; break; }
    }

    // Fetch store names if store_id present but store_name missing
    if (orders.length > 0 && orders.some(o => o.store_id && !o.store_name)) {
        const storeIds = [...new Set(orders.map(o => o.store_id).filter(Boolean))];
        const { data: stores } = await clientSupabase.from('stores').select('id, name').in('id', storeIds);
        const storeMap = {};
        (stores || []).forEach(s => { storeMap[s.id] = s.name; });
        orders = orders.map(o => ({ ...o, store_name: o.store_name || storeMap[o.store_id] || '—' }));
    }

    const uniqueStores = new Set(orders.map(o => o.store_id).filter(Boolean)).size;

    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statStores').textContent = uniqueStores || (orders.length > 0 ? '—' : 0);

    const countBadge = document.getElementById('ordersCount');
    countBadge.textContent = orders.length + ' encomenda' + (orders.length !== 1 ? 's' : '');

    renderOrders(orders);
}

function parseStoreIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(Number);
    if (typeof raw === 'number') return [raw];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [Number(p)]; } catch { return []; }
}

async function loadWorkStores(profile) {
    const role = (profile.role || '').trim().toLowerCase();
    // Só mostra lojas de trabalho para operator e owner
    if (role !== 'operator' && role !== 'owner') return;

    const ids = parseStoreIds(profile.store_id);
    if (!ids.length) {
        renderWorkStores([], role);
        return;
    }

    const { data: stores } = await clientSupabase
        .from('stores')
        .select('id, name, service')
        .in('id', ids);

    renderWorkStores(stores || [], role);
}

function renderWorkStores(stores, role) {
    // Injeta a secção antes das encomendas recentes
    const ordersSection = document.querySelector('section.card.glass-card');
    if (!ordersSection) return;

    const sectionTitle = role === 'owner' ? 'As Minhas Lojas' : 'Lojas Onde Trabalho';

    const section = document.createElement('section');
    section.className = 'card glass-card';
    section.setAttribute('data-aos', 'fade-up');

    if (!stores.length) {
        section.innerHTML = `
            <div class="card-header">
                <h2 class="card-title" style="font-size:1.3rem;">${sectionTitle}</h2>
            </div>
            <div class="empty-orders">Sem lojas associadas</div>
        `;
    } else {
        const rows = stores.map(s => {
            const active = s.service === true || s.service === 1;
            const color = active ? '#27ae60' : '#e74c3c';
            const label = active ? 'Ativa' : 'Inativa';
            return `
                <div class="order-row">
                    <div>
                        <div class="order-id" style="font-size:0.88rem;">${s.name}</div>
                        <div class="order-store">ID #${s.id}</div>
                    </div>
                    <span style="background:${color};color:#fff;padding:3px 12px;border-radius:999px;font-size:0.65rem;letter-spacing:1.2px;font-weight:700;text-transform:uppercase;">${label}</span>
                </div>
            `;
        }).join('');

        section.innerHTML = `
            <div class="card-header">
                <h2 class="card-title" style="font-size:1.3rem;">${sectionTitle}</h2>
                <span class="badge">${stores.length} loja${stores.length !== 1 ? 's' : ''}</span>
            </div>
            ${rows}
        `;
    }

    ordersSection.parentNode.insertBefore(section, ordersSection);
}

function renderOrders(orders) {
    const container = document.getElementById('ordersList');
    if (!orders.length) {
        container.innerHTML = '<div class="empty-orders">Ainda sem encomendas</div>';
        return;
    }

    container.innerHTML = orders.map(o => {
        const status = (o.status || 'pending').toLowerCase();
        const color = statusColors[status] || '#bbb';
        const total = o.total != null ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(o.total) : '—';
        return `
            <div class="order-row">
                <div>
                    <div class="order-id">#${o.id}</div>
                    <div class="order-store">${o.store_name || '—'}</div>
                </div>
                <span style="background:${color};color:#fff;padding:3px 12px;border-radius:999px;font-size:0.65rem;letter-spacing:1.2px;font-weight:700;text-transform:uppercase;">${status}</span>
                <div style="text-align:right;">
                    <div style="font-weight:600;font-size:0.85rem;">${total}</div>
                    <div class="order-date">${formatDateShort(o.created_at)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
    document.getElementById('modalOverlay').classList.remove('show');
}

window.openModal = openModal;
window.closeModal = closeModal;

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('editProfileBtn').addEventListener('click', () => {
        openModal('editProfileModal');
    });

    document.getElementById('modalOverlay').addEventListener('click', () => {
        closeModal('editProfileModal');
    });

    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('editError');
        errorDiv.style.display = 'none';

        const newUsername = document.getElementById('editUsername').value.trim();
        if (!newUsername) {
            errorDiv.textContent = 'Introduza um nome.';
            errorDiv.style.display = 'block';
            return;
        }

        const { error } = await clientSupabase
            .from('profiles')
            .update({ username: newUsername })
            .eq('id', currentProfile.id);

        if (error) {
            errorDiv.textContent = 'Erro ao guardar: ' + error.message;
            errorDiv.style.display = 'block';
            return;
        }

        currentProfile.username = newUsername;
        document.getElementById('profileName').textContent = newUsername;
        document.getElementById('profileAvatar').textContent = newUsername[0].toUpperCase();
        document.getElementById('userName').textContent = newUsername;

        closeModal('editProfileModal');
        if (typeof showToast === 'function') showToast('Perfil atualizado!', 'success');
    });
}

document.addEventListener('DOMContentLoaded', init);
