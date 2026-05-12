// ── PAGE LOADER + HERO REVEAL ──
function initPageLoader() {
	const loader    = document.getElementById('pageLoader');
	const heroItems = document.querySelectorAll('.reveal-hero');

	const revealHero = () => heroItems.forEach(el => el.classList.add('vis'));

	if (!loader) {
		revealHero();
		return;
	}

	// Small tick to let the browser paint the loader, then open curtain
	setTimeout(() => {
		loader.classList.add('done');
		// Reveal hero content as curtain finishes (1.15s transition + 0.1s delay = ~1.3s)
		setTimeout(revealHero, 1050);
	}, 120);
}


// ── NAVBAR SCROLL ──
function initNavbar() {
	const nav = document.getElementById('navbar');
	if (!nav) return;
	const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();
}


// ── MOBILE NAV ──
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


// ── REVEAL ON SCROLL ──
function initReveal() {
	const revealItems = document.querySelectorAll('.reveal, .fade-section');

	if (!('IntersectionObserver' in window)) {
		revealItems.forEach(el => el.classList.add('visible'));
		return;
	}

	const observer = new IntersectionObserver((entries, obs) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('visible');
				obs.unobserve(entry.target);
			}
		});
	}, {
		rootMargin: '0px 0px -8% 0px',
		threshold: 0.12
	});

	revealItems.forEach(el => observer.observe(el));
}


// ── DRONE STORY — scroll journey ──
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
			trigger: sticky,
			start:   'top top',
			end:     '+=3400',
			scrub:   1.4,
			pin:     true,
			pinSpacing: true,
			anticipatePin: 1,
			onUpdate(self) {
				const p = self.progress;
				pd1.classList.toggle('on', p > 0.08 && p < 0.58);
				pd2.classList.toggle('on', p >= 0.58);
			}
		}
	});

	tl.to(drone, {
		scale: 1.7,
		filter: 'drop-shadow(0 0 80px rgba(14,165,233,0.65))',
		duration: 3,
		ease: 'power2.inOut'
	});

	tl.to(panel1, { opacity: 1, duration: 1.5, ease: 'power2.out' })
	  .to(drone,  { scale: 1.7, duration: 1.5 }, '<');

	tl.to({}, { duration: 0.8 });

	tl.to(panel1, { opacity: 0, duration: 0.8, ease: 'power2.in' })
	  .to(drone, {
			scale: 0.07,
			filter: 'drop-shadow(0 0 30px rgba(14,165,233,0.2))',
			duration: 2.2,
			ease: 'power2.inOut'
		}, '<0.3');

	tl.to(drone, {
		scale: 2.3,
		filter: 'drop-shadow(0 0 100px rgba(56,189,248,0.75))',
		duration: 2.8,
		ease: 'power2.inOut'
	});

	tl.to(panel2, { opacity: 1, duration: 1.5, ease: 'power2.out' }, '-=0.5')
	  .to({}, { duration: 1.2 });
}


// ── INIT ──
function init() {
	initPageLoader();
	initNavbar();
	initMobileNav();
	initReveal();
	initDroneStory();
}

document.addEventListener('DOMContentLoaded', init);
