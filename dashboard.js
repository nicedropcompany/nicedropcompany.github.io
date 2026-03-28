// Issue 1 - logout not defined
async function logout() {
    await window.supabaseConfig.getClient().auth.signOut();
    localStorage.removeItem('nicedrop_user');
    window.location.href = '/auth.html';
}
// Logout function for sidebar
async function logout() {
    await window.supabaseConfig.getClient().auth.signOut();
    localStorage.removeItem('nicedrop_user');
    window.location.href = '/auth.html';
}
function waitForSupabase(cb) {
    if (window.supabase?.createClient) {
        cb();
    } else {
        setTimeout(() => waitForSupabase(cb), 50);
    }
}
/**
 * NiceDrop Dashboard (SaaS Layout)
 * Two-column layout: dark sidebar + white card grid
 */

const user = JSON.parse(localStorage.getItem('nicedrop_user'));
if (!user) {
    if (!window.location.pathname.endsWith('auth.html')) {
        window.location.href = '/auth.html';
    }
}

if (user && (user.role === 'developer' || user.role === 'admin')) {
    window.location.href = '/admin.html';
}

if (user && user.role === 'client') {
    alert('Conta cliente não pode aceder ao dashboard.');
    localStorage.removeItem('user');
    if (!window.location.pathname.endsWith('auth.html')) {
        window.location.href = '/auth.html';
    }
}

const STORAGE_KEYS = {
    users: 'nd_users',
    stores: 'nd_stores',
    drones: 'nd_drones',
    members: 'nd_members'
};

const state = {
    currentStoreId: null,
    user,
    stores: [],
    drones: {},
    members: {}
};

// ========== DOM ELEMENTS ==========
const sidebarStores = document.getElementById('sidebarStores');
const actionLabel = document.getElementById('actionLabel');
const sidebarActions = document.getElementById('sidebarActions');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const logoutBtn = document.getElementById('logoutBtn');

const mainTopbar = document.getElementById('mainTopbar');
const storeTitle = document.getElementById('storeTitle');
const storeMeta = document.getElementById('storeMeta');
const contentGrid = document.getElementById('contentGrid');
const emptyState = document.getElementById('emptyState');
const statsRow = document.getElementById('statsRow');
const detailRow = document.getElementById('detailRow');

// Modals
const modalOverlay = document.getElementById('modalOverlay');
const createStoreModal = document.getElementById('createStoreModal');
const addDroneModal = document.getElementById('addDroneModal');
const addMemberModal = document.getElementById('addMemberModal');

const createStoreForm = document.getElementById('createStoreForm');
const addDroneForm = document.getElementById('addDroneForm');
const addMemberForm = document.getElementById('addMemberForm');

const createStoreBtn = document.getElementById('createStoreBtn');
const addDroneBtn = document.getElementById('addDroneBtn');

function init() {
    waitForSupabase(() => {
        window.supabaseConfig.init();
        
            state.stores = [];
        
        // Setup user info
        const letter = ((state.user.username || state.user.name || 'U')[0] || 'U').toUpperCase();
        userAvatar.textContent = letter;
        userName.textContent = state.user.username || state.user.name;
        userRole.textContent = state.user.role.toUpperCase();
        
        // Show/hide developer actions
        if (state.user.role === 'developer') {
            actionLabel.style.display = 'block';
            sidebarActions.style.display = 'flex';
        }
        
        // Auto-select first store
        state.currentStoreId = state.stores[0]?.id || null;
        
        renderSidebarStores();
        renderMainContent();
        bindEvents();
    });
        waitForSupabase(async () => {
            window.supabaseConfig.init();
            const supabase = window.supabaseConfig.getClient();
            // Get session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = '/auth.html';
                return;
            }
            // Get user profile
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('id, username, role, store_id')
                .eq('id', session.user.id)
                .single();
            if (error || !profile) {
                window.location.href = '/auth.html';
                return;
            }
            state.user = profile;
            // Issue 2 - Load stores for sidebar
            let stores = [];
            if (profile.role === 'developer') {
                const { data: allStores } = await supabase
                    .from('stores')
                    .select('id, name, service');
                if (allStores) stores = allStores;
            } else if (profile.role === 'owner') {
                const { data: ownerStores } = await supabase
                    .from('stores')
                    .select('id, name, service')
                    .eq('id', profile.store_id);
                if (ownerStores) stores = ownerStores;
            }
            state.stores = stores;
            // Setup user info
            const letter = ((state.user.username || state.user.name || 'U')[0] || 'U').toUpperCase();
            userAvatar.textContent = letter;
            userName.textContent = state.user.username || state.user.name;
            userRole.textContent = state.user.role.toUpperCase();
            // Show/hide developer actions
            if (state.user.role === 'developer') {
                actionLabel.style.display = 'block';
                sidebarActions.style.display = 'flex';
            }
            // Auto-select first store
            state.currentStoreId = state.stores[0]?.id || null;
            // Load drones and team for the first store
            await loadStoreData(state.currentStoreId);
            await renderSidebarStores();
            renderMainContent();
            bindEvents();
        });
}

