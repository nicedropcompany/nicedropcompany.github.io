function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let adminSupabase = null;
let currentUser = null;

async function init() {
    waitForSupabase(async () => {
        adminSupabase = window.supabaseConfig.init();
        if (!adminSupabase) { console.error('Supabase null'); return; }

        const { data: { session } } = await adminSupabase.auth.getSession();
        if (!session) { window.location.href = '/auth.html'; return; }

        const { data: profile, error } = await adminSupabase
            .from('profiles')
            .select('id, username, role')
            .eq('id', session.user.id)
            .single();

        if (error || !profile) { window.location.href = '/auth.html'; return; }

        const role = (profile.role || '').trim().toLowerCase();
        if (role !== 'developer') { window.location.href = '/auth.html'; return; }

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

// ─────────────────────────────────────────────
//  UTILIZADORES
// ─────────────────────────────────────────────
async function loadUsers() {
    const { data: users, error } = await adminSupabase
        .from('users_with_email')
        .select('id, username, role, email, store_id');
    if (error) { console.error('Erro users:', error.message); return; }

    const { data: stores } = await adminSupabase.from('stores').select('id, name');
    const storeMap = {};
    (stores || []).forEach(s => { storeMap[s.id] = s.name; });

    const { data: drones } = await adminSupabase.from('drones').select('id');
    const totalStores   = stores ? stores.length : 0;
    const totalDrones   = drones ? drones.length : 0;
    const totalUsers    = users.length;
    const totalOperators = users.filter(u => u.role === 'operator').length;

    document.getElementById('userTypeSummary').innerHTML = `
        <div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-number">${totalStores}</div></div>
        <div class="stat-card"><div class="stat-label">Drones</div><div class="stat-number">${totalDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Utilizadores</div><div class="stat-number">${totalUsers}</div></div>
        <div class="stat-card"><div class="stat-label">Operadores</div><div class="stat-number">${totalOperators}</div></div>
    `;

    document.getElementById('usersBody').innerHTML = users.map(u => {
        // store_id pode ser array — mostrar nomes de todas as lojas
        let storeNames = '-';
        if (u.store_id) {
            let ids = Array.isArray(u.store_id) ? u.store_id
                : typeof u.store_id === 'number' ? [u.store_id]
                : (() => { try { const p = JSON.parse(u.store_id); return Array.isArray(p) ? p : [p]; } catch { return []; } })();
            const names = ids.map(id => storeMap[id]).filter(Boolean);
            storeNames = names.length ? names.join(', ') : '-';
        }

        let badgeClass = 'badge';
        if (u.role === 'developer') badgeClass += ' badge-developer';
        else if (u.role === 'owner')    badgeClass += ' badge-owner';
        else if (u.role === 'operator') badgeClass += ' badge-operator';
        else badgeClass += ' badge-client';

        return `
        <tr>
            <td>${u.username || '-'}</td>
            <td>${u.email || '-'}</td>
            <td><span class="${badgeClass}">${u.role || '-'}</span></td>
            <td>${storeNames}</td>
            <td>
                <select class="role-select" onchange="changeRole('${u.id}', this.value)">
                    <option value="client"    ${u.role === 'client'    ? 'selected' : ''}>client</option>
                    <option value="operator"  ${u.role === 'operator'  ? 'selected' : ''}>operator</option>
                    <option value="owner"     ${u.role === 'owner'     ? 'selected' : ''}>owner</option>
                    <option value="developer" ${u.role === 'developer' ? 'selected' : ''}>developer</option>
                </select>
            </td>
        </tr>`;
    }).join('');
}

async function changeRole(userId, role) {
    const { error } = await adminSupabase.from('profiles').update({ role }).eq('id', userId);
    if (error) alert('Erro ao mudar role: ' + error.message);
    else await loadUsers();
}

// ─────────────────────────────────────────────
//  LOJAS
// ─────────────────────────────────────────────
async function loadStores() {
    const { data: stores, error } = await adminSupabase
        .from('stores')
        .select('id, name, service, latitude, longitude');
    if (error) { console.error('Erro stores:', error.message); return; }

    const { data: drones } = await adminSupabase.from('drones').select('id, store_id, status, name');
    const { data: owners } = await adminSupabase.from('profiles').select('id, username, store_id, role');

    document.getElementById('addDroneStore').innerHTML = (stores || []).map(s =>
        `<option value="${s.id}">${s.name}</option>`).join('');

    document.getElementById('storesBody').innerHTML = (stores || []).map(s => {
        const storeDrones = (drones || []).filter(d => d.store_id === s.id);
        const hasCoords   = s.latitude && s.longitude;
        const mapUrl      = hasCoords ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : null;

        // Encontrar owners cujo store_id array contém este s.id
        const storeOwners = (owners || []).filter(o => {
            if (!o.store_id || o.role !== 'owner') return false;
            let ids = Array.isArray(o.store_id) ? o.store_id
                : typeof o.store_id === 'number' ? [o.store_id]
                : (() => { try { const p = JSON.parse(o.store_id); return Array.isArray(p) ? p : [p]; } catch { return []; } })();
            return ids.includes(s.id);
        });
        const ownerNames = storeOwners.length ? storeOwners.map(o => o.username).join(', ') : '-';

        const status      = s.service ? 'ATIVA' : 'INATIVA';
        const statusClass = s.service ? 'badge badge-active' : 'badge badge-inactive';

        const dronesHtml = storeDrones.length
            ? storeDrones.map(d => {
                let dc = 'badge';
                if (d.status === 'active')   dc += ' badge-active';
                else if (d.status === 'pending')  dc += ' badge-pending';
                else if (d.status === 'shipping') dc += ' badge-shipping';
                else dc += ' badge-inactive';
                return `<div class="drone-item">
                    <span>${d.name}</span>
                    <span class="${dc}">${d.status.toUpperCase()}</span>
                    <button style="background:#dc2626;border:2px solid #dc2626;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;" onclick="deleteDrone(${d.id})" title="Remover drone">×</button>
                </div>`;
            }).join('')
            : '<div class="drone-item" style="color:#bbb;">Nenhum drone</div>';

        return `<div class="store-card">
            <div class="store-card-header">
                <div class="store-card-name">${s.name}</div>
                <span class="${statusClass}">${status}</span>
            </div>
            <div class="store-card-meta">Owner: ${ownerNames} • ${s.service ? 'Ativa' : 'Inativa'}</div>
            <div class="store-card-meta">Cidade: ${s.city || '-'}</div>
            <div class="store-card-drones">${dronesHtml}</div>
            <div class="store-card-actions" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
                ${hasCoords ? `<button style="background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.15);color:#000;padding:8px 16px;font-size:1rem;cursor:pointer;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:6px;border-radius:0;" onclick="window.open('${mapUrl}','_blank')">🗺</button>` : ''}
                <button style="background:#dc2626;border:1px solid #dc2626;color:#fff;padding:8px 16px;font-size:0.72rem;text-transform:uppercase;letter-spacing:1.2px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;border-radius:0;" onclick="deleteStore(${s.id})">Apagar Loja</button>
            </div>
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────
//  APAGAR LOJA — corrigido: usa número, não string
// ─────────────────────────────────────────────
async function deleteStore(storeId) {
    const id = Number(storeId);
    if (!confirm(`Apagar loja #${id} e todos os seus drones?`)) return;

    // 1. Apagar drones da loja
    const { error: droneErr } = await adminSupabase.from('drones').delete().eq('store_id', id);
    if (droneErr) { alert('Erro ao apagar drones: ' + droneErr.message); return; }

    // 2. Remover store_id do array jsonb de todos os owners
    const { data: affectedProfiles } = await adminSupabase
        .from('profiles')
        .select('id, store_id, role');

    for (const profile of affectedProfiles || []) {
        let ids = Array.isArray(profile.store_id) ? profile.store_id
            : typeof profile.store_id === 'number' ? [profile.store_id]
            : (() => { try { const p = JSON.parse(profile.store_id); return Array.isArray(p) ? p : [p]; } catch { return []; } })();

        if (!ids.includes(id)) continue; // este profile não tinha esta loja

        const newIds = ids.filter(i => i !== id);
        await adminSupabase.from('profiles').update({
            store_id: newIds.length ? newIds : null,
            role: newIds.length ? profile.role : 'client'
        }).eq('id', profile.id);
    }

    // 3. Apagar a loja
    console.log('Antes do delete da loja stores', id);
    const { data, error: storeErr } = await adminSupabase.from('stores').delete().eq('id', id).select();
    console.log('Depois do delete da loja stores', storeErr);
    console.log('rows afetadas:', data);
    if (storeErr) { alert('Erro loja: ' + storeErr?.message); return; }

    await loadStores();
    await loadUsers();
}

// ─────────────────────────────────────────────
//  APAGAR DRONE
// ─────────────────────────────────────────────
async function deleteDrone(droneId) {
    const { error } = await adminSupabase.from('drones').delete().eq('id', Number(droneId));
    if (error) { alert('Erro ao apagar drone: ' + error.message); return; }
    await loadStores();
}

// ─────────────────────────────────────────────
//  CRIAR LOJA — faz append ao array, nunca substitui
// ─────────────────────────────────────────────
async function createStore() {
    const ownerEmail = document.getElementById('ownerEmail').value.trim();
    const name       = document.getElementById('storeName').value.trim();
    const lat        = document.getElementById('storeLat').value;
    const lng        = document.getElementById('storeLng').value;

    if (!ownerEmail || !name || !lat || !lng) {
        alert('Preencha todos os campos e selecione a localização no mapa.');
        return;
    }

    // 1. Encontrar owner pelo email
    const { data: ownerUser, error: ownerErr } = await adminSupabase
        .from('users_with_email')
        .select('id')
        .eq('email', ownerEmail)
        .single();
    if (ownerErr || !ownerUser) { alert('Owner não encontrado.'); return; }

    // 2. Criar a loja
    const { data: newStore, error: storeErr } = await adminSupabase
        .from('stores')
        .insert({ name, latitude: parseFloat(lat), longitude: parseFloat(lng), service: false })
        .select('id')
        .single();
    if (storeErr || !newStore) { alert('Erro ao criar loja: ' + (storeErr?.message || '')); return; }

    // 3. Buscar perfil ATUAL do owner (para preservar lojas existentes)
    const { data: ownerProfile } = await adminSupabase
        .from('profiles')
        .select('store_id, role')
        .eq('id', ownerUser.id)
        .single();

    // 4. Fazer APPEND ao array — nunca substituir
    let ids = [];
    if (ownerProfile?.store_id) {
        if (Array.isArray(ownerProfile.store_id))
            ids = ownerProfile.store_id;
        else if (typeof ownerProfile.store_id === 'number')
            ids = [ownerProfile.store_id];
        else if (typeof ownerProfile.store_id === 'string') {
            try { const p = JSON.parse(ownerProfile.store_id); ids = Array.isArray(p) ? p : [p]; }
            catch { ids = []; }
        }
    }

    // Adicionar nova loja ao array (sem duplicar)
    if (!ids.includes(newStore.id)) ids.push(newStore.id);

    const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update({ store_id: ids, role: 'owner' })
        .eq('id', ownerUser.id);
    if (updateErr) { alert('Erro ao atualizar owner: ' + updateErr.message); return; }

    // Limpar campos
    document.getElementById('ownerEmail').value = '';
    document.getElementById('storeName').value  = '';
    document.getElementById('storeLat').value   = '';
    document.getElementById('storeLng').value   = '';

    alert(`Loja "${name}" criada com sucesso!`);
    await loadStores();
    await loadUsers();
}

// ─────────────────────────────────────────────
//  ADICIONAR DRONE
// ─────────────────────────────────────────────
async function addDrone() {
    const storeId = document.getElementById('addDroneStore').value;
    const name    = document.getElementById('addDroneName').value.trim();
    if (!storeId || !name) { alert('Escolha loja e nome do drone.'); return; }
    const { error } = await adminSupabase.from('drones').insert({
        name, store_id: parseInt(storeId), status: 'pending', capacity: 500, order_id: 0, servo_state: false
    });
    if (error) { alert('Erro ao adicionar drone: ' + error.message); return; }
    document.getElementById('addDroneName').value = '';
    await loadStores();
    alert('Drone adicionado!');
}

// ─────────────────────────────────────────────
//  EVENTOS
// ─────────────────────────────────────────────
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
}

function filterUsers() {
    const term = document.getElementById('searchInput').value.trim().toLowerCase();
    document.querySelectorAll('#usersBody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
}

// ─────────────────────────────────────────────
//  MAPA LEAFLET (com inicialização garantida)
// ─────────────────────────────────────────────
let leafletMap = null;
let mapMarker = null;

function initLeafletMap() {
    if (!window.L) {
        console.warn('Leaflet library not loaded yet, retrying...');
        setTimeout(initLeafletMap, 500);
        return;
    }

    const mapEl = document.getElementById('map');
    if (!mapEl) {
        console.warn('Map element not found');
        return;
    }

    // Se já foi inicializado, não refaz
    if (leafletMap) return;

    try {
        // Criar mapa
        leafletMap = L.map('map').setView([39.5, -8.0], 7);
        
        // Adicionar tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(leafletMap);

        // Forçar redraw (importante!)
        setTimeout(() => {
            if (leafletMap) leafletMap.invalidateSize();
        }, 100);

        // Event listener para cliques
        leafletMap.on('click', function (e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            document.getElementById('storeLat').value = lat;
            document.getElementById('storeLng').value = lng;
            
            if (mapMarker) {
                mapMarker.setLatLng(e.latlng);
            } else {
                mapMarker = L.marker(e.latlng).addTo(leafletMap);
            }
            
            console.log('Localização marcada:', lat, lng);
        });

        console.log('✅ Mapa Leaflet inicializado com sucesso');
    } catch (err) {
        console.error('❌ Erro ao inicializar mapa:', err);
    }
}

// Expor funções ao HTML inline
window.deleteStore  = deleteStore;
window.deleteDrone  = deleteDrone;
window.changeRole   = changeRole;

document.addEventListener('DOMContentLoaded', function () {
    init();
    // Inicializar mapa após um pequeno delay para garantir que tudo está pronto
    setTimeout(initLeafletMap, 500);
});