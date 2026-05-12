// ─── THEME TOGGLE ─────────────────────────────────────────────────────────

(function(){
	const saved = localStorage.getItem('nd-theme');
	if(saved === 'light') document.documentElement.setAttribute('data-theme','light');
})();

function initThemeToggle() {
	const btn = document.getElementById('themeToggle');
	if (!btn) return;
	btn.addEventListener('click', function(){
		const isLight = document.documentElement.getAttribute('data-theme') === 'light';
		const next = isLight ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('nd-theme', next);
	});
}


// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────

function showToast(msg, type) {
	type = type || 'info';
	let container = document.getElementById('toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'toast-container';
		container.setAttribute('aria-live', 'polite');
		Object.assign(container.style, {
			position:'fixed', bottom:'24px', right:'24px', zIndex:'9000',
			display:'flex', flexDirection:'column', gap:'10px', pointerEvents:'none'
		});
		document.body.appendChild(container);
	}
	const icons = { success:'✓', error:'✕', warning:'⚠', info:'◈' };
	const toast = document.createElement('div');
	toast.className = 'toast ' + type;
	toast.innerHTML =
		'<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
		'<span class="toast-msg">' + msg + '</span>';
	container.appendChild(toast);
	setTimeout(function(){
		toast.classList.add('out');
		setTimeout(function(){ toast.remove(); }, 320);
	}, 3200);
}

// expose globally so auth-supabase.js / dashboard.js can call it
window.showToast = showToast;


// ─── NAVBAR SCROLL (index.html uses .nav not .navbar) ─────────────────────

function initIndexNavbar() {
	const nav = document.querySelector('.nav');
	if (!nav) return;
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}


// ─── LEGACY FUNCTIONS (backward compat for download.html) ─────────────────

