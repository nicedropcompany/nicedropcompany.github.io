function waitForSupabase(cb) {
    if (window.supabase?.createClient) {
        cb();
    } else {
        setTimeout(() => waitForSupabase(cb), 50);
    }
}
const STORAGE_KEYS = {
    users: 'nd_users',
    stores: 'nd_stores',
    drones: 'nd_drones',
    members: 'nd_members'
};

const state = {
    user: null,
    users: [],
    stores: [],
    drones: {},
    members: {}
};

const usersBody = document.getElementById('usersBody');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const messageEl = document.getElementById('message');
const ownerEmailEl = document.getElementById('ownerEmail');
const storeNameEl = document.getElementById('storeName');
const storeCityEl = document.getElementById('storeCity');
const createStoreBtn = document.getElementById('createStoreBtn');
const adminEmailEl = document.getElementById('adminEmail');
const logoutBtn = document.getElementById('logoutBtn');

const addDroneStoreEl = document.getElementById('addDroneStore');
const addDroneNameEl = document.getElementById('addDroneName');
const addDroneBtn = document.getElementById('addDroneBtn');
const storesBody = document.getElementById('storesBody');
const userTypeSummary = document.getElementById('userTypeSummary');
const adminDashboardSection = document.getElementById('adminDashboardSection');
const adminDashboardContainer = document.getElementById('adminDashboardContainer');

