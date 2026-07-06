function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let adminSupabase = null;
let currentUser = null;
let allUsers = [];
let storeMap = {};
let droneMap = {};
let usersCurrentPage = 0;
const USERS_PER_PAGE = 20;

let storeLeafletMap = null;
let storeMapMarker = null;

function setStoreLocMode(mode) {
    const mapPanel    = document.getElementById('storeMapPanel');
    const coordsPanel = document.getElementById('storeCoordsPanel');
    const mapBtn      = document.getElementById('modeMapBtn');
    const coordBtn    = document.getElementById('modeCoordsBtn');
    if (mode === 'map') {
        mapPanel.style.display    = '';
        coordsPanel.style.display = 'none';
        mapBtn.className   = 'btn-primary';
        coordBtn.className = 'btn-outline';
        setTimeout(initStoreMap, 50);
    } else {
        mapPanel.style.display    = 'none';
        coordsPanel.style.display = '';
        mapBtn.className   = 'btn-outline';
        coordBtn.className = 'btn-primary';
    }
}

function initStoreMap() {
    if (storeLeafletMap) { storeLeafletMap.invalidateSize(); return; }
    storeLeafletMap = L.map('storeMapEl').setView([38.716, -9.139], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(storeLeafletMap);
    storeLeafletMap.on('click', function(e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        document.getElementById('storeLat').value = lat;
        document.getElementById('storeLng').value = lng;
        document.getElementById('mapCoordInfo').textContent = `Lat: ${lat}  |  Lng: ${lng}`;
        if (storeMapMarker) storeMapMarker.setLatLng(e.latlng);
        else storeMapMarker = L.marker(e.latlng).addTo(storeLeafletMap);
    });
}

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
        await Promise.all([loadGlobalOrders(), loadParentOrders(), loadPosts(), loadCategories()]);
        bindEvents();
        setTimeout(initStoreMap, 500);
        setInterval(updateDroneOnlineBadges, 30000);
    });
}

// ─────────────────────────────────────────────
//  UTILIZADORES
// ─────────────────────────────────────────────
async function loadUsers() {
    const { data: users, error } = await adminSupabase
        .from('users_with_email')
        .select('id, username, role, email, store_id');
    if (error) { showToast('Erro ao carregar utilizadores: ' + error.message, 'error'); return; }

    const { data: stores } = await adminSupabase.from('stores').select('id, name');
    storeMap = {};
    (stores || []).forEach(s => { storeMap[s.id] = s.name; });

    const { data: drones } = await adminSupabase.from('drones').select('id');
    const totalStores    = stores ? stores.length : 0;
    const totalDrones    = drones ? drones.length : 0;
    const totalUsers     = users.length;
    const totalOperators = users.filter(u => u.role === 'operator').length;

    document.getElementById('userTypeSummary').innerHTML = `
        <div class="stat-card"><div class="stat-label">Lojas</div><div class="stat-number">${totalStores}</div></div>
        <div class="stat-card"><div class="stat-label">Drones</div><div class="stat-number">${totalDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Utilizadores</div><div class="stat-number">${totalUsers}</div></div>
        <div class="stat-card"><div class="stat-label">Operadores</div><div class="stat-number">${totalOperators}</div></div>
    `;

    allUsers = users;
    usersCurrentPage = 0;
    renderUsersTable();
}