function initPageLoader() {
	const loader    = document.getElementById('pageLoader');
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
	const close  = document.getElementById('navClose');
	const links  = document.getElementById('navLinks');
	if (!toggle || !links) return;
	toggle.addEventListener('click', () => links.classList.add('open'));
	close?.addEventListener('click',  () => links.classList.remove('open'));
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
	if (!sticky || typeof ScrollTrigger === 'undefined') return;
	const drone  = document.getElementById('dsDrone');
	const panel1 = document.getElementById('dsPanel1');
	const panel2 = document.getElementById('dsPanel2');
	const pd1    = document.getElementById('dsPd1');
	const pd2    = document.getElementById('dsPd2');
	gsap.registerPlugin(ScrollTrigger);
	gsap.set(drone,  { scale: 0.07 });
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


// ─── NEW INDEX ANIMATIONS ──────────────────────────────────────────────────

function animateHero() {
	if (!document.querySelector('.s-hero')) return;

	// Eyebrow
	gsap.fromTo('.hero-eyebrow',
		{ y: -18, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.7, ease: 'back.out(2)' }
	);

	// Title words fly up with spring + blur clearing
	gsap.fromTo(['.hn', '.hd'],
		{ y: '110%', opacity: 0, filter: 'blur(16px)' },
		{
			y: 0, opacity: 1, filter: 'blur(0px)',
			duration: 1.05, ease: 'back.out(1.9)',
			stagger: 0.2, delay: 0.18
		}
	);

	// Description
	gsap.fromTo('.hero-desc',
		{ y: 28, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', delay: 0.65 }
	);

	// Buttons
	gsap.fromTo('.hero-actions',
		{ y: 20, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.65, ease: 'power3.out', delay: 0.85 }
	);

	// Scroll hint
	gsap.fromTo('.hero-scroll-hint',
		{ opacity: 0 },
		{ opacity: 1, duration: 0.8, delay: 1.3 }
	);
}

function initNewIndex() {
	if (!document.querySelector('.s-hero')) return;
	if (typeof gsap === 'undefined') return;

	gsap.registerPlugin(ScrollTrigger);

	// ── LOADER: split panels fly apart
	const ldTop = document.querySelector('.ld-top');
	const ldBot = document.querySelector('.ld-bot');

	if (ldTop && ldBot) {
		window.addEventListener('load', () => {
			gsap.timeline({ onComplete: animateHero })
				.to(ldTop, { yPercent: -100, duration: 1.0, ease: 'expo.inOut', delay: 0.25 })
				.to(ldBot, { yPercent: 100, duration: 1.0, ease: 'expo.inOut' }, '<')
				.set('#loader', { display: 'none' });
		});
	} else {
		window.addEventListener('load', animateHero);
	}

	// ── STATS: stagger + count-up
	gsap.from('.stat', {
		scrollTrigger: { trigger: '.s-stats', start: 'top 82%' },
		y: 55, opacity: 0, stagger: 0.13, duration: 0.85, ease: 'back.out(1.5)'
	});

	document.querySelectorAll('.stat-n').forEach(el => {
		const target = parseInt(el.dataset.to);
		ScrollTrigger.create({
			trigger: el, start: 'top 82%', once: true,
			onEnter: () => {
				gsap.to({ val: 0 }, {
					val: target, duration: 1.6, ease: 'power2.out',
					onUpdate: function () { el.textContent = Math.floor(this.targets()[0].val); }
				});
			}
		});
	});

	// ── ABOUT: tag slides in, title wipes, body fades
	gsap.from('.s-about .s-tag', {
		scrollTrigger: { trigger: '.s-about', start: 'top 78%' },
		x: -35, opacity: 0, duration: 0.65, ease: 'power3.out'
	});
	gsap.fromTo('.s-about .s-title',
		{ clipPath: 'inset(0 100% 0 0)', opacity: 0 },
		{
			clipPath: 'inset(0 0% 0 0)', opacity: 1,
			scrollTrigger: { trigger: '.s-about', start: 'top 74%' },
			duration: 1.1, ease: 'power3.inOut', delay: 0.12
		}
	);
	gsap.from('.s-about .s-body', {
		scrollTrigger: { trigger: '.s-about', start: 'top 70%' },
		y: 32, opacity: 0, duration: 0.75, ease: 'power2.out', delay: 0.35
	});

	// ── FEATURES: tag slides, title wipes, cards 3D stagger
	gsap.from('.s-feat .s-tag', {
		scrollTrigger: { trigger: '.s-feat', start: 'top 78%' },
		x: 35, opacity: 0, duration: 0.65, ease: 'power3.out'
	});
	gsap.fromTo('.s-feat .s-title',
		{ clipPath: 'inset(0 100% 0 0)', opacity: 0 },
		{
			clipPath: 'inset(0 0% 0 0)', opacity: 1,
			scrollTrigger: { trigger: '.s-feat', start: 'top 74%' },
			duration: 1.1, ease: 'power3.inOut', delay: 0.12
		}
	);
	gsap.from('.feat-card', {
		scrollTrigger: { trigger: '.feat-grid', start: 'top 82%' },
		y: 75, rotateX: 14, opacity: 0, transformPerspective: 900,
		stagger: 0.16, duration: 0.95, ease: 'back.out(1.7)',
		clearProps: 'rotateX,transformPerspective'
	});

	// ── CTA: scale punch + stagger
	gsap.from('.cta-title', {
		scrollTrigger: { trigger: '.s-cta', start: 'top 78%' },
		scale: 0.78, opacity: 0, duration: 0.95, ease: 'back.out(2.0)'
	});
	gsap.from(['.cta-sub', '.s-cta .btn-sq'], {
		scrollTrigger: { trigger: '.s-cta', start: 'top 72%' },
		y: 28, opacity: 0, stagger: 0.18, duration: 0.7, ease: 'power2.out', delay: 0.25
	});

	// ── PARALLAX: hero content drifts up as you scroll
	gsap.to('.hero-inner', {
		scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: 1.2 },
		y: -110, ease: 'none'
	});
}


// ─── INIT ──────────────────────────────────────────────────────────────────

function init() {
	initThemeToggle();
	initPageLoader();
	initIndexNavbar();
	initNavbar();
	initMobileNav();
	initReveal();
	initDroneStory();
	initNewIndex();
}

document.addEventListener('DOMContentLoaded', init);
