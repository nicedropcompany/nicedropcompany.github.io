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
        await Promise.all([loadGlobalOrders(), loadParentOrders(), loadPosts(), loadCategories()]);
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
    document.getElementById('searchInput').addEventListener('input', filterUsers);

    document.getElementById('newPostBtn').addEventListener('click', openAdminModal);
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    document.getElementById('modalOverlay').addEventListener('click', closeAdminModal);

    document.getElementById('newPostForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('postError');
        errorDiv.style.display = 'none';
        const postId = document.getElementById('editPostId').value;
        const title = document.getElementById('postTitle').value.trim();
        const author = document.getElementById('postAuthor').value.trim();
        const content = document.getElementById('postContent').value.trim();
        if (!title) { errorDiv.textContent = 'Título obrigatório.'; errorDiv.style.display = 'block'; return; }

        let error;
        if (postId) {
            ({ error } = await adminSupabase.from('posts').update({ title, author, content }).eq('id', postId));
        } else {
            ({ error } = await adminSupabase.from('posts').insert({ title, author, content, date: new Date().toISOString().split('T')[0] }));
        }
        if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; return; }
        closeAdminModal();
        await loadPosts();
    });
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

    const statusColors = { pending:'#f1c40f', confirmed:'#2980ef', processing:'#8e44ad', shipping:'#2980ef', delivered:'#27ae60', completed:'#27ae60', cancelled:'#e74c3c' };

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
async function loadPosts() {
    const { data: posts } = await adminSupabase
        .from('posts')
        .select('id, title, author, content, date, created_at')
        .order('created_at', { ascending: false });

    const list = posts || [];
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
                    <button onclick="editPost(${p.id},'${encodeURIComponent(p.title||'')}','${encodeURIComponent(p.author||'')}','${encodeURIComponent(p.content||'')}')" class="btn-outline" style="font-size:0.65rem;padding:6px 12px;">Editar</button>
                    <button onclick="deletePost(${p.id})" style="background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.45);color:#dc2626;padding:6px 12px;font-size:0.65rem;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Apagar</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function editPost(id, title, author, content) {
    document.getElementById('editPostId').value = id;
    document.getElementById('postTitle').value = decodeURIComponent(title);
    document.getElementById('postAuthor').value = decodeURIComponent(author);
    document.getElementById('postContent').value = decodeURIComponent(content);
    document.getElementById('postModalTitle').textContent = 'Editar Post';
    openAdminModal();
}

async function deletePost(id) {
    if (!confirm('Apagar este post?')) return;
    const { error } = await adminSupabase.from('posts').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
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
window.editPost = editPost;
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
    const name = input.value.trim();
    if (!name) return;
    const { error } = await adminSupabase.from('categories').insert({ categories: name });
    if (error) { alert('Erro: ' + error.message); return; }
    input.value = '';
    await loadCategories();
}

async function deleteCategory(id) {
    if (!confirm('Apagar esta categoria?')) return;
    const { error } = await adminSupabase.from('categories').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    await loadCategories();
}

window.deleteCategory = deleteCategory;

// ─────────────────────────────────────────────
//  EXPOR & INICIAR
// ─────────────────────────────────────────────
window.deleteStore  = deleteStore;
window.deleteDrone  = deleteDrone;
window.changeRole   = changeRole;

document.addEventListener('DOMContentLoaded', function () {
    init();
    setTimeout(initLeafletMap, 500);
});