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


// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function initIndexNavbar() {
	const nav = document.querySelector('.nav');
	if (!nav) return;
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}


// ─── LEGACY FUNCTIONS (other pages: download, auth, dashboard, etc.) ──────────
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
	if (!nav || nav.classList.contains('nav')) return; // skip index.html (handled by initIndexNavbar)
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
	if (!sticky || typeof ScrollTrigger === 'undefined') return;
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


// ─── PARTICLE CANVAS ──────────────────────────────────────────────────────────
function initParticles() {
	const canvas = document.getElementById('heroCanvas');
	if (!canvas) return;

	const ctx = canvas.getContext('2d');
	const R = [0, 212, 255];
	const COUNT = 55;
	const LINK_DIST = 130;
	let W, H, particles = [];

	function resize() {
		W = canvas.width = canvas.offsetWidth;
		H = canvas.height = canvas.offsetHeight;
	}

	function Particle() {
		this.reset(true);
	}

	Particle.prototype.reset = function (init) {
		this.x = Math.random() * W;
		this.y = init ? Math.random() * H : (Math.random() < 0.5 ? -8 : H + 8);
		this.r = Math.random() * 1.6 + 0.5;
		this.vx = (Math.random() - 0.5) * 0.38;
		this.vy = (Math.random() - 0.5) * 0.38;
		this.alpha = Math.random() * 0.45 + 0.18;
		this.life = Math.random() * 220 + 80;
		this.age = 0;
	};

	Particle.prototype.update = function () {
		this.x += this.vx;
		this.y += this.vy;
		this.age++;
		if (this.age > this.life || this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
			this.reset(false);
		}
	};

	Particle.prototype.draw = function () {
		const fade = Math.sin((this.age / this.life) * Math.PI);
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(' + R[0] + ',' + R[1] + ',' + R[2] + ',' + (this.alpha * fade) + ')';
		ctx.fill();
	};

	function drawLinks() {
		for (let i = 0; i < particles.length; i++) {
			for (let j = i + 1; j < particles.length; j++) {
				const dx = particles[i].x - particles[j].x;
				const dy = particles[i].y - particles[j].y;
				const d = Math.sqrt(dx * dx + dy * dy);
				if (d < LINK_DIST) {
					const a = (1 - d / LINK_DIST) * 0.14;
					ctx.beginPath();
					ctx.moveTo(particles[i].x, particles[i].y);
					ctx.lineTo(particles[j].x, particles[j].y);
					ctx.strokeStyle = 'rgba(' + R[0] + ',' + R[1] + ',' + R[2] + ',' + a + ')';
					ctx.lineWidth = 0.6;
					ctx.stroke();
				}
			}
		}
	}

	function loop() {
		ctx.clearRect(0, 0, W, H);
		particles.forEach(p => { p.update(); p.draw(); });
		drawLinks();
		requestAnimationFrame(loop);
	}

	resize();
	for (let i = 0; i < COUNT; i++) particles.push(new Particle());
	loop();

	const ro = new ResizeObserver(resize);
	ro.observe(canvas.parentElement || document.body);
}


// ─── HERO ENTRY ANIMATIONS ────────────────────────────────────────────────────
function animateHero() {
	if (!document.querySelector('.s-hero')) return;

	gsap.fromTo('.hero-eyebrow',
		{ y: -22, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.85, ease: 'back.out(2.2)' }
	);

	gsap.fromTo(['.hn', '.hd'],
		{ y: '110%', opacity: 0, filter: 'blur(18px)' },
		{ y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'back.out(1.9)', stagger: 0.22, delay: 0.22 }
	);

	gsap.fromTo('.hero-desc',
		{ y: 30, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.68 }
	);

	gsap.fromTo('.hero-actions',
		{ y: 20, opacity: 0 },
		{ y: 0, opacity: 1, duration: 0.72, ease: 'power3.out', delay: 0.88 }
	);

	gsap.fromTo('#heroScrollHint',
		{ opacity: 0 },
		{ opacity: 1, duration: 1.0, delay: 1.45 }
	);

	gsap.fromTo('#heroDrone',
		{ x: 50, opacity: 0 },
		{ x: 0, opacity: 0.18, duration: 1.3, ease: 'power2.out', delay: 0.55 }
	);
}


