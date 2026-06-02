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
        const isActive = form.dataset.form === tabName;
        form.style.display = isActive ? 'block' : 'none';
        form.classList.toggle('active', isActive);
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

    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);
    showMessage('info', 'A entrar...');
    try {
        const supabase = window.supabaseConfig.getClient();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, role, store_id')
            .eq('id', data.user.id)
            .single();

        // Auto-create profile on first login if missing
        if (profileError || !profile) {
            const username = data.user.user_metadata?.username || email.split('@')[0];
            const { data: newProfile, error: upsertErr } = await supabase
                .from('profiles')
                .upsert({ id: data.user.id, username, role: 'client' }, { onConflict: 'id' })
                .select('id, username, role, store_id')
                .single();
            if (upsertErr) throw new Error('Erro ao criar perfil');
            profile = newProfile;
        }

        const role = (profile?.role || '').trim().toLowerCase();
        setStoredSession({ id: profile.id, email: data.user.email, username: profile.username, role: profile.role, store_id: profile.store_id });
        showMessage('success', 'Bem-vindo! A redirecionar...');
        if (role === 'owner') {
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
            return;
        }
        if (role === 'developer') {
            setTimeout(() => { window.location.href = '/admin.html'; }, 1500);
            return;
        }
        setTimeout(() => { window.location.href = '/client.html'; }, 1500);
    } catch (error) {
        showMessage('error', 'Credenciais inválidas.');
        setButtonLoading(btn, false);
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

    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);
    showMessage('info', 'A criar conta...');
    try {
        const supabase = window.supabaseConfig.getClient();
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { username: name } }
        });
        if (error) throw error;

        if (data.user) {
            await supabase
                .from('profiles')
                .upsert({ id: data.user.id, username: name, role: 'client' }, { onConflict: 'id' });
        }

        showMessage('success', 'Conta criada! Verifica o teu email para activar o acesso.');
        document.getElementById('signupForm').reset();
        setButtonLoading(btn, false);
        setTimeout(() => switchTab('login'), 3500);
    } catch (error) {
        showMessage('error', error.message || 'Erro ao criar conta.');
        setButtonLoading(btn, false);
    }
}

async function handleGoogleAuth() {
    try {
        const supabase = window.supabaseConfig.getClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/auth.html' }
        });
        if (error) throw error;
    } catch (err) {
        showMessage('error', 'Erro ao entrar com Google.');
    }
}

async function handleOAuthReturn() {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (!hash.includes('access_token') && !params.has('code') && !params.has('token_hash')) return;

    showMessage('info', 'A verificar conta Google...');

    const supabase = window.supabaseConfig.getClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { showMessage('error', 'Erro na autenticação Google.'); return; }

    const user = session.user;
    let { data: profile } = await supabase
        .from('profiles')
        .select('id, username, role, store_id')
        .eq('id', user.id)
        .single();

    if (!profile) {
        const username = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
        const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({ id: user.id, username, role: 'client' }, { onConflict: 'id' })
            .select('id, username, role, store_id')
            .single();
        profile = newProfile;
    }

    if (!profile) { showMessage('error', 'Erro ao criar perfil.'); return; }

    const role = (profile.role || '').trim().toLowerCase();
    setStoredSession({ id: profile.id, email: user.email, username: profile.username, role: profile.role, store_id: profile.store_id });
    showMessage('success', 'Bem-vindo! A redirecionar...');

    if (role === 'developer') { setTimeout(() => { window.location.href = '/admin.html'; }, 1000); return; }
    if (role === 'owner') { setTimeout(() => { window.location.href = '/dashboard.html'; }, 1000); return; }
    setTimeout(() => { window.location.href = '/client.html'; }, 1000);
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

function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

document.addEventListener('DOMContentLoaded', function () {
    waitForSupabase(() => {
        window.supabaseConfig.init();
        setupEventListeners();
        handleOAuthReturn();
        console.log('✅ Auth pronto');
    });
});
