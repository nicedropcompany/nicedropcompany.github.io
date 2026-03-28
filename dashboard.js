function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let supabaseClient = null;
const state = { user: null, stores: [], drones: [], team: [], currentStoreId: null };

async function logout() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('nicedrop_user');
    window.location.href = '/auth.html';
}

async function init() {
    waitForSupabase(async () => {
        supabaseClient = window.supabaseConfig.init();

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { window.location.href = '/auth.html'; return; }

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('id, username, role, store_id')
            .eq('id', session.user.id)
            .single();

        if (!profile) { window.location.href = '/auth.html'; return; }

        const role = (profile.role || '').trim().toLowerCase();
        if (role === 'client') { window.location.href = '/auth.html'; return; }
        if (role === 'developer') { window.location.href = '/admin.html'; return; }

        state.user = profile;

        document.getElementById('userAvatar').textContent = (profile.username || 'U')[0].toUpperCase();
        document.getElementById('userName').textContent = profile.username || '-';
        document.getElementById('userRole').textContent = role.toUpperCase();

        if (role === 'owner' && profile.store_id) {
            const { data: stores } = await supabaseClient
                .from('stores')
                .select('id, name, service')
                .eq('id', profile.store_id);
            state.stores = stores || [];
        }

        state.currentStoreId = state.stores[0]?.id || null;
        if (state.currentStoreId) await loadStoreData(state.currentStoreId);

        renderSidebar();
        renderMain();
        bindEvents();
    });
}

async function loadStoreData(storeId) {
    const { data: drones } = await supabaseClient
        .from('drones')
        .select('id, name, status, capacity')
        .eq('store_id', storeId);
    const { data: team } = await supabaseClient
        .from('profiles')
        .select('id, username, role')
        .eq('store_id', storeId);
    state.drones = drones || [];
    state.team = team || [];
}

function renderSidebar() {
    const el = document.getElementById('sidebarStores');
    el.innerHTML = state.stores.map(s => `
        <div class="sidebar-store-item ${s.id === state.currentStoreId ? 'active' : ''}" data-store-id="${s.id}">
            <span class="sidebar-store-icon">🏪</span>
            <span>${s.name}</span>
        </div>
    `).join('');

    el.querySelectorAll('.sidebar-store-item').forEach(item => {
        item.addEventListener('click', async () => {
            state.currentStoreId = Number(item.dataset.storeId);
            await loadStoreData(state.currentStoreId);
            renderSidebar();
            renderMain();
        });
    });
}

function renderMain() {
    const emptyState = document.getElementById('emptyState');
    const contentGrid = document.getElementById('contentGrid');
    const mainTopbar = document.getElementById('mainTopbar');

    if (!state.currentStoreId) {
        emptyState.classList.add('show');
        contentGrid.style.display = 'none';
        mainTopbar.style.display = 'none';
        return;
    }

    emptyState.classList.remove('show');
    contentGrid.style.display = 'flex';
    mainTopbar.style.display = 'flex';

    const store = state.stores.find(s => s.id === state.currentStoreId);
    document.getElementById('storeTitle').textContent = store?.name || '-';
    document.getElementById('storeMeta').innerHTML = `<span class="status-active">ATIVA</span>`;

    document.getElementById('statsRow').innerHTML = `
        <div class="stat-card"><div class="stat-label">Drones</div><div class="stat-number">${state.drones.length}</div></div>
        <div class="stat-card"><div class="stat-label">Equipa</div><div class="stat-number">${state.team.length}</div></div>
    `;

    document.getElementById('detailRow').innerHTML = `
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            ${state.drones.length ? state.drones.map(d => `
                <div class="drone-row">
                    <div class="drone-name">${d.name}</div>
                    <span class="drone-status-badge ${d.status}">${d.status.toUpperCase()}</span>
                    <div>${d.capacity} kg</div>
                </div>`).join('') : '<div class="empty-state-text">SEM DRONES</div>'}
        </div>
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <button id="addEmployeeBtn" class="add-member-btn">Adicionar Funcionário</button>
            ${state.team.length ? state.team.map(m => `
                <div class="team-member-row">
                    <div class="member-avatar">${(m.username || 'U')[0].toUpperCase()}</div>
                    <div class="member-info">
                        <div class="member-name">${m.username || '-'}</div>
                    </div>
                    <span class="member-role-badge ${m.role}">${m.role.toUpperCase()}</span>
                </div>`).join('') : '<div class="empty-state-text">SEM MEMBROS</div>'}
        </div>
    `;
    // Add event for Adicionar Funcionário
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', async () => {
            const email = prompt('Email do funcionário a adicionar:');
            if (!email) return;
            // Search user by email
            const { data: user } = await supabaseClient
                .from('users_with_email')
                .select('id')
                .eq('email', email)
                .single();
            if (!user) {
                alert('Utilizador não encontrado');
                return;
            }
            // Update profile
            const { error } = await supabaseClient
                .from('profiles')
                .update({ store_id: state.currentStoreId, role: 'operator' })
                .eq('id', user.id);
            if (error) {
                alert('Erro ao adicionar funcionário: ' + error.message);
                return;
            }
            // Reload team
            await loadStoreData(state.currentStoreId);
        });
    }
}

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
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

window.closeModal = closeModal;
window.openModal = openModal;

function formatEuro(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value || 0);
}

document.addEventListener('DOMContentLoaded', init);