function parseStoreIds(raw) {
    if (!raw) return [];
    let arr;
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'number') arr = [raw];
    else { try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : [p]; } catch { return []; } }
    return arr.map(Number);
}

async function appendStoreId(userId, storeId) {
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('store_id')
        .eq('id', userId)
        .single();
    const ids = parseStoreIds(profile?.store_id);
    const numId = Number(storeId);
    if (!ids.includes(numId)) ids.push(numId);
    return ids;
}

function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let supabaseClient = null;
const state = { user: null, stores: [], drones: [], team: [], orders: [], products: [], posts: [], currentStoreId: null };
let dashPostsCache = {};

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
        if (role === 'client' || role === 'operator') {
            window.location.href = '/client.html';
            return;
        }
        if (role === 'developer') {
            window.location.href = '/admin.html';
            return;
        }
        // Só owner pode aceder ao dashboard
        if (role !== 'owner') {
            window.location.href = '/auth.html';
            return;
        }

        state.user = profile;

        document.getElementById('userAvatar').textContent = (profile.username || 'U')[0].toUpperCase();
        document.getElementById('userName').textContent = profile.username || '-';

        if (role === 'owner' && profile.store_id) {
            // store_id é um array JSONB — normalizar antes de usar
            let ids = Array.isArray(profile.store_id) ? profile.store_id
                : typeof profile.store_id === 'number' ? [profile.store_id]
                : (() => { try { const p = JSON.parse(profile.store_id); return Array.isArray(p) ? p : [p]; } catch { return []; } })();

            if (ids.length > 0) {
                const { data: stores } = await supabaseClient
                    .from('stores')
                    .select('id, name, service')
                    .in('id', ids);
                state.stores = stores || [];
            }
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

    const { data: allProfiles } = await supabaseClient
        .from('profiles')
        .select('id, username, role, store_id')
        .in('role', ['operator', 'owner']);

    const numId = Number(storeId);
    const team = (allProfiles || []).filter(p => {
        const ids = parseStoreIds(p.store_id);
        return ids.includes(numId);
    });

    const { data: orders } = await supabaseClient
        .from('orders')
        .select('id, username, price, status, created_at, address')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(8);

    const { data: products } = await supabaseClient
        .from('products')
        .select('id, name, price, category, weight, image')
        .eq('store_id', storeId);

    const { data: posts } = await supabaseClient
        .from('posts')
        .select('id, title, author, content, date, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

    state.drones = drones || [];
    state.team = team;
    state.orders = orders || [];
    state.products = products || [];
    state.posts = posts || [];
}

function renderSidebar() {
    const el = document.getElementById('sidebarStores');
    if (!el) return;
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
    // Store status
    const storeStatus = store?.service === false || store?.service === 0 ? 'INATIVA' : 'ATIVA';
    const storeStatusColor = storeStatus === 'ATIVA' ? '#27ae60' : '#e74c3c';
    document.getElementById('storeMeta').innerHTML = `<span class="status-active" style="background:${storeStatusColor};color:#fff;padding:2px 10px;border-radius:12px;">${storeStatus}</span>`;

    // Stats
    const totalDrones = state.drones.length;
    const activeDrones = state.drones.filter(d => d.status === 'active' || d.status === 'shipping').length;
    const totalTeam = state.team.length;
    const totalRevenue = (state.orders || []).reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const totalProducts = (state.products || []).length;
    const pendingOrders = (state.orders || []).filter(o => o.status === 'pending' || o.status === 'confirmed').length;
    document.getElementById('statsRow').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Drones</div><div class="stat-number">${totalDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Drones Ativos</div><div class="stat-number">${activeDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Equipa</div><div class="stat-number">${totalTeam}</div></div>
        <div class="stat-card"><div class="stat-label">Receita</div><div class="stat-number" style="font-size:1.4rem;">${formatEuro(totalRevenue)}</div></div>
        <div class="stat-card"><div class="stat-label">Produtos</div><div class="stat-number">${totalProducts}</div></div>
        <div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-number" style="color:${pendingOrders > 0 ? '#f1c40f' : 'inherit'}">${pendingOrders}</div></div>
        <div class="stat-card"><div class="stat-label">Estado Loja</div><div class="stat-number" style="font-size:1rem;color:${storeStatusColor};padding-top:6px;">${storeStatus}</div></div>
    `;

    // Drone status badge colors
    const statusColors = {
        pending: '#f1c40f',
        shipping: '#2980ef',
        active: '#27ae60',
        inactive: '#e74c3c'
    };

    const ordersHtml = (state.orders || []).length
        ? (state.orders || []).map(o => {
            const sc = { pending:'#f1c40f', confirmed:'#2980ef', shipping:'#2980ef', delivered:'#27ae60', complete:'#27ae60', completed:'#27ae60', cancelled:'#e74c3c', canceled:'#e74c3c' };
            const s = (o.status || '').toLowerCase();
            return `<div class="drone-row" style="gap:10px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.82rem;">#${o.id} — ${o.username || '—'}</div>
                    <div style="font-size:0.72rem;color:var(--ink-faint);">${o.address ? o.address.substring(0,40) + (o.address.length > 40 ? '…' : '') : '—'}</div>
                </div>
                <span style="background:${sc[s]||'#bbb'};color:#fff;padding:2px 8px;border-radius:12px;font-size:0.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;flex-shrink:0;">${s}</span>
                <div style="flex-shrink:0;font-weight:600;font-size:0.82rem;">${formatEuro(o.price)}</div>
            </div>`;
        }).join('')
        : '<div class="empty-state-text">SEM ENCOMENDAS</div>';

    document.getElementById('detailRow').innerHTML = `
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            ${state.drones.length ? state.drones.map(d => `
                <div class="drone-row">
                    <div class="drone-name">${d.name}</div>
                    <span class="drone-status-badge ${d.status}" style="background:${statusColors[d.status] || '#bbb'};color:#fff;padding:2px 10px;border-radius:12px;">${d.status.toUpperCase()}</span>
                    <div>${d.capacity} g</div>
                </div>`).join('') : '<div class="empty-state-text">SEM DRONES</div>'}
        </div>
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <div id="teamListHtml"></div>
        </div>
        <div class="detail-card" style="grid-column:1/-1;">
            <div class="detail-card-title">Encomendas Recentes</div>
            ${ordersHtml}
        </div>
    `;

    // Renderizar equipa no container dedicado
    const teamListHtml = document.getElementById('teamListHtml');
    if (teamListHtml) {
        teamListHtml.innerHTML = state.team.length ? state.team.map(m => `
            <div class="team-member-row" data-member-id="${m.id}">
                <div class="member-avatar">${(m.username || 'U')[0].toUpperCase()}</div>
                <div class="member-info">
                    <div class="member-name">${m.username || '-'}</div>
                </div>
                <span class="member-role-badge ${m.role}">${m.role.toUpperCase()}</span>
                ${m.role !== 'owner' ? `<button class="make-owner-btn" data-member-id="${m.id}">Promover a OWNER</button> <button class="remove-member-btn" data-member-id="${m.id}" style="background:#e74c3c;color:#fff;border:none;border-radius:50%;width:28px;height:28px;font-size:18px;cursor:pointer;margin-left:8px;">&times;</button>` : ''}
            </div>`).join('') : '<div class="empty-state-text">SEM MEMBROS</div>';
    }
    // Add event para promover a owner
    if (teamListHtml) {
        teamListHtml.querySelectorAll('.make-owner-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const memberId = btn.getAttribute('data-member-id');
                if (!memberId) return;
                if (!confirm('Tem a certeza que deseja promover este funcionário a OWNER?')) return;
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ role: 'owner' })
                    .eq('id', memberId);
                if (error) {
                    alert('Erro ao mudar role: ' + error.message);
                    return;
                }
                await loadStoreData(state.currentStoreId);
                renderMain();
            });
        });
        // Add event para remover membro
        teamListHtml.querySelectorAll('.remove-member-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const memberId = btn.getAttribute('data-member-id');
                if (!memberId) return;
                if (!confirm('Remover este membro da loja?')) return;
                await removeMember(memberId);
            });
        });
    }

    renderPosts();
}

function renderPosts() {
    const el = document.getElementById('postsRow');
    if (!el) return;

    dashPostsCache = {};
    state.posts.forEach(p => { dashPostsCache[p.id] = p; });

    el.innerHTML = `
    <div class="detail-card" style="grid-column:1/-1;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div class="detail-card-title" style="margin-bottom:0;">Posts / Notícias</div>
            <button id="newPostDashBtn" class="btn-primary" style="font-size:0.72rem;padding:8px 16px;">+ Novo Post</button>
        </div>
        ${state.posts.length ? state.posts.map(p => {
            const dateStr = (p.date || p.created_at) ? new Date(p.date || p.created_at).toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' }) : '—';
            const preview = p.content ? p.content.substring(0, 80) + (p.content.length > 80 ? '…' : '') : '';
            return `<div style="padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.08);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.88rem;">${p.title || '—'}</div>
                        <div style="font-size:0.72rem;color:var(--ink-faint);margin-top:2px;">${p.author || '—'} · ${dateStr}</div>
                        ${preview ? `<div style="font-size:0.78rem;color:var(--ink-faint);margin-top:4px;">${preview}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button class="dash-edit-post-btn btn-outline" data-id="${p.id}" style="font-size:0.62rem;padding:5px 10px;">Editar</button>
                        <button class="dash-delete-post-btn" data-id="${p.id}" style="background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.45);color:#dc2626;padding:5px 10px;font-size:0.62rem;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Apagar</button>
                    </div>
                </div>
            </div>`;
        }).join('') : '<div class="empty-state-text" style="padding:20px 0;font-size:0.82rem;">SEM POSTS</div>'}
    </div>`;

    document.getElementById('newPostDashBtn').addEventListener('click', () => {
        document.getElementById('dashPostId').value = '';
        document.getElementById('dashPostTitle').value = '';
        document.getElementById('dashPostAuthor').value = state.user?.username || '';
        document.getElementById('dashPostContent').value = '';
        document.getElementById('dashPostModalTitle').textContent = 'Novo Post';
        document.getElementById('dashPostError').style.display = 'none';
        openModal('dashPostModal');
    });

    el.querySelectorAll('.dash-edit-post-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = dashPostsCache[btn.dataset.id];
            if (!p) return;
            document.getElementById('dashPostId').value = p.id;
            document.getElementById('dashPostTitle').value = p.title || '';
            document.getElementById('dashPostAuthor').value = p.author || '';
            document.getElementById('dashPostContent').value = p.content || '';
            document.getElementById('dashPostModalTitle').textContent = 'Editar Post';
            document.getElementById('dashPostError').style.display = 'none';
            openModal('dashPostModal');
        });
    });

    el.querySelectorAll('.dash-delete-post-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Apagar este post?')) return;
            const { error } = await supabaseClient.from('posts').delete().eq('id', btn.dataset.id);
            if (error) { alert('Erro: ' + error.message); return; }
            await loadStoreData(state.currentStoreId);
            renderPosts();
        });
    });
}

