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
        if (role === 'client' || role === 'operator') {
            showMessage('error', 'Sem acesso ao painel web. Use a app móvel.');
            await supabase.auth.signOut();
            return;
        }
        if (role === 'owner') {
            setStoredSession({ id: profile.id, email: data.user.email, username: profile.username, role: profile.role, store_id: profile.store_id });
            showMessage('success', 'Bem-vindo! A redirecionar...');
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
            return;
        }
        if (role === 'developer') {
            setStoredSession({ id: profile.id, email: data.user.email, username: profile.username, role: profile.role, store_id: profile.store_id });
            showMessage('success', 'Bem-vindo! A redirecionar...');
            setTimeout(() => { window.location.href = '/admin.html'; }, 1500);
            return;
        }
        showMessage('error', 'Sem acesso ao painel web. Use a app móvel.');
        await supabase.auth.signOut();
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
        const supabase = window.supabaseConfig.getClient();
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { username: name } }
        });
        if (error) throw error;

        // Insert into profiles immediately — works when email confirmation is disabled in Supabase Auth settings
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({ id: data.user.id, username: name, role: 'client' }, { onConflict: 'id' });
            if (profileError) {
                // Falls back to upsert on first login; for a guaranteed fix add a DB trigger in Supabase
                console.warn('Profile insert on signup:', profileError.message);
            }
        }

        showMessage('success', 'Conta criada com sucesso!');
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

function waitForSupabase(cb) {
    if (window.supabase?.createClient) { cb(); }
    else { setTimeout(() => waitForSupabase(cb), 50); }
}

document.addEventListener('DOMContentLoaded', function () {
    waitForSupabase(() => {
        window.supabaseConfig.init();
        setupEventListeners();
        console.log('✅ Auth pronto');
    });
});
