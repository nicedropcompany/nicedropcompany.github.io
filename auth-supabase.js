let authState = null;

function setStoredSession(userData) {
    localStorage.setItem('nicedrop_user', JSON.stringify(userData));
}

function clearSession() {
    localStorage.removeItem('nicedrop_user');
}

function showMessage(type, text) {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `auth-message ${type}`;
    el.style.display = 'block';
    if (type === 'error') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.dataset.form === tabName);
    });
    const el = document.getElementById('authMessage');
    if (el) el.style.display = 'none';
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !validateEmail(email)) return showMessage('error', 'Email inválido');
    if (!password) return showMessage('error', 'Introduza a password');

    showMessage('info', 'A entrar...');

    try {
        const { data, error } = await authState.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile, error: profileError } = await authState.supabase
            .from('profiles')
            .select('id, username, avatar, role, store_id')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role === 'client' || profile.role === 'operator') {
            showMessage('error', 'Sem permissão para aceder ao painel.');
            await authState.supabase.auth.signOut();
            return;
        }

        setStoredSession({
            id: profile.id,
            email: data.user.email,
            username: profile.username,
            role: profile.role,
            store_id: profile.store_id,
            avatar: profile.avatar
        });

        showMessage('success', 'Bem-vindo! A redirecionar...');
        setTimeout(() => {
            if (profile.role === 'developer') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Erro login:', error.message);
        showMessage('error', 'Credenciais inválidas.');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    if (!name) return showMessage('error', 'Introduza o seu nome');
    if (!email || !validateEmail(email)) return showMessage('error', 'Email inválido');
    if (password.length < 6) return showMessage('error', 'Password com mínimo 6 caracteres');
    if (password !== confirm) return showMessage('error', 'As passwords não coincidem');

    showMessage('info', 'A criar conta...');

    try {
        const { data, error } = await authState.supabase.auth.signUp({
            email,
            password,
            options: { data: { username: name } }
        });

        if (error) throw error;

        showMessage('success', 'Conta criada! Verifique o seu email para confirmar.');
        document.getElementById('signupForm').reset();
        setTimeout(() => switchTab('login'), 2000);

    } catch (error) {
        console.error('Erro signup:', error.message);
        showMessage('error', error.message || 'Erro ao criar conta.');
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(btn.dataset.tab);
        });
    });

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
}

async function initAuth() {
    try {
        if (!window.supabaseConfig?.isConfigured()) {
            showMessage('error', 'Supabase não configurado.');
            return;
        }

        authState.supabase = window.supabaseConfig.init();

        if (!authState.supabase) {
            showMessage('error', 'Erro ao inicializar Supabase.');
            return;
        }


        setupEventListeners();
        console.log('✅ Auth pronto');

    } catch (error) {
        console.error('Erro initAuth:', error.message);
        showMessage('error', 'Erro ao inicializar autenticação.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    authState = { supabase: null };

    function waitForSupabase(cb) {
        if (window.supabase?.createClient) {
            cb();
        } else {
            setTimeout(() => waitForSupabase(cb), 50);
        }
    }

    waitForSupabase(initAuth);
});