function bindEvents() {
    // Sidebar & logout
    logoutBtn.addEventListener('click', logout);
    
    // Modals
    createStoreBtn.addEventListener('click', () => openModal('createStoreModal'));
    addDroneBtn.addEventListener('click', () => openModal('addDroneModal'));
    modalOverlay.addEventListener('click', closeAllModals);
    
    // Form submissions
    createStoreForm.addEventListener('submit', handleCreateStore);
    addDroneForm.addEventListener('submit', handleAddDrone);
    addMemberForm.addEventListener('submit', handleAddMember);
}

async function renderSidebarStores() {
    let html = '';
    if (state.user.role === 'admin' || state.user.role === 'developer') {
        html += `<div class="sidebar-store-item" id="adminSidebarBtn" style="background:#111;color:#fff;cursor:pointer;justify-content:center;font-weight:bold;">
            <span style="margin-right:8px;">⚙️</span> ADMIN
        </div>`;
    }
    html += state.stores.map(store => {
        const isActive = store.id === state.currentStoreId ? 'active' : '';
        return `
            <div class="sidebar-store-item ${isActive}" data-store-id="${store.id}">
                <span class="sidebar-store-icon">🏪</span>
                <span>${store.name}</span>
            </div>
        `;
    }).join('');
    sidebarStores.innerHTML = html;

    if (state.user.role === 'admin' || state.user.role === 'developer') {
        const adminBtn = document.getElementById('adminSidebarBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }
    }

    sidebarStores.querySelectorAll('.sidebar-store-item[data-store-id]').forEach(item => {
        item.addEventListener('click', async () => {
            state.currentStoreId = Number(item.dataset.storeId);
            // Load drones and team for selected store
            await loadStoreData(state.currentStoreId);
            await renderSidebarStores();
            renderMainContent();
        });
    });
}

function renderMainContent() {
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
    const drones = state.drones || [];
    const team = state.team || [];
    
    // Top bar
    storeTitle.textContent = store.name;
    storeMeta.innerHTML = `<span>${store.city || 'Localização'}</span><span>•</span><span class="${store.status === 'active' ? 'status-active' : 'status-inactive'}">ATIVA</span>`;
    
    // Stats
    const gains = drones.reduce((t, d) => t + (d.revenue || 0), 0);
    const expenses = drones.reduce((t, d) => t + (d.expense || 0), 0);
    const deliveries = drones.reduce((t, d) => t + (d.trips || 0), 0);
    const droneCount = drones.length;
    
    statsRow.innerHTML = `
        <div class="stat-card gains">
            <div class="stat-label">Ganhos</div>
            <div class="stat-number">${formatEuro(gains)}</div>
        </div>
        <div class="stat-card expenses">
            <div class="stat-label">Gastos</div>
            <div class="stat-number">${formatEuro(expenses)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Encomendas</div>
            <div class="stat-number">${deliveries}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Nº Drones</div>
            <div class="stat-number">${droneCount}</div>
        </div>
    `;
    
    // Detail cards based on role
    if (state.user.role === 'developer') {
        renderDetailRowDeveloper(store, drones, team);
    } else {
        renderDetailRowOwner(store, drones, team);
    }
}

function renderDetailRowDeveloper(store, drones, team) {
    detailRow.classList.add('three-col');
    detailRow.innerHTML = `
        <!-- TEAM CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <div class="team-list" id="teamList">
                ${renderTeamList(team, true)}
            </div>
        </div>
        
        <!-- DRONES CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            <div class="drones-list" id="dronesList">
                ${renderDronesList(drones)}
            </div>
        </div>
        
        <!-- HISTORY CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Histórico da Loja</div>
            ${renderHistory(store, drones, team)}
        </div>
    `;
}

function renderDetailRowOwner(store, drones, team) {
    detailRow.classList.remove('three-col');
    detailRow.innerHTML = `
        <!-- TEAM CARD (60%) -->
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <div class="team-list" id="teamList">
                ${renderTeamList(team, state.user.role === 'owner')}
            </div>
        </div>
        
        <!-- DRONES CARD (40%) -->
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            <div class="drones-list" id="dronesList">
                ${renderDronesList(drones)}
            </div>
        </div>
    `;
}
// Load drones and team for a store from Supabase
async function loadStoreData(storeId) {
    const supabase = window.supabaseConfig.getClient();
    let drones = [];
    let team = [];
    if (storeId) {
        // Load drones for selected store
        const { data: dronesData } = await supabase
            .from('drones')
            .select('id, name, status, capacity')
            .eq('store_id', storeId);
        if (dronesData) drones = dronesData;
        // Load team for selected store
        const { data: teamData } = await supabase
            .from('profiles')
            .select('id, username, role')
            .eq('store_id', storeId);
        if (teamData) team = teamData;
    }
    state.drones = drones;
    state.team = team;
    // Show drones and team in detailRow
    renderMainContent();
}

function renderTeamList(members, canManage) {
    if (!members.length) {
        return '<div class="empty-state-text">SEM MEMBROS</div>';
    }
    
    return members.map(m => `
        <div class="team-member-row" data-member-id="${m.storeId}-${m.email}">
            <div class="member-avatar">${(m.email[0] || 'M').toUpperCase()}</div>
            <div class="member-info">
                <div class="member-name">${m.email}</div>
                <div class="member-email">${m.email}</div>
            </div>
            <span class="member-role-badge ${m.role}">${m.role.toUpperCase()}</span>
            ${canManage && m.role !== 'owner' ? `
                <div class="member-actions">
                    <button class="member-btn toggle-role" data-store="${state.currentStoreId}" data-email="${m.email}" title="Toggle role">↕</button>
                    <button class="member-btn remove-member" data-store="${state.currentStoreId}" data-email="${m.email}" title="Remove">×</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function renderDronesList(drones) {
    if (!drones.length) {
        return '<div class="empty-state-text">SEM DRONES</div>';
    }
    
    return drones.map(d => `
        <div class="drone-row">
            <div class="drone-id">${d.id}</div>
            <div class="drone-name">${d.name}</div>
            <span class="drone-status-badge ${d.status}">${d.status.toUpperCase()}</span>
            <div class="drone-stats">
                <span>${d.trips} viagens</span>
                <span>${formatEuro(d.revenue)}</span>
            </div>
        </div>
    `).join('');
}

function renderHistory(store, drones, members) {
    const deliveries = drones.reduce((t, d) => t + (d.trips || 0), 0);
    const revenue = drones.reduce((t, d) => t + (d.revenue || 0), 0);
    
    return `
        <div class="history-item">
            <span class="history-label">Data de Criação</span>
            <span class="history-value">-</span>
        </div>
        <div class="history-item">
            <span class="history-label">Total de Entregas</span>
            <span class="history-value">${deliveries}</span>
        </div>
        <div class="history-item">
            <span class="history-label">Total de Receita</span>
            <span class="history-value">${formatEuro(revenue)}</span>
        </div>
        <div class="history-item">
            <span class="history-label">Email do Dono</span>
            <span class="history-value">${store.ownerEmail}</span>
        </div>
        <div class="history-item">
            <span class="history-label">Nº de Operadores</span>
            <span class="history-value">${members.filter(m => m.role === 'operator').length}</span>
        </div>
    `;
}

function bindMemberActions(members) {
    document.querySelectorAll('.toggle-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const storeId = btn.dataset.store;
            const email = btn.dataset.email;
            toggleMemberRole(storeId, email);
        });
    });
    
    document.querySelectorAll('.remove-member').forEach(btn => {
        btn.addEventListener('click', () => {
            const storeId = btn.dataset.store;
            const email = btn.dataset.email;
            removeMember(storeId, email);
        });
    });
}

