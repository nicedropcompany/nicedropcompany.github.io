/**
 * NiceDrop Dashboard (SaaS Layout)
 * Two-column layout: dark sidebar + white card grid
 */

const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
    window.location.href = '/auth.html';
}

if (user && (user.role === 'developer' || user.role === 'admin')) {
    window.location.href = '/admin.html';
}

if (user && user.role === 'client') {
    alert('Conta cliente não pode aceder ao dashboard.');
    localStorage.removeItem('user');
    window.location.href = '/auth.html';
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
    bootstrapStorage();
    loadDataFromStorage();
    
    state.stores = getVisibleStoresForUser();
    
    // Setup user info
    const letter = (state.user.name[0] || 'U').toUpperCase();
    userAvatar.textContent = letter;
    userName.textContent = state.user.name;
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

function renderSidebarStores() {
    let html = '';
    // Se for admin ou developer, mostra botão Admin no topo
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

    // Bind admin button
    if (state.user.role === 'admin' || state.user.role === 'developer') {
        const adminBtn = document.getElementById('adminSidebarBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }
    }

    sidebarStores.querySelectorAll('.sidebar-store-item[data-store-id]').forEach(item => {
        item.addEventListener('click', () => {
            state.currentStoreId = Number(item.dataset.storeId);
            renderSidebarStores();
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
    const drones = state.drones[state.currentStoreId] || [];
    const members = state.members[state.currentStoreId] || [];
    
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
        renderDetailRowDeveloper(store, drones, members);
    } else {
        renderDetailRowOwner(store, drones, members);
    }
}

function renderDetailRowDeveloper(store, drones, members) {
    detailRow.classList.add('three-col');
    detailRow.innerHTML = `
        <!-- TEAM CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <div class="team-list" id="teamList">
                ${renderTeamList(members, true)}
            </div>
            <button class="add-member-btn" onclick="openModal('addMemberModal')">+ ADICIONAR MEMBRO</button>
        </div>
        
        <!-- DRONES CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            <div class="drones-list" id="dronesList">
                ${renderDronesList(drones)}
            </div>
            <button class="add-drone-btn" onclick="openModal('addDroneModal')">+ ADICIONAR DRONE</button>
        </div>
        
        <!-- HISTORY CARD -->
        <div class="detail-card">
            <div class="detail-card-title">Histórico da Loja</div>
            ${renderHistory(store, drones, members)}
        </div>
    `;
    
    // Re-bind member action buttons
    bindMemberActions(members);
}

function renderDetailRowOwner(store, drones, members) {
    detailRow.classList.remove('three-col');
    detailRow.innerHTML = `
        <!-- TEAM CARD (60%) -->
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <div class="team-list" id="teamList">
                ${renderTeamList(members, state.user.role === 'owner')}
            </div>
            ${state.user.role === 'owner' ? '<button class="add-member-btn" onclick="openModal(\'addMemberModal\')">+ ADICIONAR MEMBRO</button>' : ''}
        </div>
        
        <!-- DRONES CARD (40%) -->
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            <div class="drones-list" id="dronesList">
                ${renderDronesList(drones)}
            </div>
        </div>
    `;
    
    // Re-bind member action buttons
    bindMemberActions(members);
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
function bootstrapStorage() {
    if (localStorage.getItem(STORAGE_KEYS.stores) && 
        localStorage.getItem(STORAGE_KEYS.drones) && 
        localStorage.getItem(STORAGE_KEYS.members)) {
        return;
    }
    
    const stores = [
        { id: 1, name: 'Porto Central', city: 'Porto', ownerEmail: 'dev@nicedrop.pt', status: 'active' },
        { id: 2, name: 'Lisboa Norte', city: 'Lisboa', ownerEmail: 'dev@nicedrop.pt', status: 'active' },
        { id: 3, name: 'Braga HUB', city: 'Braga', ownerEmail: 'owner@nicedrop.pt', status: 'active' }
    ];
    
    const drones = {
        1: [
            { id: 'ND-001', storeId: 1, name: 'Falcon I', status: 'active', trips: 156, distance: 450, revenue: 3250, expense: 1200 },
            { id: 'ND-002', storeId: 1, name: 'Falcon II', status: 'active', trips: 98, distance: 290, revenue: 2100, expense: 890 }
        ],
        2: [
            { id: 'ND-003', storeId: 2, name: 'Eagle I', status: 'maintenance', trips: 42, distance: 130, revenue: 980, expense: 540 }
        ],
        3: [
            { id: 'ND-004', storeId: 3, name: 'Hawk I', status: 'active', trips: 210, distance: 620, revenue: 4500, expense: 1800 }
        ]
    };
    
    const members = {
        1: [
            { storeId: 1, email: 'dev@nicedrop.pt', role: 'owner' },
            { storeId: 1, email: 'op@nicedrop.pt', role: 'operator' }
        ],
        2: [
            { storeId: 2, email: 'dev@nicedrop.pt', role: 'owner' }
        ],
        3: [
            { storeId: 3, email: 'owner@nicedrop.pt', role: 'owner' },
            { storeId: 3, email: 'op@nicedrop.pt', role: 'operator' }
        ]
    };
    
    localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores));
    localStorage.setItem(STORAGE_KEYS.drones, JSON.stringify(drones));
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
}

function loadDataFromStorage() {
    state.stores = getStores();
    state.drones = getDrones();
    state.members = getMembers();
}

function getStores() {
    return readJson(STORAGE_KEYS.stores, []);
}

function getDrones() {
    return readJson(STORAGE_KEYS.drones, {});
}

function getMembers() {
    return readJson(STORAGE_KEYS.members, {});
}

function getUsers() {
    return readJson(STORAGE_KEYS.users, []);
}

function getVisibleStoresForUser() {
    const allStores = getStores();
    
    if (state.user.role === 'developer') {
        return allStores;
    }
    
    if (state.user.role === 'owner') {
        const members = getMembers();
        return allStores.filter(s => {
            const isPrimaryOwner = s.ownerEmail.toLowerCase() === state.user.email.toLowerCase();
            const storeMembers = members[String(s.id)] || [];
            const isTeamOwner = storeMembers.some(
                m => m.email.toLowerCase() === state.user.email.toLowerCase() && m.role === 'owner'
            );
            return isPrimaryOwner || isTeamOwner;
        });
    }
    
    if (state.user.role === 'operator') {
        const members = getMembers();
        const storeIds = new Set();
        for (const storeId in members) {
            const storeMembers = members[storeId] || [];
            if (storeMembers.some(m => m.email.toLowerCase() === state.user.email.toLowerCase())) {
                storeIds.add(Number(storeId));
            }
        }
        return allStores.filter(s => storeIds.has(s.id));
    }
    
    return [];
}

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function generateDronesForStore(storeName, storeId) {
    return [
        {
            id: `ND-${String(storeId).slice(-4)}A`,
            storeId,
            name: `${storeName} Alpha`,
            status: 'active',
            trips: 0,
            distance: 0,
            revenue: 0,
            expense: 0
        },
        {
            id: `ND-${String(storeId).slice(-4)}B`,
            storeId,
            name: `${storeName} Beta`,
            status: 'active',
            trips: 0,
            distance: 0,
            revenue: 0,
            expense: 0
        }
    ];
}

function syncUserRole(email, role) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (userIndex === -1) return;

    if (role === 'owner' || role === 'operator' || role === 'client' || role === 'admin' || role === 'developer') {
        users[userIndex].role = role;
        localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function formatEuro(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

// Make closeModal globally available for inline onclick handlers
window.closeModal = closeModal;
window.openModal = openModal;

document.addEventListener('DOMContentLoaded', init);

