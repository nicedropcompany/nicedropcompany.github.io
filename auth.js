/**
 * NiceDrop Auth (localStorage)
 * Login + Signup numa única UI
 */

const authState = {
    loginForm: document.getElementById('loginForm'),
    signupForm: document.getElementById('signupForm'),
    tabs: document.querySelectorAll('.tab-btn'),
    toggleButtons: document.querySelectorAll('.toggle-btn'),
    messageEl: document.getElementById('authMessage')
};

const defaultUsers = [
    {
        id: 'dev-1',
        name: 'Dev NiceDrop',
        email: 'dev@nicedrop.pt',
        password: 'nicedrop123',
        role: 'developer'
    }
];

function bootstrapUsers() {
    const existing = localStorage.getItem('nd_users');

    if (!existing) {
        saveUsers(defaultUsers);
        return;
    }

    let users = [];
    try {
        users = JSON.parse(existing);
        if (!Array.isArray(users)) {
            users = [];
        }
    } catch {
        users = [];
    }

    const byEmail = new Map(users.map((u, idx) => [String(u.email || '').toLowerCase(), idx]));

    defaultUsers.forEach(seedUser => {
        const key = seedUser.email.toLowerCase();
        const existingIndex = byEmail.get(key);

        if (existingIndex === undefined) {
            users.push(seedUser);
            return;
        }

        // Keep any custom fields but enforce credentials/role for test accounts.
        users[existingIndex] = {
            ...users[existingIndex],
            id: seedUser.id,
            name: seedUser.name,
            email: seedUser.email,
            password: seedUser.password,
            role: seedUser.role
        };
    });

    saveUsers(users);
}

bootstrapUsers();

function getUsers() {
    const users = localStorage.getItem('nd_users');
    if (users) {
        return JSON.parse(users);
    }

    // Primeira execução: cria contas base para testes rápidos.
    saveUsers(defaultUsers);
    return [...defaultUsers];
}

function saveUsers(users) {
    localStorage.setItem('nd_users', JSON.stringify(users));
}

function setSession(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function switchTab(tabName) {
    authState.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.dataset.form === tabName);
    });

    hideMessage();
}

function showMessage(type, text) {
    authState.messageEl.textContent = text;
    authState.messageEl.className = `auth-message ${type}`;
    authState.messageEl.style.display = 'block';
}

function hideMessage() {
    authState.messageEl.style.display = 'none';
    authState.messageEl.textContent = '';
    authState.messageEl.className = 'auth-message';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !password) {
        showMessage('error', 'Preencha todos os campos.');
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('error', 'Introduza um email válido.');
        return;
    }

    if (password.length < 6) {
        showMessage('error', 'A password deve ter pelo menos 6 caracteres.');
        return;
    }

    const users = getUsers();
    const exists = users.find(user => user.email === email);

    if (exists) {
        showMessage('error', 'Este email já está registado.');
        return;
    }

    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role: 'client'
    };

    users.push(newUser);
    saveUsers(users);

    showMessage('success', 'Conta criada com sucesso. A conta cliente nao tem acesso ao dashboard.');
    setTimeout(() => {
        switchTab('login');
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = '';
    }, 900);
}

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('error', 'Introduza email e password.');
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('error', 'Introduza um email válido.');
        return;
    }

    const users = getUsers();
    const user = users.find(item => item.email === email && item.password === password);

    if (!user) {
        showMessage('error', 'Credenciais inválidas.');
        return;
    }

    if (user.role === 'client') {
        showMessage('error', 'Conta cliente nao pode entrar no dashboard.');
        return;
    }

    setSession(user);
    showMessage('success', 'Login efetuado. A redirecionar...');

    const destination = (user.role === 'developer' || user.role === 'admin')
        ? 'admin.html'
        : 'dashboard.html';

    setTimeout(() => {
        window.location.href = destination;
    }, 700);
}

function init() {
    const logged = localStorage.getItem('user');
    if (logged) {
        try {
            const sessionUser = JSON.parse(logged);
            if (sessionUser?.role === 'developer' || sessionUser?.role === 'admin') {
                window.location.href = '/admin.html';
                return;
            }
            if (sessionUser?.role !== 'client') {
                window.location.href = '/dashboard.html';
                return;
            }
        } catch {
            localStorage.removeItem('user');
        }
        return;
    }

    authState.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    authState.toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    authState.loginForm.addEventListener('submit', handleLogin);
    authState.signupForm.addEventListener('submit', handleSignup);
}

document.addEventListener('DOMContentLoaded', init);
