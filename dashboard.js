function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

let supabaseClient = null;
const state = { user: null, stores: [], drones: [], team: [], currentStoreId: null };

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
            alert('Sem acesso ao painel web');
            window.location.href = '/auth.html';
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
        document.getElementById('userRole').textContent = role.toUpperCase();

        if (role === 'owner' && profile.store_id) {
            const { data: stores } = await supabaseClient
                .from('stores')
                .select('id, name, service')
                .eq('id', profile.store_id);
            state.stores = stores || [];
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
    const { data: team } = await supabaseClient
        .from('profiles')
        .select('id, username, role')
        .eq('store_id', storeId);
    state.drones = drones || [];
    state.team = team || [];
}

function renderSidebar() {
    const el = document.getElementById('sidebarStores');
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
    document.getElementById('statsRow').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Drones</div><div class="stat-number">${totalDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Drones Ativos</div><div class="stat-number">${activeDrones}</div></div>
        <div class="stat-card"><div class="stat-label">Equipa</div><div class="stat-number">${totalTeam}</div></div>
        <div class="stat-card"><div class="stat-label">Estado Loja</div><div class="stat-number" style="color:${storeStatusColor}">${storeStatus}</div></div>
    `;

    // Drone status badge colors
    const statusColors = {
        pending: '#f1c40f',
        shipping: '#2980ef',
        active: '#27ae60',
        inactive: '#e74c3c'
    };

    document.getElementById('detailRow').innerHTML = `
        <div class="detail-card">
            <div class="detail-card-title">Drones</div>
            ${state.drones.length ? state.drones.map(d => `
                <div class="drone-row">
                    <div class="drone-name">${d.name}</div>
                    <span class="drone-status-badge ${d.status}" style="background:${statusColors[d.status] || '#bbb'};color:#fff;padding:2px 10px;border-radius:12px;">${d.status.toUpperCase()}</span>
                    <div>${d.capacity} kg</div>
                </div>`).join('') : '<div class="empty-state-text">SEM DRONES</div>'}
        </div>
        <div class="detail-card">
            <div class="detail-card-title">Equipa</div>
            <button id="addEmployeeBtn" class="add-member-btn">Adicionar Funcionário</button>
            <!-- Lista de membros da equipa com botão para promover a owner -->
            <div id="teamListHtml"></div>
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
    // Add event for Adicionar Funcionário
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', async () => {
            const email = prompt('Email do funcionário a adicionar:');
            if (!email) return;
            // Search user by email
            const { data: user } = await supabaseClient
                .from('users_with_email')
                .select('id')
                .eq('email', email)
                .single();
            if (!user) {
                alert('Utilizador não encontrado');
                return;
            }
            // Update profile
            const { error } = await supabaseClient
                .from('profiles')
                .update({ store_id: state.currentStoreId, role: 'operator' })
                .eq('id', user.id);
            if (error) {
                alert('Erro ao adicionar funcionário: ' + error.message);
                return;
            }
            // Reload team
            await loadStoreData(state.currentStoreId);
            renderMain();
        });
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

// Função para remover membro da loja
async function removeMember(userId) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ store_id: null, role: 'client' })
        .eq('id', userId);
    if (error) {
        alert('Erro ao remover membro: ' + error.message);
        return;
    }
    await loadStoreData(state.currentStoreId);
    renderMain();
}
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
            // Atualizar perfil
            const { error } = await supabaseClient
                .from('profiles')
                .update({ store_id: state.currentStoreId, role: 'operator' })
                .eq('id', user.id);
            if (error) {
                errorDiv.textContent = 'Erro ao adicionar operador: ' + error.message;
                return;
            }
            // Fechar modal, limpar campo e recarregar equipa
            closeModal('addOperatorModal');
            emailInput.value = '';
            await loadStoreData(state.currentStoreId);
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