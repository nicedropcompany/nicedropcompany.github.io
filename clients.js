function waitForSupabase(cb) {
    if (window.supabase?.createClient) {
        cb();
    } else {
        setTimeout(() => waitForSupabase(cb), 50);
    }
}
/**
 * NiceDrop Clients Management
 * Gerenciamento de clientes
 */

// ============================================
// AUTHENTICATION CHECK
// ============================================

function getStoredSession() {

    const rawUser = localStorage.getItem('nicedrop_user');
    if (rawUser) return rawUser;

    return null;
}

function clearSession() {
    localStorage.removeItem('user');
    localStorage.removeItem('nicedrop_user');
}

function checkAuth() {
    const user = getStoredSession();
    
    if (!user) {
        console.log('⚠️  User not authenticated, redirecting to auth...');
        if (!window.location.pathname.endsWith('auth.html')) {
            window.location.href = '/auth.html';
        }
        return false;
    }

    const parsedUser = JSON.parse(user);

    // Check if user is owner (store owner)
    if (parsedUser.role !== 'owner') {
        console.log('⚠️  User is not a store owner, access denied.');
        alert('Apenas proprietários de lojas podem aceder a esta página');
        clearSession();
        window.location.href = '/index.html';
        return false;
    }

    return parsedUser;
}

const currentUser = checkAuth();

// ============================================
// MOCK DATA
// ============================================

const mockStores = [
    { id: 1, name: 'Porto Central' },
    { id: 2, name: 'Lisbon Hub' },
    { id: 3, name: 'Covilhã Station' }
];

// Mock clients data
let mockClients = [
    {
        id: 1,
        name: 'João Silva',
        email: 'joao@example.com',
        phone: '+351 912345678',
        storeId: 1,
        orders: 12,
        status: 'active',
        registryDate: '2025-01-15'
    },
    {
        id: 2,
        name: 'Maria Santos',
        email: 'maria@example.com',
        phone: '+351 923456789',
        storeId: 1,
        orders: 8,
        status: 'active',
        registryDate: '2025-02-20'
    },
    {
        id: 3,
        name: 'Carlos Oliveira',
        email: 'carlos@example.com',
        phone: '+351 934567890',
        storeId: 2,
        orders: 15,
        status: 'active',
        registryDate: '2025-01-05'
    },
    {
        id: 4,
        name: 'Ana Pereira',
        email: 'ana@example.com',
        phone: '+351 945678901',
        storeId: 2,
        orders: 3,
        status: 'inactive',
        registryDate: '2024-12-10'
    },
    {
        id: 5,
        name: 'Pedro Ferreira',
        email: 'pedro@example.com',
        phone: '+351 956789012',
        storeId: 3,
        orders: 22,
        status: 'active',
        registryDate: '2024-11-01'
    }
];

// ============================================
// STATE
// ============================================

let currentStoreId = mockStores[0].id;
let editingClientId = null;

// ============================================
// DOM ELEMENTS
// ============================================

const storesList = document.querySelector('.stores-list');
const clientsTableBody = document.getElementById('clientsTableBody');
const clientModal = document.getElementById('clientModal');
const detailsModal = document.getElementById('detailsModal');
const btnAddClient = document.getElementById('btnAddClient');
const logoutBtn = document.querySelector('.btn-logout');
const userEmail = document.getElementById('userEmail');

// Modal input fields
const clientName = document.getElementById('clientName');
const clientEmail = document.getElementById('clientEmail');
const clientPhone = document.getElementById('clientPhone');
const clientStore = document.getElementById('clientStore');
const clientStatus = document.getElementById('clientStatus');

// ============================================
// INITIALIZATION
// ============================================

function init() {
    waitForSupabase(() => {
        window.supabaseConfig.init();
        userEmail.textContent = currentUser.email;
        
        // Render stores
        renderStores();
        
        // Populate store dropdown
        populateStoreDropdown();
        
        // Load and render clients
        loadClients();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('✅ Clients page initialized');
    });
}

// ============================================
// STORES
// ============================================

function renderStores() {
    storesList.innerHTML = mockStores.map(store => `
        <div class="store-item ${store.id === currentStoreId ? 'active' : ''}" data-store-id="${store.id}">
            ${store.name}
        </div>
    `).join('');

    document.querySelectorAll('.store-item').forEach(item => {
        item.addEventListener('click', () => {
            currentStoreId = parseInt(item.dataset.storeId);
            renderStores();
            loadClients();
        });
    });
}