function init() {
    waitForSupabase(async () => {
        window.supabaseConfig.init();
        if (!window.supabaseConfig || !window.supabaseConfig.getClient) {
            console.error('SupabaseConfig não encontrado!');
            return;
        }
        const supabase = window.supabaseConfig.getClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Session:', session, 'Error:', sessionError);
        if (!session) {
            console.log('Sem sessão, redirecionar para auth.html');
            if (!window.location.pathname.endsWith('auth.html')) {
                window.location.href = '/auth.html';
            }
            return;
        }
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
        console.log('Profile:', profile, 'Error:', profileError);
        const role = profile?.role;
        console.log('Role encontrado:', role);
        if (role !== 'developer') {
            console.log('Role não é developer, redirecionar para auth.html');
            if (!window.location.pathname.endsWith('auth.html')) {
                window.location.href = '/auth.html';
            }
            return;
        }
        state.user = { ...profile, email: profile?.email, role };
        adminEmailEl.textContent = `${state.user.email} (${state.user.role})`;
        bootstrapStorage();
        loadState();
        bindEvents();
        renderAll();
    });

    // Mapa Leaflet para localização da loja
    if (window.L && document.getElementById('map')) {
        const map = L.map('map').setView([39.5, -8.0], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
        let marker = null;
        map.on('click', function(e) {
            const { lat, lng } = e.latlng;
            document.getElementById('storeLat').value = lat;
            document.getElementById('storeLng').value = lng;
            if (marker) {
                marker.setLatLng([lat, lng]);
            } else {
                marker = L.marker([lat, lng]).addTo(map);
            }
        });
    }
}

function bindEvents() {
    logoutBtn.addEventListener('click', logout);
    refreshBtn.addEventListener('click', () => {
        loadState();
        renderAll();
        setMessage('Dados atualizados.');
    });

    searchInput.addEventListener('input', renderUsers);
    createStoreBtn.addEventListener('click', createStoreForOwner);
    addDroneBtn.addEventListener('click', addDroneToStore);
}

function renderAll() {
    renderUserTypeSummary();
    renderUsers();
    renderStores();
    renderStoreSelect();
    renderAdminDashboard();
}

function renderUsers() {
    const term = searchInput.value.trim().toLowerCase();
    const rows = state.users.filter(u => {
        if (!term) return true;
        return u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term);
    });

    if (!rows.length) {
        usersBody.innerHTML = '<tr><td colspan="4">Sem resultados</td></tr>';
        return;
    }

    usersBody.innerHTML = rows.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td><button class="btn-remove-user" title="Apagar utilizador" data-email="${user.email}">✖</button></td>
        </tr>
    `).join('');

    usersBody.querySelectorAll('.btn-remove-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = btn.dataset.email;
            showConfirmDeleteUser(email);
        });
    });
}

function showConfirmDeleteUser(email) {
    if (confirm('Quer apagar permanentemente este utilizador?')) {
        deleteUser(email);
    }
}

function deleteUser(email) {
    const idx = state.users.findIndex(u => u.email === email);
    if (idx === -1) return;
    state.users.splice(idx, 1);
    saveUsers(state.users);
    loadState();
    renderAll();
    setMessage('Utilizador apagado.');
}

function renderUserTypeSummary() {
    if (!userTypeSummary) return;
    const counts = { developer: 0, admin: 0, owner: 0, operator: 0, client: 0 };
    state.users.forEach(u => {
        if (counts[u.role] !== undefined) counts[u.role]++;
    });
    userTypeSummary.innerHTML = `
        <div style="display:flex; gap:18px; flex-wrap:wrap;">
            <div><b>Developer:</b> ${counts.developer}</div>
            <div><b>Admin:</b> ${counts.admin}</div>
            <div><b>Owner:</b> ${counts.owner}</div>
            <div><b>Operator:</b> ${counts.operator}</div>
            <div><b>Cliente:</b> ${counts.client}</div>
        </div>
    `;
}

function renderAdminDashboard() {
    if (!adminDashboardSection || !adminDashboardContainer) return;
    if (state.user.role !== 'admin') {
        adminDashboardSection.style.display = 'none';
        return;
    }
    // Mostra dashboard igual ao owner, mas com ADMIN na sidebar
    adminDashboardSection.style.display = 'block';
    // Renderização simplificada: lista de lojas
    let html = `<div style="display:flex; flex-direction:column; gap:18px;">
        <div style="font-size:1.2em; font-weight:bold;">Bem-vindo, ADMIN</div>
        <div><b>Lojas:</b></div>
        <ul style="list-style:none; padding:0;">
            ${state.stores.map(store => `<li><b>${store.name}</b> (${store.city}) - Owner: ${store.ownerEmail}</li>`).join('')}
        </ul>
    </div>`;
    adminDashboardContainer.innerHTML = html;
}

function renderStores() {
    if (!state.stores.length) {
        storesBody.innerHTML = '<tr><td colspan="7">Sem lojas</td></tr>';
        return;
    }

    storesBody.innerHTML = state.stores.map(store => {
        const drones = state.drones[store.id] || [];
        const members = state.members[store.id] || [];
        const revenue = drones.reduce((total, d) => total + (d.revenue || 0), 0);
        const hasCoords = store.latitude && store.longitude;
        const mapLink = hasCoords
            ? `<a href="https://www.google.com/maps?q=${store.latitude},${store.longitude}" target="_blank" title="Ver no mapa">🗺️</a>`
            : '';
        return `
            <tr>
                <td>${store.name}</td>
                <td>${store.city || '-'}</td>
                <td>${store.ownerEmail}</td>
                <td>${drones.length}</td>
                <td>${formatEuro(revenue)}</td>
                <td>${mapLink}</td>
                <td><button class="btn-remove-store" title="Apagar loja" data-storeid="${store.id}">✖</button></td>
            </tr>
        `;
    }).join('');

    storesBody.querySelectorAll('.btn-remove-store').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const storeId = btn.dataset.storeid;
            showConfirmDeleteStore(storeId);
        });
    });
}

function showConfirmDeleteStore(storeId) {
    if (confirm('Quer apagar permanentemente esta loja?')) {
        deleteStore(storeId);
    }
}

function deleteStore(storeId) {
    const idx = state.stores.findIndex(s => String(s.id) === String(storeId));
    if (idx === -1) return;

    // Encontrar owners e operadores da loja
    const members = state.members[storeId] || [];
    const affectedEmails = members.map(m => ({ email: m.email, role: m.role }));

    // Remover a loja
    state.stores.splice(idx, 1);
    saveStores(state.stores);
    // Remover drones e membros associados
    delete state.drones[storeId];
    delete state.members[storeId];
    saveDrones(state.drones);
    saveMembers(state.members);

    // Atualizar roles dos owners e operadores afetados
    let changed = false;
    affectedEmails.forEach(({ email, role }) => {
        // Só processa owners ou operators
        if (role !== 'owner' && role !== 'operator') return;
        // Verifica se o utilizador ainda é owner/operator noutra loja
        let aindaOwner = false;
        let aindaOperator = false;
        Object.keys(state.members).forEach(storeKey => {
            const outrosMembros = state.members[storeKey] || [];
            outrosMembros.forEach(m => {
                if (m.email === email) {
                    if (m.role === 'owner') aindaOwner = true;
                    if (m.role === 'operator') aindaOperator = true;
                }
            });
        });
        const user = state.users.find(u => u.email === email);
        if (user) {
            if (role === 'owner' && !aindaOwner) {
                user.role = 'client';
                changed = true;
            }
            if (role === 'operator' && !aindaOperator) {
                user.role = 'client';
                changed = true;
            }
        }
    });
    if (changed) saveUsers(state.users);

    loadState();
    renderAll();
    setMessage('Loja apagada. Owners/operadores atualizados.');
}

function renderStoreSelect() {
    if (!state.stores.length) {
        addDroneStoreEl.innerHTML = '<option value="">Sem lojas</option>';
        return;
    }

    addDroneStoreEl.innerHTML = state.stores
        .map(store => `<option value="${store.id}">${store.name} (${store.city || '-'})</option>`)
        .join('');
}

function updateRole(email, role) {
    const index = state.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index === -1) return;

    if (email.toLowerCase() === 'dev@nicedrop.pt' && role === 'client') {
        setMessage('A conta principal de developer não pode virar cliente.', true);
        return;
    }

    state.users[index].role = role;
    saveUsers(state.users);

    if (state.user.email.toLowerCase() === email.toLowerCase()) {
        state.user.role = role;
        localStorage.setItem('user', JSON.stringify(state.user));
    }

    renderUsers();
    setMessage(`Role de ${email} atualizada para ${role}.`);
}

function createStoreForOwner() {
    const email = ownerEmailEl.value.trim().toLowerCase();
    const name = storeNameEl.value.trim();
    const city = storeCityEl.value.trim();
    const lat = document.getElementById('storeLat').value;
    const lng = document.getElementById('storeLng').value;

    if (!email || !name || !city || !lat || !lng) {
        setMessage('Preencha email do owner, nome, cidade e selecione a localização no mapa.', true);
        return;
    }

    const owner = state.users.find(u => u.email.toLowerCase() === email);
    if (!owner) {
        setMessage('Utilizador não encontrado.', true);
        return;
    }

    owner.role = 'owner';
    saveUsers(state.users);

    const storeId = getNextStoreId();
    const newStore = {
        id: storeId,
        name,
        city,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        ownerEmail: owner.email,
        status: 'active'
    };

    state.stores.push(newStore);
    saveStores(state.stores);

    if (!state.members[storeId]) {
        state.members[storeId] = [];
    }

    if (!state.members[storeId].some(m => m.email.toLowerCase() === owner.email.toLowerCase())) {
        state.members[storeId].push({ storeId, email: owner.email, role: 'owner' });
    }
    saveMembers(state.members);

    if (!state.drones[storeId]) {
        state.drones[storeId] = [];
    }
    state.drones[storeId].push({
        id: `ND-${String(storeId).padStart(3, '0')}`,
        storeId,
        name: `${name} Drone`,
        status: 'active',
        trips: 0,
        distance: 0,
        revenue: 0,
        expense: 0
    });
    saveDrones(state.drones);

    loadState();
    renderAll();

    ownerEmailEl.value = '';
    storeNameEl.value = '';
    storeCityEl.value = '';
    document.getElementById('storeLat').value = '';
    document.getElementById('storeLng').value = '';

    setMessage(`Loja ${name} criada e associada a ${owner.email}.`);
}

function addDroneToStore() {
    const storeId = Number(addDroneStoreEl.value);
    const droneName = addDroneNameEl.value.trim();

    if (!storeId || !droneName) {
        setMessage('Escolha uma loja e introduza o nome do drone.', true);
        return;
    }

    if (!state.drones[storeId]) {
        state.drones[storeId] = [];
    }

    state.drones[storeId].push({
        id: `ND-${Date.now()}`,
        storeId,
        name: droneName,
        status: 'active',
        trips: 0,
        distance: 0,
        revenue: 0,
        expense: 0
    });

    saveDrones(state.drones);
    addDroneNameEl.value = '';

    loadState();
    renderStores();
    setMessage(`Drone ${droneName} adicionado com sucesso.`);
}

function loadState() {
    state.users = readJson(STORAGE_KEYS.users, []);
    state.stores = readJson(STORAGE_KEYS.stores, []);
    state.drones = readJson(STORAGE_KEYS.drones, {});
    state.members = readJson(STORAGE_KEYS.members, {});
}

function bootstrapStorage() {
    const users = readJson(STORAGE_KEYS.users, []);
    if (!users.length) {
        const seedUsers = [
            { id: 'dev-1', name: 'Dev NiceDrop', email: 'dev@nicedrop.pt', password: 'nicedrop123', role: 'developer' }
        ];
        saveUsers(seedUsers);
    }

    if (!localStorage.getItem(STORAGE_KEYS.stores)) {
        saveStores([
            { id: 1, name: 'Porto Central', city: 'Porto', ownerEmail: 'dev@nicedrop.pt', status: 'active' },
            { id: 2, name: 'Lisboa Norte', city: 'Lisboa', ownerEmail: 'dev@nicedrop.pt', status: 'active' }
        ]);
    }

    if (!localStorage.getItem(STORAGE_KEYS.drones)) {
        saveDrones({
            1: [
                { id: 'ND-001', storeId: 1, name: 'Falcon I', status: 'active', trips: 156, distance: 450, revenue: 3250, expense: 1200 },
                { id: 'ND-002', storeId: 1, name: 'Falcon II', status: 'active', trips: 98, distance: 290, revenue: 2100, expense: 890 }
            ],
            2: [
                { id: 'ND-003', storeId: 2, name: 'Eagle I', status: 'maintenance', trips: 42, distance: 130, revenue: 980, expense: 540 }
            ]
        });
    }

    if (!localStorage.getItem(STORAGE_KEYS.members)) {
        saveMembers({
            1: [
                { storeId: 1, email: 'dev@nicedrop.pt', role: 'owner' }
            ],
            2: [
                { storeId: 2, email: 'dev@nicedrop.pt', role: 'owner' }
            ]
        });
    }
}

function getSessionUser() {
    const raw = localStorage.getItem('user');
    if (!raw) {
        if (!window.location.pathname.endsWith('auth.html')) {
            window.location.href = '/auth.html';
        }
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        localStorage.removeItem('user');
        if (!window.location.pathname.endsWith('auth.html')) {
            window.location.href = '/auth.html';
        }
        return null;
    }
}

function getNextStoreId() {
    const max = state.stores.reduce((acc, store) => Math.max(acc, Number(store.id) || 0), 0);
    return max + 1;
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function saveStores(stores) {
    localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores));
}

function saveDrones(drones) {
    localStorage.setItem(STORAGE_KEYS.drones, JSON.stringify(drones));
}

function saveMembers(members) {
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
}

function readJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function logout() {
    localStorage.removeItem('user');
    if (!window.location.pathname.endsWith('auth.html')) {
        window.location.href = '/auth.html';
    }
}

function formatEuro(value) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR'
    }).format(value || 0);
}

function setMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.style.color = isError ? '#b42318' : '#1a3a5c';
}

document.addEventListener('DOMContentLoaded', init);
