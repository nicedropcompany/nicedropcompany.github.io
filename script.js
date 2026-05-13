// ─── THEME TOGGLE ────────────────────────────────────────────────────────────
(function () {
	const saved = localStorage.getItem('nd-theme');
	if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
})();

function initThemeToggle() {
	const btn = document.getElementById('themeToggle');
	if (!btn) return;
	btn.addEventListener('click', function () {
		const isLight = document.documentElement.getAttribute('data-theme') === 'light';
		document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
		localStorage.setItem('nd-theme', isLight ? 'dark' : 'light');
	});
}


// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
function showToast(msg, type) {
	type = type || 'info';
	let container = document.getElementById('toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'toast-container';
		container.setAttribute('aria-live', 'polite');
		Object.assign(container.style, {
			position: 'fixed', bottom: '24px', right: '24px', zIndex: '9000',
			display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
		});
		document.body.appendChild(container);
	}
	const icons = { success: '✓', error: '✕', warning: '⚠', info: '◈' };
	const toast = document.createElement('div');
	toast.className = 'toast ' + type;
	toast.innerHTML =
		'<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
		'<span class="toast-msg">' + msg + '</span>';
	container.appendChild(toast);
	setTimeout(function () {
		toast.classList.add('out');
		setTimeout(function () { toast.remove(); }, 320);
	}, 3200);
}

window.showToast = showToast;


// ─── NAVBAR SCROLL ────────────────────────────────────────────────────────────
function initIndexNavbar() {
	const nav = document.querySelector('.nav');
	if (!nav) return;
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}


// ─── LEGACY (other pages: download, auth, dashboard, etc.) ───────────────────
function initPageLoader() {
	const loader = document.getElementById('pageLoader');
	const heroItems = document.querySelectorAll('.reveal-hero');
	const revealHero = () => heroItems.forEach(el => el.classList.add('vis'));
	if (!loader) { revealHero(); return; }
	setTimeout(() => {
		loader.classList.add('done');
		setTimeout(revealHero, 1050);
	}, 120);
}

function initNavbar() {
	const nav = document.getElementById('navbar');
	if (!nav) return;
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}

function initMobileNav() {
	const toggle = document.getElementById('navToggle');
	const close = document.getElementById('navClose');
	const links = document.getElementById('navLinks');
	if (!toggle || !links) return;
	toggle.addEventListener('click', () => links.classList.add('open'));
	close?.addEventListener('click', () => links.classList.remove('open'));
	links.querySelectorAll('a').forEach(a =>
		a.addEventListener('click', () => links.classList.remove('open'))
	);
}

function initReveal() {
	const items = document.querySelectorAll('.reveal, .fade-section');
	if (!('IntersectionObserver' in window)) {
		items.forEach(el => el.classList.add('visible'));
		return;
	}
	const obs = new IntersectionObserver((entries, o) => {
		entries.forEach(e => {
			if (e.isIntersecting) { e.target.classList.add('visible'); o.unobserve(e.target); }
		});
	}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
	items.forEach(el => obs.observe(el));
}

function initDroneStory() {
	const sticky = document.getElementById('dsSticky');
	if (!sticky || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
	const drone = document.getElementById('dsDrone');
	const panel1 = document.getElementById('dsPanel1');
	const panel2 = document.getElementById('dsPanel2');
	const pd1 = document.getElementById('dsPd1');
	const pd2 = document.getElementById('dsPd2');
	gsap.registerPlugin(ScrollTrigger);
	gsap.set(drone, { scale: 0.07 });
	gsap.set([panel1, panel2], { opacity: 0 });
	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: sticky, start: 'top top', end: '+=3400',
			scrub: 1.4, pin: true, pinSpacing: true, anticipatePin: 1,
			onUpdate(self) {
				const p = self.progress;
				pd1.classList.toggle('on', p > 0.08 && p < 0.58);
				pd2.classList.toggle('on', p >= 0.58);
			}
		}
	});
	tl.to(drone, { scale: 1.7, filter: 'drop-shadow(0 0 80px rgba(14,165,233,0.65))', duration: 3, ease: 'power2.inOut' });
	tl.to(panel1, { opacity: 1, duration: 1.5, ease: 'power2.out' }).to(drone, { scale: 1.7, duration: 1.5 }, '<');
	tl.to({}, { duration: 0.8 });
	tl.to(panel1, { opacity: 0, duration: 0.8, ease: 'power2.in' }).to(drone, { scale: 0.07, filter: 'drop-shadow(0 0 30px rgba(14,165,233,0.2))', duration: 2.2, ease: 'power2.inOut' }, '<0.3');
	tl.to(drone, { scale: 2.3, filter: 'drop-shadow(0 0 100px rgba(56,189,248,0.75))', duration: 2.8, ease: 'power2.inOut' });
	tl.to(panel2, { opacity: 1, duration: 1.5, ease: 'power2.out' }, '-=0.5').to({}, { duration: 1.2 });
}


// ─── LOADER ───────────────────────────────────────────────────────────────────
function initLoader() {
	const loader = document.getElementById('loader');
	if (!loader) return;
	setTimeout(function () {
		loader.classList.add('done');
		setTimeout(function () { loader.style.display = 'none'; }, 950);
	}, 200);
}


// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
	initThemeToggle();
	initLoader();
	initMobileNav();
	initReveal();
	initPageLoader();
	initNavbar();
	initIndexNavbar();
	initDroneStory();
}

document.addEventListener('DOMContentLoaded', init);
