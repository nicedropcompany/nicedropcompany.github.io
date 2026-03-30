function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let adminSupabase = null;
let currentUser = null;

async function init() {
    waitForSupabase(async () => {
        adminSupabase = window.supabaseConfig.init();
        if (!adminSupabase) {
            console.error('Supabase null');
            return;
        }

        const { data: { session } } = await adminSupabase.auth.getSession();
        if (!session) {
            window.location.href = '/auth.html';
            return;
        }

        const { data: profile, error } = await adminSupabase
            .from('profiles')
            .select('id, username, role')
            .eq('id', session.user.id)
            .single();

        if (error || !profile) {
            window.location.href = '/auth.html';
            return;
        }

        const role = (profile.role || '').trim().toLowerCase();
        if (role !== 'developer') {
            window.location.href = '/auth.html';
            return;
        }


        currentUser = { ...profile, email: session.user.email };
        const usernameEl = document.getElementById('adminUsername');
        const roleEl = document.getElementById('adminRole');
        if (usernameEl) usernameEl.textContent = profile.username || profile.id;
        if (roleEl) roleEl.textContent = profile.role || 'developer';

        await loadUsers();
        await loadStores();
        bindEvents();
    });
}

async function loadUsers() {
    const { data: users, error } = await adminSupabase
        .from('users_with_email')
        .select('id, username, role, email, store_id');
    if (error) { console.error('Erro users:', error.message); return; }

    // Carregar stores para mapear nomes
    const { data: stores } = await adminSupabase.from('stores').select('id, name');
    const storeMap = {};
    (stores || []).forEach(s => { storeMap[s.id] = s.name; });

    // Stats bar (4 stat-cards, sem breakdown)
    const { data: drones } = await adminSupabase.from('drones').select('id');
    const totalStores = stores ? stores.length : 0;
    const totalDrones = drones ? drones.length : 0;
    const totalUsers = users.length;
    const totalOperators = users.filter(u => u.role === 'operator').length;
    document.getElementById('userTypeSummary').innerHTML = `
        <div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-number">${totalStores}</div></div>
        <div class="stat-card"><div class="stat-label">Drones</div><div class="stat-number">${totalDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Utilizadores</div><div class="stat-number">${totalUsers}</div></div>
        <div class="stat-card"><div class="stat-label">Operadores</div><div class="stat-number">${totalOperators}</div></div>
    `;

    // Tabela de utilizadores com badges
    document.getElementById('usersBody').innerHTML = users.map(u => {
        let badgeClass = 'badge';
        if (u.role === 'developer') badgeClass += ' badge-developer';
        else if (u.role === 'owner') badgeClass += ' badge-owner';
        else if (u.role === 'operator') badgeClass += ' badge-operator';
        else badgeClass += ' badge-client';
        return `
        <tr>
            <td>${u.username || '-'}</td>
            <td>${u.email || '-'}</td>
            <td><span class="${badgeClass}">${u.role || '-'}</span></td>
            <td>${u.store_id && storeMap[u.store_id] ? storeMap[u.store_id] : '-'}</td>
            <td>
                <select class="role-select" onchange="changeRole('${u.id}', this.value)">
                    <option value="client" ${u.role === 'client' ? 'selected' : ''}>client</option>
                    <option value="operator" ${u.role === 'operator' ? 'selected' : ''}>operator</option>
                    <option value="owner" ${u.role === 'owner' ? 'selected' : ''}>owner</option>
                    <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>developer</option>
                </select>
            </td>
        </tr>`;
    }).join('');
}

async function changeRole(userId, role) {
    const { error } = await adminSupabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
    if (error) alert('Erro ao mudar role: ' + error.message);
    else await loadUsers();
}

async function loadStores() {
    const { data: stores, error } = await adminSupabase
        .from('stores')
        .select('id, name, service, latitude, longitude');
    if (error) { console.error('Erro stores:', error.message); return; }

    const { data: drones } = await adminSupabase.from('drones').select('id, store_id, status, name');
    const { data: owners } = await adminSupabase.from('profiles').select('id, username, store_id, role');

    document.getElementById('addDroneStore').innerHTML = stores.map(s =>
        `<option value="${s.id}">${s.name}</option>`).join('');

    // Renderizar cards na stores-grid (#storesBody)
    document.getElementById('storesBody').innerHTML = stores.map(s => {
        const storeDrones = (drones || []).filter(d => d.store_id === s.id);
        const hasCoords = s.latitude && s.longitude;
        const mapUrl = hasCoords ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : null;
        const owner = (owners || []).find(o => o.store_id === s.id && o.role === 'owner');
        // Status badge
        const status = s.service ? 'ATIVA' : 'INATIVA';
        const statusClass = s.service ? 'badge badge-active' : 'badge badge-inactive';
        // Drones
        const dronesHtml = storeDrones.length ? storeDrones.map(d => {
            let droneStatusClass = 'badge';
            if (d.status === 'active') droneStatusClass += ' badge-active';
            else if (d.status === 'pending') droneStatusClass += ' badge-pending';
            else if (d.status === 'shipping') droneStatusClass += ' badge-shipping';
            else droneStatusClass += ' badge-inactive';
            return `<div class="drone-item">
                <span>${d.name}</span>
                <span class="${droneStatusClass}">${d.status.toUpperCase()}</span>
                <button class="btn-danger" onclick="deleteDrone('${d.id}')">×</button>
            </div>`;
        }).join('') : '<div class="drone-item">Nenhum drone</div>';
        // Card
        return `<div class="store-card">
            <div class="store-card-header">
                <div class="store-card-name">${s.name}</div>
                <span class="${statusClass}">${status}</span>
            </div>
            <div class="store-card-meta">Owner: ${owner ? owner.username : '-'} • ${s.service ? 'Ativa' : 'Inativa'}</div>
            <div class="store-card-meta">Cidade: ${s.city || '-'}</div>
            <div class="store-card-drones">${dronesHtml}</div>
            <div class="store-card-actions" style="margin-top:10px;display:flex;gap:10px;">
                ${hasCoords ? `<button class="btn-secondary" onclick="window.open('${mapUrl}','_blank')">🗺 Mapa</button>` : ''}
                <button class="btn-danger" onclick="deleteStore('${s.id}')">Apagar Loja</button>
            </div>
        </div>`;
    }).join('');
}