function renderUsersTable(searchTerm) {
    const term = (searchTerm !== undefined ? searchTerm : document.getElementById('searchInput').value).trim().toLowerCase();
    const filtered = term
        ? allUsers.filter(u =>
            (u.username || '').toLowerCase().includes(term) ||
            (u.email || '').toLowerCase().includes(term) ||
            (u.role || '').toLowerCase().includes(term))
        : allUsers;

    const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
    if (usersCurrentPage >= totalPages) usersCurrentPage = totalPages - 1;

    const start = usersCurrentPage * USERS_PER_PAGE;
    const page = filtered.slice(start, start + USERS_PER_PAGE);

    document.getElementById('usersBody').innerHTML = page.map(u => {
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

    const pag = document.getElementById('usersPagination');
    if (!pag) return;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    const rangeEnd = Math.min((usersCurrentPage + 1) * USERS_PER_PAGE, filtered.length);
    pag.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0;font-size:0.78rem;color:var(--ink-faint);">
            <button ${usersCurrentPage === 0 ? 'disabled' : ''} onclick="usersGoPage(${usersCurrentPage - 1})" class="btn-outline" style="padding:6px 14px;font-size:0.7rem;">&#8249; Anterior</button>
            <span>${start + 1}–${rangeEnd} de ${filtered.length}</span>
            <button ${usersCurrentPage >= totalPages - 1 ? 'disabled' : ''} onclick="usersGoPage(${usersCurrentPage + 1})" class="btn-outline" style="padding:6px 14px;font-size:0.7rem;">Seguinte &#8250;</button>
        </div>`;
}

function usersGoPage(page) {
    usersCurrentPage = page;
    renderUsersTable();
}
window.usersGoPage = usersGoPage;

async function changeRole(userId, role) {
    const { error } = await adminSupabase.from('profiles').update({ role }).eq('id', userId);
    if (error) showToast('Erro ao mudar role: ' + error.message, 'error');
    else { showToast('Role atualizado!', 'success'); await loadUsers(); }
}

// ─────────────────────────────────────────────
//  LOJAS
// ─────────────────────────────────────────────
// ESP32 online se deu sinal de vida (last_seen) nos últimos 90s.
function droneOnlineInfo(lastSeen) {
    if (!lastSeen) return { online: false, label: 'OFFLINE' };
    const ageMs = Date.now() - new Date(lastSeen).getTime();
    const online = ageMs < 90000;
    return { online, label: online ? 'ONLINE' : 'OFFLINE' };
}

// Atualiza só os badges online/offline (chamado num intervalo, sem re-render total)
async function updateDroneOnlineBadges() {
    const badges = document.querySelectorAll('.drone-online-badge');
    if (!badges.length || !adminSupabase) return;
    const { data: drones } = await adminSupabase.from('drones').select('id, last_seen');
    if (!drones) return;
    const seen = {};
    drones.forEach(d => { seen[d.id] = d.last_seen; });
    badges.forEach(b => {
        const info = droneOnlineInfo(seen[b.dataset.droneId]);
        b.textContent = info.label;
        b.style.background = info.online ? '#27ae60' : '#9ca3af';
    });
}

async function loadStores() {
    const { data: stores, error } = await adminSupabase
        .from('stores')
        .select('id, name, service, latitude, longitude');
    if (error) { console.error('Erro stores:', error.message); return; }

    const { data: drones } = await adminSupabase.from('drones').select('id, store_id, status, name, capacity, wifi_ssid, wifi_password, last_seen');
    const { data: owners } = await adminSupabase.from('profiles').select('id, username, store_id, role');

    droneMap = {};
    (drones || []).forEach(d => { droneMap[d.id] = d; });

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
                const on = droneOnlineInfo(d.last_seen);
                const onColor = on.online ? '#27ae60' : '#9ca3af';
                return `<div class="drone-item">
                    <span>${d.name}</span>
                    <span class="drone-online-badge" data-drone-id="${d.id}" title="Estado do ESP32 (deu sinal há &lt;90s = online)" style="background:${onColor};color:#fff;padding:1px 8px;border-radius:999px;font-size:0.55rem;font-weight:700;letter-spacing:0.5px;flex-shrink:0;">${on.label}</span>
                    <span class="${dc}">${d.status.toUpperCase()}</span>
                    <button style="background:rgba(41,128,239,0.15);border:1.5px solid rgba(41,128,239,0.5);color:#2980ef;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;transition:background 0.2s;" onmouseover="this.style.background='rgba(41,128,239,0.3)'" onmouseout="this.style.background='rgba(41,128,239,0.15)'" onclick="editDrone(${d.id})" title="Editar drone / WiFi">✎</button>
                    <button style="background:rgba(39,174,96,0.15);border:1.5px solid rgba(39,174,96,0.5);color:#27ae60;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;transition:background 0.2s;" onmouseover="this.style.background='rgba(39,174,96,0.3)'" onmouseout="this.style.background='rgba(39,174,96,0.15)'" onclick="generateDroneFirmware(${d.id})" title="Gerar firmware .ino">⤓</button>
                    <button style="background:rgba(220,38,38,0.15);border:1.5px solid rgba(220,38,38,0.5);color:#dc2626;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;transition:background 0.2s;" onmouseover="this.style.background='rgba(220,38,38,0.3)'" onmouseout="this.style.background='rgba(220,38,38,0.15)'" onclick="deleteDrone(${d.id})" title="Remover drone">×</button>
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
                <button style="background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.45);color:#dc2626;padding:8px 16px;font-size:0.72rem;text-transform:uppercase;letter-spacing:1.2px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;border-radius:0;transition:background 0.2s;" onmouseover="this.style.background='rgba(220,38,38,0.25)'" onmouseout="this.style.background='rgba(220,38,38,0.12)'" onclick="deleteStore(${s.id})">Apagar Loja</button>
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

    const { error: droneErr } = await adminSupabase.from('drones').delete().eq('store_id', id);
    if (droneErr) { showToast('Erro ao apagar drones: ' + droneErr.message, 'error'); return; }

    const { data: affectedProfiles } = await adminSupabase
        .from('profiles')
        .select('id, store_id, role');

    for (const profile of affectedProfiles || []) {
        let ids = Array.isArray(profile.store_id) ? profile.store_id
            : typeof profile.store_id === 'number' ? [profile.store_id]
            : (() => { try { const p = JSON.parse(profile.store_id); return Array.isArray(p) ? p : [p]; } catch { return []; } })();

        if (!ids.includes(id)) continue;

        const newIds = ids.filter(i => i !== id);
        await adminSupabase.from('profiles').update({
            store_id: newIds.length ? newIds : null,
            role: newIds.length ? profile.role : 'client'
        }).eq('id', profile.id);
    }

    const { error: storeErr } = await adminSupabase.from('stores').delete().eq('id', id).select();
    if (storeErr) { showToast('Erro ao apagar loja: ' + storeErr?.message, 'error'); return; }

    showToast('Loja apagada.', 'success');
    await loadStores();
    await loadUsers();
}

// ─────────────────────────────────────────────
//  APAGAR DRONE
// ─────────────────────────────────────────────
async function deleteDrone(droneId) {
    const { error } = await adminSupabase.from('drones').delete().eq('id', Number(droneId));
    if (error) { showToast('Erro ao apagar drone: ' + error.message, 'error'); return; }
    showToast('Drone removido.', 'success');
    await loadStores();
}

// ─────────────────────────────────────────────
//  EDITAR DRONE (WiFi + id)
// ─────────────────────────────────────────────
function openDroneModal() {
    document.getElementById('droneEditModal').classList.add('show');
    document.getElementById('droneModalOverlay').classList.add('show');
}

function closeDroneModal() {
    document.getElementById('droneEditModal').classList.remove('show');
    document.getElementById('droneModalOverlay').classList.remove('show');
}

function editDrone(droneId) {
    const d = droneMap[droneId];
    if (!d) { showToast('Drone não encontrado.', 'error'); return; }
    document.getElementById('editDroneOriginalId').value = d.id;
    document.getElementById('editDroneId').value         = d.id;
    document.getElementById('editDroneName').value        = d.name || '';
    document.getElementById('editDroneCapacity').value    = (d.capacity ?? '');
    document.getElementById('editDroneSsid').value        = d.wifi_ssid || '';
    document.getElementById('editDronePassword').value    = d.wifi_password || '';
    document.getElementById('droneEditError').style.display = 'none';
    openDroneModal();
}

async function saveDroneEdit() {
    const originalId = Number(document.getElementById('editDroneOriginalId').value);
    const name       = document.getElementById('editDroneName').value.trim();
    const capRaw     = document.getElementById('editDroneCapacity').value;
    const ssid       = document.getElementById('editDroneSsid').value.trim();
    const password   = document.getElementById('editDronePassword').value;
    const errorDiv   = document.getElementById('droneEditError');
    errorDiv.style.display = 'none';

    if (!name)               { errorDiv.textContent = 'O nome do drone é obrigatório.'; errorDiv.style.display = 'block'; return; }
    if (!ssid || !password)  { errorDiv.textContent = 'WiFi SSID e password são obrigatórios.'; errorDiv.style.display = 'block'; return; }

    // O ID (chave primária) NÃO é editável — evita colisões e reflash desnecessário do ESP32.
    const update = {
        name,
        capacity: capRaw !== '' ? parseInt(capRaw) : 500,
        wifi_ssid: ssid,
        wifi_password: password
    };

    const { error } = await adminSupabase.from('drones').update(update).eq('id', originalId);
    if (error) { errorDiv.textContent = 'Erro ao guardar: ' + error.message; errorDiv.style.display = 'block'; return; }

    closeDroneModal();
    showToast('Drone atualizado! (o ESP32 recebe as novas credenciais se estiver online)', 'success');
    await loadStores();
}

// ─────────────────────────────────────────────
//  GERAR FIRMWARE .ino
// ─────────────────────────────────────────────
// Escapa uma string para caber num literal C ("...").
function escapeCString(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function downloadFirmware(id, ssid, password) {
    if (!ssid || !password) { showToast('O drone não tem WiFi definido — edita e preenche primeiro.', 'warning'); return; }
    let template;
    try {
        const res = await fetch('firmware/nicedrop_drone_template.ino', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        template = await res.text();
    } catch (e) {
        showToast('Não consegui carregar o template do firmware (' + e.message + '). Precisa de estar publicado no site.', 'error');
        return;
    }
    const code = template
        .split('{{DRONE_ID}}').join(String(id))
        .split('{{WIFI_SSID}}').join(escapeCString(ssid))
        .split('{{WIFI_PASS}}').join(escapeCString(password));

    const blob = new Blob([code], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nicedrop_drone_${id}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Firmware nicedrop_drone_${id}.ino gerado!`, 'success');
}

// A partir do cartão da loja (usa os valores guardados na BD).
function generateDroneFirmware(droneId) {
    const d = droneMap[droneId];
    if (!d) { showToast('Drone não encontrado.', 'error'); return; }
    downloadFirmware(d.id, d.wifi_ssid, d.wifi_password);
}

// A partir do modal de edição (usa os valores atuais dos campos).
function generateFirmwareFromModal() {
    const id   = document.getElementById('editDroneId').value || document.getElementById('editDroneOriginalId').value;
    const ssid = document.getElementById('editDroneSsid').value.trim();
    const pass = document.getElementById('editDronePassword').value;
    downloadFirmware(id, ssid, pass);
}

// ─────────────────────────────────────────────
//  CRIAR LOJA — faz append ao array, nunca substitui
// ─────────────────────────────────────────────
async function createStore() {
    const ownerEmail = document.getElementById('ownerEmail').value.trim();
    const name       = document.getElementById('storeName').value.trim();
    const lat        = document.getElementById('storeLat').value;
    const lng        = document.getElementById('storeLng').value;
    const btn        = document.getElementById('createStoreBtn');

    if (!ownerEmail || !name || !lat || !lng) {
        showToast('Preencha todos os campos incluindo as coordenadas.', 'warning');
        return;
    }

    setButtonLoading(btn, true);

    const { data: ownerUser, error: ownerErr } = await adminSupabase
        .from('users_with_email')
        .select('id')
        .eq('email', ownerEmail)
        .single();
    if (ownerErr || !ownerUser) {
        showToast('Owner não encontrado.', 'error');
        setButtonLoading(btn, false);
        return;
    }

    const { data: newStore, error: storeErr } = await adminSupabase
        .from('stores')
        .insert({ name, latitude: parseFloat(lat), longitude: parseFloat(lng), service: false })
        .select('id')
        .single();
    if (storeErr || !newStore) {
        showToast('Erro ao criar loja: ' + (storeErr?.message || ''), 'error');
        setButtonLoading(btn, false);
        return;
    }

    const { data: ownerProfile } = await adminSupabase
        .from('profiles')
        .select('store_id, role')
        .eq('id', ownerUser.id)
        .single();

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

    if (!ids.includes(newStore.id)) ids.push(newStore.id);

    const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update({ store_id: ids, role: 'owner' })
        .eq('id', ownerUser.id);
    if (updateErr) {
        showToast('Erro ao atualizar owner: ' + updateErr.message, 'error');
        setButtonLoading(btn, false);
        return;
    }

    document.getElementById('ownerEmail').value  = '';
    document.getElementById('storeName').value   = '';
    document.getElementById('storeLat').value    = '';
    document.getElementById('storeLng').value    = '';
    const latVis = document.getElementById('storeLatVis');
    const lngVis = document.getElementById('storeLngVis');
    if (latVis) latVis.value = '';
    if (lngVis) lngVis.value = '';
    if (storeMapMarker) { storeMapMarker.remove(); storeMapMarker = null; }
    const info = document.getElementById('mapCoordInfo');
    if (info) info.textContent = 'Clica no mapa para definir a localização da loja.';

    setButtonLoading(btn, false);
    showToast(`Loja "${name}" criada com sucesso!`, 'success');
    await loadStores();
    await loadUsers();
}

// ─────────────────────────────────────────────
//  ADICIONAR DRONE
// ─────────────────────────────────────────────
async function addDrone() {
    const storeId  = document.getElementById('addDroneStore').value;
    const name     = document.getElementById('addDroneName').value.trim();
    const capRaw   = document.getElementById('addDroneCapacity').value;
    const cap      = capRaw !== '' ? parseInt(capRaw) : 500;
    const ssid     = document.getElementById('addDroneSsid').value.trim();
    const password = document.getElementById('addDronePassword').value;
    const btn      = document.getElementById('addDroneBtn');
    if (!storeId || !name) { showToast('Escolha uma loja e escreva o nome do drone.', 'warning'); return; }
    if (!ssid || !password) { showToast('Preencha o WiFi SSID e a password (necessários para gerar o firmware).', 'warning'); return; }
    setButtonLoading(btn, true);
    const { error } = await adminSupabase.from('drones').insert({
        name, store_id: parseInt(storeId), status: 'pending', capacity: cap, order_id: 0, servo_state: false,
        wifi_ssid: ssid, wifi_password: password
    });
    if (error) { showToast('Erro ao adicionar drone: ' + error.message, 'error'); setButtonLoading(btn, false); return; }
    document.getElementById('addDroneName').value     = '';
    document.getElementById('addDroneCapacity').value = '';
    document.getElementById('addDroneSsid').value     = '';
    document.getElementById('addDronePassword').value = '';
    setButtonLoading(btn, false);
    showToast('Drone adicionado!', 'success');
    await loadStores();
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
    document.getElementById('searchInput').addEventListener('input', filterUsers);

    document.getElementById('newPostBtn').addEventListener('click', () => {
        document.getElementById('newPostForm').reset();
        document.getElementById('editPostId').value = '';
        document.getElementById('postAuthor').value = currentUser?.username || currentUser?.email || '';
        document.getElementById('postModalTitle').textContent = 'Novo Post';
        document.getElementById('postError').style.display = 'none';
        openAdminModal();
    });
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    document.getElementById('modalOverlay').addEventListener('click', closeAdminModal);
    document.getElementById('newPostModal').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('droneModalOverlay').addEventListener('click', closeDroneModal);
    document.getElementById('droneEditModal').addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('newPostForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('postError');
        const btn = e.target.querySelector('button[type="submit"]');
        errorDiv.style.display = 'none';
        const postId = document.getElementById('editPostId').value;
        const title = document.getElementById('postTitle').value.trim();
        const author = document.getElementById('postAuthor').value.trim();
        const content = document.getElementById('postContent').value.trim();
        if (!title) { errorDiv.textContent = 'Título obrigatório.'; errorDiv.style.display = 'block'; return; }

        setButtonLoading(btn, true);
        if (postId) {
            const { data: updated, error } = await adminSupabase
                .from('posts')
                .update({ title, author, content })
                .eq('id', postId)
                .select();
            if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; setButtonLoading(btn, false); return; }
            if (!updated?.length) { errorDiv.textContent = 'Não foi possível guardar. Verifique as permissões.'; errorDiv.style.display = 'block'; setButtonLoading(btn, false); return; }
        } else {
            const { error } = await adminSupabase.from('posts').insert({ title, author, content, date: new Date().toISOString().split('T')[0] });
            if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; setButtonLoading(btn, false); return; }
        }
        setButtonLoading(btn, false);
        closeAdminModal();
        showToast('Post guardado!', 'success');
        await loadPosts();
    });
}

function filterUsers() {
    usersCurrentPage = 0;
    renderUsersTable();
}

// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  ENCOMENDAS GLOBAIS
// ─────────────────────────────────────────────
async function loadGlobalOrders() {
    const { data: orders } = await adminSupabase
        .from('orders')
        .select('id, username, email, store, price, status, created_at, date')
        .order('created_at', { ascending: false })
        .limit(50);

    const list = orders || [];
    document.getElementById('ordersGlobalCount').textContent = list.length + ' encomenda' + (list.length !== 1 ? 's' : '');

    const statusColors = { pending:'#f1c40f', confirmed:'#2980ef', processing:'#8e44ad', shipping:'#2980ef', delivered:'#27ae60', complete:'#27ae60', completed:'#27ae60', cancelled:'#e74c3c', canceled:'#e74c3c' };

    document.getElementById('ordersGlobalBody').innerHTML = list.length
        ? list.map(o => {
            const s = (o.status || '').toLowerCase();
            const color = statusColors[s] || '#bbb';
            const d = o.date || o.created_at;
            const dateStr = d ? new Date(d).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
            return `<tr>
                <td><strong>#${o.id}</strong></td>
                <td>${o.username || o.email || '—'}</td>
                <td>${o.store || '—'}</td>
                <td>${new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(o.price||0)}</td>
                <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:0.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${s||'—'}</span></td>
                <td style="white-space:nowrap;">${dateStr}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:24px;">Sem encomendas</td></tr>';
}

// ─────────────────────────────────────────────
//  PARENT ORDERS (STRIPE)
// ─────────────────────────────────────────────
async function loadParentOrders() {
    const { data: pOrders } = await adminSupabase
        .from('parent_orders')
        .select('id, paid, stripe_session_id, payment_url, created_at')
        .order('created_at', { ascending: false })
        .limit(30);

    const list = pOrders || [];
    document.getElementById('parentOrdersCount').textContent = list.length + ' pagamento' + (list.length !== 1 ? 's' : '');

    document.getElementById('parentOrdersBody').innerHTML = list.length
        ? list.map(p => {
            const isPaid = p.paid === true || p.paid?.status === 'paid' || JSON.stringify(p.paid)?.includes('paid');
            const color = isPaid ? '#27ae60' : '#f1c40f';
            const label = isPaid ? 'Pago' : 'Pendente';
            const session = p.stripe_session_id ? p.stripe_session_id.substring(0, 20) + '…' : '—';
            const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
            return `<tr>
                <td><strong>#${p.id}</strong></td>
                <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:0.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${label}</span></td>
                <td style="font-size:0.75rem;color:var(--ink-faint);">${session}</td>
                <td style="white-space:nowrap;">${dateStr}</td>
                <td>${p.payment_url ? `<a href="${p.payment_url}" target="_blank" class="btn-outline" style="font-size:0.65rem;padding:5px 10px;">Link</a>` : '—'}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="5" style="text-align:center;color:var(--ink-faint);padding:24px;">Sem pagamentos</td></tr>';
}

// ─────────────────────────────────────────────
//  POSTS
// ─────────────────────────────────────────────
let postsCache = {};

async function loadPosts() {
    const { data: posts } = await adminSupabase
        .from('posts')
        .select('id, title, author, content, date, created_at')
        .order('created_at', { ascending: false });

    const list = posts || [];
    postsCache = {};
    list.forEach(p => { postsCache[p.id] = p; });

    const el = document.getElementById('postsList');

    if (!list.length) {
        el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--ink-faint);font-size:0.82rem;text-transform:uppercase;letter-spacing:1px;">Sem posts</div>';
        return;
    }

    el.innerHTML = list.map(p => {
        const dateStr = (p.date || p.created_at) ? new Date(p.date || p.created_at).toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' }) : '—';
        const preview = p.content ? p.content.substring(0, 100) + (p.content.length > 100 ? '…' : '') : '';
        return `
        <div style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.3);">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.9rem;">${p.title || '—'}</div>
                    <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:2px;">${p.author || '—'} · ${dateStr}</div>
                    ${preview ? `<div style="font-size:0.8rem;color:var(--ink-faint);margin-top:6px;">${preview}</div>` : ''}
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button class="delete-post-btn" data-id="${p.id}" style="background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.45);color:#dc2626;padding:6px 12px;font-size:0.65rem;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Apagar</button>
                </div>
            </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', () => deletePost(btn.dataset.id));
    });
}

async function deletePost(id) {
    if (!confirm('Apagar este post?')) return;
    const { error } = await adminSupabase.from('posts').delete().eq('id', id);
    if (error) { showToast('Erro ao apagar post: ' + error.message, 'error'); return; }
    showToast('Post apagado.', 'success');
    await loadPosts();
}

function openAdminModal() {
    document.getElementById('newPostModal').classList.add('show');
    document.getElementById('modalOverlay').classList.add('show');
}

function closeAdminModal() {
    document.getElementById('newPostModal').classList.remove('show');
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('newPostForm').reset();
    document.getElementById('editPostId').value = '';
    document.getElementById('postModalTitle').textContent = 'Novo Post';
    document.getElementById('postError').style.display = 'none';
}

window.closeAdminModal = closeAdminModal;
window.deletePost = deletePost;

// ─────────────────────────────────────────────
//  CATEGORIAS
// ─────────────────────────────────────────────
async function loadCategories() {
    const { data: cats } = await adminSupabase.from('categories').select('id, categories').order('id');
    const list = cats || [];
    const el = document.getElementById('categoriesList');

    if (!list.length) {
        el.innerHTML = '<div style="color:var(--ink-faint);font-size:0.82rem;padding:12px 0;">Sem categorias</div>';
        return;
    }

    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:4px;">${list.map(c => `
        <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.5);border:1px solid var(--glass-border);padding:6px 14px;">
            <span style="font-size:0.82rem;font-weight:600;">${c.categories}</span>
            <button onclick="deleteCategory(${c.id})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px;line-height:1;padding:0;">&times;</button>
        </div>`).join('')}</div>`;
}

async function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const btn   = document.getElementById('addCategoryBtn');
    const name  = input.value.trim();
    if (!name) return;
    setButtonLoading(btn, true);
    const { error } = await adminSupabase.from('categories').insert({ categories: name });
    setButtonLoading(btn, false);
    if (error) { showToast('Erro ao adicionar categoria: ' + error.message, 'error'); return; }
    showToast('Categoria adicionada!', 'success');
    input.value = '';
    await loadCategories();
}

async function deleteCategory(id) {
    if (!confirm('Apagar esta categoria?')) return;
    const { error } = await adminSupabase.from('categories').delete().eq('id', id);
    if (error) { showToast('Erro ao apagar categoria: ' + error.message, 'error'); return; }
    showToast('Categoria apagada.', 'success');
    await loadCategories();
}

window.deleteCategory = deleteCategory;

// ─────────────────────────────────────────────
//  EXPOR & INICIAR
// ─────────────────────────────────────────────
window.deleteStore      = deleteStore;
window.deleteDrone      = deleteDrone;
window.editDrone            = editDrone;
window.saveDroneEdit        = saveDroneEdit;
window.closeDroneModal      = closeDroneModal;
window.generateDroneFirmware   = generateDroneFirmware;
window.generateFirmwareFromModal = generateFirmwareFromModal;
window.changeRole       = changeRole;
window.setStoreLocMode  = setStoreLocMode;

document.addEventListener('DOMContentLoaded', function () {
    init();
});