async function removeMember(userId) {
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('store_id')
        .eq('id', userId)
        .single();
    const ids = parseStoreIds(profile?.store_id).filter(id => id !== state.currentStoreId);
    const { error } = await supabaseClient
        .from('profiles')
        .update({ store_id: ids.length ? ids : null, role: ids.length ? 'operator' : 'client' })
        .eq('id', userId);
    if (error) {
        alert('Erro ao remover membro: ' + error.message);
        return;
    }
    await loadStoreData(state.currentStoreId);
    renderMain();
}

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Adicionar operador - abrir modal
    const addOperatorBtn = document.getElementById('addOperatorBtn');
    if (addOperatorBtn) {
        addOperatorBtn.addEventListener('click', () => {
            openModal('addOperatorModal');
        });
    }

    // Submissão do formulário de operador
    const addOperatorForm = document.getElementById('addOperatorForm');
    if (addOperatorForm) {
        addOperatorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('addOperatorEmail');
            const errorDiv = document.getElementById('addOperatorError');
            errorDiv.textContent = '';
            const email = emailInput.value.trim();
            if (!email) {
                errorDiv.textContent = 'Introduza o email.';
                return;
            }
            // Procurar utilizador
            const { data: user } = await supabaseClient
                .from('users_with_email')
                .select('id')
                .eq('email', email)
                .single();
            if (!user) {
                errorDiv.textContent = 'Utilizador não encontrado';
                return;
            }
            const ids = await appendStoreId(user.id, state.currentStoreId);
            const { error } = await supabaseClient
                .from('profiles')
                .update({ store_id: ids, role: 'operator' })
                .eq('id', user.id);
            if (error) {
                errorDiv.textContent = 'Erro ao adicionar operador: ' + error.message;
                return;
            }
            closeModal('addOperatorModal');
            emailInput.value = '';
            await loadStoreData(state.currentStoreId);
            renderMain();
        });
    }

    const dashPostForm = document.getElementById('dashPostForm');
    if (dashPostForm) {
        dashPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('dashPostError');
            errorDiv.style.display = 'none';
            const postId = document.getElementById('dashPostId').value;
            const title = document.getElementById('dashPostTitle').value.trim();
            const author = document.getElementById('dashPostAuthor').value.trim();
            const content = document.getElementById('dashPostContent').value.trim();
            if (!title) { errorDiv.textContent = 'Título obrigatório.'; errorDiv.style.display = 'block'; return; }

            if (postId) {
                const { data: updated, error } = await supabaseClient
                    .from('posts')
                    .update({ title, author, content })
                    .eq('id', postId)
                    .select();
                if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; return; }
                if (!updated?.length) { errorDiv.textContent = 'Sem permissão para guardar.'; errorDiv.style.display = 'block'; return; }
            } else {
                const { error } = await supabaseClient
                    .from('posts')
                    .insert({ title, author, content, store_id: state.currentStoreId, date: new Date().toISOString().split('T')[0] });
                if (error) { errorDiv.textContent = 'Erro: ' + error.message; errorDiv.style.display = 'block'; return; }
            }

            closeModal('dashPostModal');
            await loadStoreData(state.currentStoreId);
            renderPosts();
        });
    }
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