// ========== MODAL FUNCTIONS ==========
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        modalOverlay.classList.add('show');
    }
    
    // Populate dropdowns
    if (modalId === 'addDroneModal') {
        const storeSelect = document.getElementById('addDroneStore');
        storeSelect.innerHTML = state.stores.map(s => 
            `<option value="${s.id}">${s.name}</option>`
        ).join('');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
    if (!document.querySelector('.modal.show')) {
        modalOverlay.classList.remove('show');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    modalOverlay.classList.remove('show');
}

// ========== FORM HANDLERS ==========
function handleCreateStore(e) {
    e.preventDefault();
    
    const name = document.getElementById('createStoreName').value.trim();
    const city = document.getElementById('createStoreCity').value.trim();
    const ownerEmail = document.getElementById('createStoreOwner').value.trim().toLowerCase();
    const errorEl = document.getElementById('createStoreError');
    
    if (!name || !city || !ownerEmail) {
        errorEl.textContent = 'Preencha todos os campos.';
        errorEl.classList.add('show');
        return;
    }
    
    const users = getUsers();
    const owner = users.find(u => u.email.toLowerCase() === ownerEmail);
    if (!owner) {
        errorEl.textContent = 'Utilizador não encontrado.';
        errorEl.classList.add('show');
        return;
    }
    
    const storeId = Date.now();
    const store = { id: storeId, name, city, ownerEmail: owner.email, status: 'active' };
    
    let stores = getStores();
    stores.push(store);
    localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores));
    
    // Add drones
    const drones = generateDronesForStore(name, storeId);
    state.drones[storeId] = drones;
    localStorage.setItem(STORAGE_KEYS.drones, JSON.stringify(state.drones));
    
    // Add owner to members
    state.members[storeId] = [{ storeId, email: owner.email, role: 'owner' }];
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members));
    
    state.stores = getVisibleStoresForUser();
    state.currentStoreId = storeId;
    
    renderSidebarStores();
    renderMainContent();
    closeModal('createStoreModal');
    createStoreForm.reset();
    errorEl.classList.remove('show');
}

