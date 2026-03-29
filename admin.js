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
        document.getElementById('adminEmail').textContent = `${profile.username || profile.id} (developer)`;

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

    const counts = { developer: 0, owner: 0, operator: 0, client: 0 };
    users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++; });

    // Stats bar
    const { data: drones } = await adminSupabase.from('drones').select('id');
    const totalStores = stores ? stores.length : 0;
    const totalDrones = drones ? drones.length : 0;
    const totalUsers = users.length;
    const totalOperators = users.filter(u => u.role === 'operator').length;
    document.getElementById('userTypeSummary').innerHTML = `
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="user-type-summary"><b>Lojas:</b> ${totalStores}</div>
            <div class="user-type-summary"><b>Drones:</b> ${totalDrones}</div>
            <div class="user-type-summary"><b>Utilizadores:</b> ${totalUsers}</div>
            <div class="user-type-summary"><b>Operadores:</b> ${totalOperators}</div>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
            <div><b>Developer:</b> ${counts.developer}</div>
            <div><b>Owner:</b> ${counts.owner}</div>
            <div><b>Operator:</b> ${counts.operator}</div>
            <div><b>Cliente:</b> ${counts.client}</div>
        </div>`;

    document.getElementById('usersBody').innerHTML = users.map(u => `
        <tr>
            <td>${u.username || '-'}</td>
            <td>${u.email || '-'}</td>
            <td>${u.role || '-'}</td>
            <td>${u.store_id && storeMap[u.store_id] ? storeMap[u.store_id] : '-'}</td>
            <td>
                <select onchange="changeRole('${u.id}', this.value)">
                    <option ${u.role === 'client' ? 'selected' : ''}>client</option>
                    <option ${u.role === 'operator' ? 'selected' : ''}>operator</option>
                    <option ${u.role === 'owner' ? 'selected' : ''}>owner</option>
                    <option ${u.role === 'developer' ? 'selected' : ''}>developer</option>
                </select>
            </td>
        </tr>`).join('');
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

    // Buscar owners para cada loja
    const { data: owners } = await adminSupabase.from('profiles').select('id, username, store_id, role');

    document.getElementById('addDroneStore').innerHTML = stores.map(s =>
        `<option value="${s.id}">${s.name}</option>`).join('');

    document.getElementById('storesBody').innerHTML = stores.map(s => {
        const storeDrones = (drones || []).filter(d => d.store_id === s.id);
        const hasCoords = s.latitude && s.longitude;
        const mapLink = hasCoords
            ? `<a href="https://www.google.com/maps?q=${s.latitude},${s.longitude}" target="_blank">🗺️</a>`
            : '-';
        // Owner
        const owner = (owners || []).find(o => o.store_id === s.id && o.role === 'owner');
        // Drones badge
        let badgeColor = '#27ae60'; // green
        if (storeDrones.some(d => d.status === 'inactive')) badgeColor = '#e74c3c';
        else if (storeDrones.some(d => d.status === 'pending')) badgeColor = '#f1c40f';
        // Drones list for delete
        const dronesList = storeDrones.length ? storeDrones.map(d => {
            let color = d.status === 'active' ? '#27ae60' : d.status === 'pending' ? '#f1c40f' : '#e74c3c';
            return `<span style="display:inline-block;margin-right:6px;">${d.name} <span style="background:${color};color:#fff;padding:2px 8px;border-radius:8px;font-size:0.9em;">${d.status}</span> <button class='btn-remove-drone' data-drone-id='${d.id}' style='background:none;border:none;color:#e74c3c;font-size:1.1em;cursor:pointer;' title='Apagar'>&times;</button></span>`;
        }).join('') : '-';
        return `<tr>
            <td>${s.name}</td>
            <td>${s.service ? 'Ativo' : 'Inativo'}</td>
            <td>${owner ? owner.username : '-'}</td>
            <td><span style="background:${badgeColor};color:#fff;padding:2px 10px;border-radius:12px;">${storeDrones.length}</span></td>
            <td>${dronesList}</td>
            <td>${mapLink} <button class='btn-remove-store' data-store-id='${s.id}' style='background:none;border:none;color:#e74c3c;font-size:1.1em;cursor:pointer;' title='Apagar'>&times;</button></td>
        </tr>`;
    }).join('');

    // Eventos apagar loja
    document.querySelectorAll('.btn-remove-store').forEach(btn => {
        btn.addEventListener('click', async () => {
            const storeId = btn.getAttribute('data-store-id');
            if (!confirm('Apagar esta loja?')) return;
            await deleteStore(storeId);
        });
    });
    // Eventos apagar drone
    document.querySelectorAll('.btn-remove-drone').forEach(btn => {
        btn.addEventListener('click', async () => {
            const droneId = btn.getAttribute('data-drone-id');
            if (!confirm('Apagar este drone?')) return;
            await deleteDrone(droneId);
        });
    });
}

async function deleteStore(storeId) {
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
    // Update owner's profile
    const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ store_id: newStore.id, role: 'owner' })
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