async function deleteStore(storeId) {
    // Apagar todos os drones associados à loja
    await adminSupabase.from('drones').delete().eq('store_id', storeId);
    // Apagar a loja
    await adminSupabase.from('stores').delete().eq('id', storeId);
    await loadStores();
    await loadUsers();
}

async function deleteDrone(droneId) {
    await adminSupabase.from('drones').delete().eq('id', droneId);
    await loadStores();
}

async function createStore() {
    const ownerEmail = document.getElementById('ownerEmail').value.trim();
    const name = document.getElementById('storeName').value.trim();
    const lat = document.getElementById('storeLat').value;
    const lng = document.getElementById('storeLng').value;
    if (!ownerEmail || !name || !lat || !lng) {
        alert('Preencha todos os campos e selecione a localização no mapa.');
        return;
    }
    // Find owner by email
    const { data: owner, error: ownerError } = await adminSupabase
        .from('users_with_email')
        .select('id')
        .eq('email', ownerEmail)
        .single();
    if (ownerError || !owner) { alert('Owner não encontrado.'); return; }
    // Insert store and get new id
    const { data: newStore, error: storeError } = await adminSupabase
        .from('stores')
        .insert({ name, latitude: parseFloat(lat), longitude: parseFloat(lng), service: false })
        .select('id')
        .single();
    if (storeError || !newStore) { alert('Erro ao criar loja: ' + (storeError?.message || '')); return; }
    // Buscar perfil atual do owner para garantir array
    const { data: ownerProfile } = await adminSupabase
        .from('profiles')
        .select('store_id')
        .eq('id', owner.id)
        .single();
    let ids = [];
    if (ownerProfile) {
        if (Array.isArray(ownerProfile.store_id)) ids = ownerProfile.store_id;
        else if (typeof ownerProfile.store_id === 'number') ids = [ownerProfile.store_id];
        else if (typeof ownerProfile.store_id === 'string') {
            try { const p = JSON.parse(ownerProfile.store_id); ids = Array.isArray(p) ? p : [p]; } catch { ids = []; }
        }
    }
    if (!ids.includes(newStore.id)) ids.push(newStore.id);
    const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ store_id: ids, role: 'owner' })
        .eq('id', owner.id);
    if (updateError) { alert('Erro ao atualizar owner: ' + updateError.message); return; }
    alert('Loja criada com sucesso!');
    await loadStores();
}

async function addDrone() {
    const storeId = document.getElementById('addDroneStore').value;
    const name = document.getElementById('addDroneName').value.trim();
    if (!storeId || !name) { alert('Escolha loja e nome do drone.'); return; }
    const { error } = await adminSupabase.from('drones').insert({
        name, store_id: parseInt(storeId), status: 'pending', capacity: 500, order_id: 0, servo_state: false
    });
    if (error) { alert('Erro ao adicionar drone: ' + error.message); return; }
    await loadStores();
    alert('Drone adicionado!');
}

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await adminSupabase.auth.signOut();
        localStorage.removeItem('nicedrop_user');
        window.location.href = '/auth.html';
    });
    document.getElementById('createStoreBtn').addEventListener('click', createStore);
    document.getElementById('addDroneBtn').addEventListener('click', addDrone);
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadUsers();
        await loadStores();
    });
    document.getElementById('searchInput').addEventListener('input', filterUsers);

    if (window.L && document.getElementById('map')) {
        const map = L.map('map').setView([39.5, -8.0], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        let marker = null;
        map.on('click', function(e) {
            document.getElementById('storeLat').value = e.latlng.lat;
            document.getElementById('storeLng').value = e.latlng.lng;
            if (marker) marker.setLatLng(e.latlng);
            else marker = L.marker(e.latlng).addTo(map);
        });
    }
}

function filterUsers() {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();
    document.querySelectorAll('#usersBody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', init);