// ─── DRONE JOURNEY (scroll-pinned storytelling) ───────────────────────────────
function initDroneJourney() {
	const journey = document.getElementById('droneJourney');
	const sticky = document.getElementById('djSticky');
	if (!sticky || !journey || typeof gsap === 'undefined') return;

	const drone = document.getElementById('djDrone');
	const panel1 = document.getElementById('djPanel1');
	const panel2 = document.getElementById('djPanel2');
	const panel3 = document.getElementById('djPanel3');
	const progressFill = document.getElementById('djProgressFill');
	const glow = document.getElementById('djGlow');
	const step1 = document.getElementById('djStep1');
	const step2 = document.getElementById('djStep2');
	const step3 = document.getElementById('djStep3');

	// start: drone is invisible and tiny, centered via xPercent/yPercent
	gsap.set(drone, {
		xPercent: -50, yPercent: -50,
		scale: 0.055, opacity: 0,
		filter: 'drop-shadow(0 0 10px rgba(0,212,255,0.2))'
	});
	gsap.set([panel1, panel2, panel3], { opacity: 0 });

	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: journey,
			start: 'top top',
			end: '+=3600',
			scrub: 1.8,
			pin: sticky,
			pinSpacing: true,
			anticipatePin: 1,
			onUpdate(self) {
				const p = self.progress;

				// progress bar
				if (progressFill) progressFill.style.width = (p * 100) + '%';

				// step dots
				const inP1 = p > 0.05 && p < 0.38;
				const inP2 = p >= 0.36 && p < 0.68;
				const inP3 = p >= 0.66;
				if (step1) step1.classList.toggle('active', inP1);
				if (step2) step2.classList.toggle('active', inP2);
				if (step3) step3.classList.toggle('active', inP3);

				// ambient glow brightens as drone zooms closer
				if (glow) {
					const intensity = 0.07 + (p * p) * 0.25;
					const radius = 50 + p * 30;
					glow.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,212,255,' + intensity + ') 0%, transparent ' + radius + '%)';
				}
			}
		}
	});

	// phase 0 → 0.12: drone materialises
	tl.to(drone, { opacity: 0.6, scale: 0.06, duration: 0.5 })
	// phase 0.12 → 0.38: drone flies in and grows to full size
	  .to(drone, {
		scale: 1.05, opacity: 1,
		filter: 'drop-shadow(0 0 70px rgba(0,212,255,0.75))',
		duration: 3, ease: 'power2.inOut'
	})
	// panel 1 fades in while drone holds
	  .to(panel1, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '-=1.2')
	  .to({}, { duration: 1.5 })

	// phase ~0.40: panel 1 out + drone shifts to left half
	  .to(panel1, { opacity: 0, duration: 0.8, ease: 'power2.in' })
	  .to(drone, { x: '-16vw', scale: 0.72, filter: 'drop-shadow(0 0 35px rgba(0,212,255,0.4))', duration: 2, ease: 'power3.inOut' }, '-=0.4')

	// panel 2 fades in (right side)
	  .to(panel2, { opacity: 1, duration: 1.2, ease: 'power2.out' }, '-=0.8')
	  .to({}, { duration: 1.5 })

	// panel 2 out + drone returns center and erupts
	  .to(panel2, { opacity: 0, duration: 0.8, ease: 'power2.in' })
	  .to(drone, {
		x: 0, scale: 2.6,
		filter: 'drop-shadow(0 0 130px rgba(0,212,255,1))',
		duration: 2.8, ease: 'power2.inOut'
	}, '-=0.4')

	// panel 3 fades in over the huge drone
	  .to(panel3, { opacity: 1, duration: 1.2, ease: 'power2.out' }, '-=1.4')
	  .to({}, { duration: 2 });
}


