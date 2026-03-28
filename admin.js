function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let supabase = null;
let currentUser = null;

async function init() {
    waitForSupabase(async () => {
        supabase = window.supabaseConfig.init();
        if (!supabase) {
            console.error('Supabase null');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '/auth.html';
            return;
        }

        const { data: profile, error } = await supabase
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
    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, role');
    if (error) { console.error('Erro users:', error.message); return; }

    const counts = { developer: 0, owner: 0, operator: 0, client: 0 };
    users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++; });

    document.getElementById('userTypeSummary').innerHTML = `
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
            <div><b>Developer:</b> ${counts.developer}</div>
            <div><b>Owner:</b> ${counts.owner}</div>
            <div><b>Operator:</b> ${counts.operator}</div>
            <div><b>Cliente:</b> ${counts.client}</div>
        </div>`;

    document.getElementById('usersBody').innerHTML = users.map(u => `
        <tr>
            <td>${u.username || '-'}</td>
            <td>${u.id}</td>
            <td>${u.role || '-'}</td>
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
    const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
    if (error) alert('Erro ao mudar role: ' + error.message);
    else await loadUsers();
}

async function loadStores() {
    const { data: stores, error } = await supabase
        .from('stores')
        .select('id, name, service, latitude, longitude');
    if (error) { console.error('Erro stores:', error.message); return; }

    const { data: drones } = await supabase.from('drones').select('id, store_id, status');

    document.getElementById('addDroneStore').innerHTML = stores.map(s =>
        `<option value="${s.id}">${s.name}</option>`).join('');

    document.getElementById('storesBody').innerHTML = stores.map(s => {
        const storeDrones = (drones || []).filter(d => d.store_id === s.id);
        const hasCoords = s.latitude && s.longitude;
        const mapLink = hasCoords
            ? `<a href="https://www.google.com/maps?q=${s.latitude},${s.longitude}" target="_blank">🗺️</a>`
            : '-';
        return `<tr>
            <td>${s.name}</td>
            <td>${s.service ? 'Ativo' : 'Inativo'}</td>
            <td>-</td>
            <td>${storeDrones.length}</td>
            <td>-</td>
            <td>${mapLink}</td>
        </tr>`;
    }).join('');
}

async function createStore() {
    const email = document.getElementById('ownerEmail').value.trim();
    const name = document.getElementById('storeName').value.trim();
    const lat = document.getElementById('storeLat').value;
    const lng = document.getElementById('storeLng').value;
    if (!email || !name || !lat || !lng) {
        alert('Preencha todos os campos e selecione a localização no mapa.');
        return;
    }
    const { data: owner, error: ownerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', email)
        .single();
    if (ownerError || !owner) { alert('Owner não encontrado.'); return; }
    const { error } = await supabase.from('stores').insert({
        name, latitude: parseFloat(lat), longitude: parseFloat(lng), service: false
    });
    if (error) { alert('Erro ao criar loja: ' + error.message); return; }
    await supabase.from('profiles').update({ role: 'owner' }).eq('id', owner.id);
    await loadStores();
    alert('Loja criada!');
}

async function addDrone() {
    const storeId = document.getElementById('addDroneStore').value;
    const name = document.getElementById('addDroneName').value.trim();
    if (!storeId || !name) { alert('Escolha loja e nome do drone.'); return; }
    const { error } = await supabase.from('drones').insert({
        name, store_id: parseInt(storeId), status: 'pending', capacity: 500, order_id: 0, servo_state: false
    });
    if (error) { alert('Erro ao adicionar drone: ' + error.message); return; }
    await loadStores();
    alert('Drone adicionado!');
}

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
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