function handleAddDrone(e) {
    e.preventDefault();
    
    const storeId = Number(document.getElementById('addDroneStore').value);
    const name = document.getElementById('addDroneName').value.trim();
    const errorEl = document.getElementById('addDroneError');
    
    if (!name) {
        errorEl.textContent = 'Introduza o nome do drone.';
        errorEl.classList.add('show');
        return;
    }
    
    const droneId = `ND-${Date.now()}`;
    const drone = {
        id: droneId,
        storeId,
        name,
        status: 'active',
        trips: 0,
        distance: 0,
        revenue: 0,
        expense: 0
    };
    
    if (!state.drones[storeId]) {
        state.drones[storeId] = [];
    }
    state.drones[storeId].push(drone);
    localStorage.setItem(STORAGE_KEYS.drones, JSON.stringify(state.drones));
    
    if (storeId === state.currentStoreId) {
        renderMainContent();
    }
    
    closeModal('addDroneModal');
    addDroneForm.reset();
    errorEl.classList.remove('show');
}

function handleAddMember(e) {
    e.preventDefault();
    
    const email = document.getElementById('addMemberEmail').value.trim().toLowerCase();
    const role = document.getElementById('addMemberRole').value;
    const errorEl = document.getElementById('addMemberError');
    
    if (!email) {
        errorEl.textContent = 'Introduza o email.';
        errorEl.classList.add('show');
        return;
    }
    
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email);
    if (!user) {
        errorEl.textContent = 'UTILIZADOR NÃO ENCONTRADO';
        errorEl.classList.add('show');
        return;
    }
    
    if (!state.members[state.currentStoreId]) {
        state.members[state.currentStoreId] = [];
    }
    
    const members = state.members[state.currentStoreId];
    if (members.some(m => m.email.toLowerCase() === email)) {
        errorEl.textContent = 'Este utilizador já está na equipa.';
        errorEl.classList.add('show');
        return;
    }
    
    members.push({ storeId: state.currentStoreId, email, role });
    syncUserRole(email, role);
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members));
    
    renderMainContent();
    closeModal('addMemberModal');
    addMemberForm.reset();
    errorEl.classList.remove('show');
}

function toggleMemberRole(storeId, email) {
    if (!state.members[storeId]) return;
    
    const member = state.members[storeId].find(m => m.email === email);
    if (!member || member.role === 'owner') return;
    
    member.role = member.role === 'operator' ? 'owner' : 'operator';
    syncUserRole(email, member.role);
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members));
    renderMainContent();
}

function removeMember(storeId, email) {
    if (!state.members[storeId]) return;
    
    const member = state.members[storeId].find(m => m.email === email);
    if (!member || member.role === 'owner') {
        alert('Não pode remover o dono da loja.');
        return;
    }
    
    state.members[storeId] = state.members[storeId].filter(m => m.email !== email);
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members));
    renderMainContent();
}

// ========== STORAGE & DATA FUNCTIONS ==========
document.addEventListener('DOMContentLoaded', init);