// ─── SCROLL-TRIGGERED ANIMATIONS ─────────────────────────────────────────────
function initScrollAnimations() {
	if (typeof gsap === 'undefined' || !document.querySelector('.s-hero')) return;
	gsap.registerPlugin(ScrollTrigger);

	// ── SKY PARALLAX: sky moves at ~35% of scroll speed (parallax depth)
	gsap.to('#heroSky', {
		scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: 1 },
		y: '30%', ease: 'none'
	});

	// ── HERO INNER: content drifts upward
	gsap.to('#heroInner', {
		scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: 1.3 },
		y: -120, ease: 'none'
	});

	// ── DRONE: parallax + slight outward drift
	gsap.to('#heroDrone', {
		scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: 1.6 },
		y: -90, x: 45, ease: 'none'
	});

	// ── STATS: stagger + count-up
	gsap.from('.stat', {
		scrollTrigger: { trigger: '.s-stats', start: 'top 82%' },
		y: 55, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'back.out(1.6)'
	});

	document.querySelectorAll('.stat-n').forEach(el => {
		const target = parseInt(el.dataset.to);
		ScrollTrigger.create({
			trigger: el, start: 'top 84%', once: true,
			onEnter: () => {
				gsap.to({ val: 0 }, {
					val: target, duration: 1.9, ease: 'power2.out',
					onUpdate: function () { el.textContent = Math.floor(this.targets()[0].val); }
				});
			}
		});
	});

	// ── ABOUT
	gsap.from('.s-about .s-tag', {
		scrollTrigger: { trigger: '.s-about', start: 'top 78%' },
		x: -36, opacity: 0, duration: 0.7, ease: 'power3.out'
	});

	gsap.fromTo('.s-about .s-title',
		{ clipPath: 'inset(0 100% 0 0)', opacity: 0 },
		{
			clipPath: 'inset(0 0% 0 0)', opacity: 1,
			scrollTrigger: { trigger: '.s-about', start: 'top 74%' },
			duration: 1.2, ease: 'power3.inOut', delay: 0.1
		}
	);

	gsap.from('.s-about .s-body', {
		scrollTrigger: { trigger: '.s-about', start: 'top 70%' },
		y: 34, opacity: 0, duration: 0.8, ease: 'power2.out', delay: 0.32
	});

	// ── FEATURES
	gsap.from('.s-feat .s-tag', {
		scrollTrigger: { trigger: '.s-feat', start: 'top 78%' },
		x: 36, opacity: 0, duration: 0.7, ease: 'power3.out'
	});

	gsap.fromTo('.s-feat .s-title',
		{ clipPath: 'inset(0 100% 0 0)', opacity: 0 },
		{
			clipPath: 'inset(0 0% 0 0)', opacity: 1,
			scrollTrigger: { trigger: '.s-feat', start: 'top 74%' },
			duration: 1.2, ease: 'power3.inOut', delay: 0.1
		}
	);

	gsap.from('.feat-card', {
		scrollTrigger: { trigger: '.feat-grid', start: 'top 82%' },
		y: 80, rotateX: 14, opacity: 0, transformPerspective: 900,
		stagger: 0.17, duration: 1.0, ease: 'back.out(1.7)',
		clearProps: 'rotateX,transformPerspective'
	});

	// ── CTA
	gsap.from('.cta-title', {
		scrollTrigger: { trigger: '.s-cta', start: 'top 78%' },
		scale: 0.76, opacity: 0, duration: 1.0, ease: 'back.out(2.2)'
	});

	gsap.from(['.cta-sub', '.s-cta .btn-sq'], {
		scrollTrigger: { trigger: '.s-cta', start: 'top 72%' },
		y: 28, opacity: 0, stagger: 0.18, duration: 0.75, ease: 'power2.out', delay: 0.28
	});
}


// ─── LOADER → HERO BOOT ───────────────────────────────────────────────────────
function initLoader() {
	const ldTop = document.querySelector('.ld-top');
	const ldBot = document.querySelector('.ld-bot');
	if (!ldTop || !ldBot) {
		animateHero();
		return;
	}

	// ensure GSAP is ready before animating
	const go = () => {
		gsap.timeline({ onComplete: animateHero })
			.to(ldTop, { yPercent: -100, duration: 1.05, ease: 'expo.inOut', delay: 0.35 })
			.to(ldBot, { yPercent: 100, duration: 1.05, ease: 'expo.inOut' }, '<')
			.set('#loader', { display: 'none' });
	};

	if (document.readyState === 'complete') {
		go();
	} else {
		window.addEventListener('load', go);
	}
}


// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
	initThemeToggle();
	initMobileNav();
	initReveal();

	const isIndex = !!document.querySelector('.s-hero');

	if (isIndex) {
		initIndexNavbar();

		if (typeof gsap !== 'undefined') {
			gsap.registerPlugin(ScrollTrigger);
			initLoader();
			initParticles();
			initDroneJourney();
			initScrollAnimations();
		} else {
			animateHero();
		}
	} else {
		// other pages
		initPageLoader();
		initNavbar();
		initDroneStory();
	}
}

document.addEventListener('DOMContentLoaded', init);