function populateStoreDropdown() {
    clientStore.innerHTML = mockStores.map(store => `
        <option value="${store.id}">${store.name}</option>
    `).join('');
}

// ============================================
// CLIENTS TABLE
// ============================================

function loadClients() {
    const filteredClients = mockClients.filter(c => c.storeId === currentStoreId);
    
    if (filteredClients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">Nenhum cliente nesta loja</td></tr>';
        return;
    }

    clientsTableBody.innerHTML = filteredClients.map(client => `
        <tr>
            <td>${client.name}</td>
            <td>${client.email}</td>
            <td>${client.phone}</td>
            <td>${getStoreName(client.storeId)}</td>
            <td>${client.orders}</td>
            <td><span class="status-badge status-${client.status}">${client.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
            <td>${formatDate(client.registryDate)}</td>
            <td>
                <div class="actions">
                    <button class="btn-action btn-view" onclick="viewClient(${client.id})">Ver</button>
                    <button class="btn-action btn-edit" onclick="editClient(${client.id})">Editar</button>
                    <button class="btn-action btn-remove" onclick="removeClient(${client.id})">Remover</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getStoreName(storeId) {
    const store = mockStores.find(s => s.id === storeId);
    return store ? store.name : '-';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT');
}

// ============================================
// CLIENT ACTIONS
// ============================================

function viewClient(clientId) {
    const client = mockClients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('detailsTitle').textContent = `Detalhes - ${client.name}`;
    document.getElementById('detailName').textContent = client.name;
    document.getElementById('detailEmail').textContent = client.email;
    document.getElementById('detailPhone').textContent = client.phone;
    document.getElementById('detailStore').textContent = getStoreName(client.storeId);
    document.getElementById('detailOrders').textContent = client.orders;
    document.getElementById('detailStatus').textContent = client.status === 'active' ? 'Ativo' : 'Inativo';
    document.getElementById('detailDate').textContent = formatDate(client.registryDate);

    detailsModal.classList.add('active');
}

function closeDetailsModal() {
    detailsModal.classList.remove('active');
}

function editClient(clientId) {
    const client = mockClients.find(c => c.id === clientId);
    if (!client) return;

    editingClientId = clientId;
    document.getElementById('modalTitle').textContent = 'Editar Cliente';
    clientName.value = client.name;
    clientEmail.value = client.email;
    clientPhone.value = client.phone;
    clientStore.value = client.storeId;
    clientStatus.value = client.status;

    clientModal.classList.add('active');
}

function removeClient(clientId) {
    if (!confirm('Tem certeza que deseja remover este cliente?')) return;

    mockClients = mockClients.filter(c => c.id !== clientId);
    loadClients();
    console.log(`✅ Cliente removido: ${clientId}`);
}

function saveClient() {
    const name = clientName.value.trim();
    const email = clientEmail.value.trim();
    const phone = clientPhone.value.trim();
    const storeId = parseInt(clientStore.value);
    const status = clientStatus.value;

    if (!name || !email || !phone) {
        alert('Por favor, preencha todos os campos');
        return;
    }

    if (editingClientId) {
        // Update existing client
        const client = mockClients.find(c => c.id === editingClientId);
        if (client) {
            client.name = name;
            client.email = email;
            client.phone = phone;
            client.storeId = storeId;
            client.status = status;
            console.log(`✅ Cliente atualizado: ${client.name}`);
        }
        editingClientId = null;
    } else {
        // Add new client
        const newClient = {
            id: Math.max(...mockClients.map(c => c.id), 0) + 1,
            name,
            email,
            phone,
            storeId,
            orders: 0,
            status,
            registryDate: new Date().toISOString().split('T')[0]
        };
        mockClients.push(newClient);
        console.log(`✅ Cliente adicionado: ${newClient.name}`);
    }

    closeClientModal();
    loadClients();
}

// ============================================
// MODALS
// ============================================

function openAddClientModal() {
    editingClientId = null;
    document.getElementById('modalTitle').textContent = 'Adicionar Cliente';
    clientName.value = '';
    clientEmail.value = '';
    clientPhone.value = '';
    clientStore.value = currentStoreId;
    clientStatus.value = 'active';
    clientModal.classList.add('active');
}

function closeClientModal() {
    clientModal.classList.remove('active');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    btnAddClient.addEventListener('click', openAddClientModal);
    logoutBtn.addEventListener('click', logoutUser);
}

function logoutUser() {
    if (confirm('Tem certeza que deseja sair?')) {
        clearSession();
        window.location.href = '/index.html';
    }
}

// ============================================
// START APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', init);
