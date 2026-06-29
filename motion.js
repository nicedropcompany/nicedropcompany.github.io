/* NiceDrop — motion engine (GSAP + Lenis) partilhado por index.html e download.html */
(function () {
    'use strict';

    // Se as libs do CDN falharem, remove o gate para a página ficar visível e estática
    if (!window.gsap || !window.ScrollTrigger || !window.Lenis) {
        document.documentElement.classList.remove('motion');
        return;
    }
    // prefers-reduced-motion: o gate do <head> nunca adicionou a classe → sem animações
    if (!document.documentElement.classList.contains('motion')) return;

    try {
        init();
    } catch (err) {
        document.documentElement.classList.remove('motion');
        console.error('[motion] init falhou:', err);
    }

    function init() {
        gsap.registerPlugin(ScrollTrigger);
        if (window.SplitText) gsap.registerPlugin(SplitText);
        if (window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);

        const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
        const isMobile = matchMedia('(max-width: 768px)').matches;
        const D = isMobile ? 0.7 : 1; // factor de duração

        /* ---------- Lenis smooth scroll + ScrollTrigger ---------- */
        const lenis = new Lenis({ autoRaf: false, anchors: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        window.lenis = lenis;

        /* ---------- Estado da nav ao fazer scroll ---------- */
        const nav = document.querySelector('.nav-fixed');
        if (nav) {
            const toggleNav = (y) => nav.classList.toggle('nav-scrolled', y > 80);
            lenis.on('scroll', (e) => toggleNav(e.scroll));
            toggleNav(window.scrollY);
        }

        /* ---------- Sistema de reveals (substitui o AOS) ---------- */
        function revealVars(type) {
            switch (type) {
                case 'clip':
                    return [
                        { clipPath: 'inset(0% 0% 100% 0%)', autoAlpha: 0 },
                        { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, duration: 1.1 * D, ease: 'power4.inOut', clearProps: 'clipPath' }
                    ];
                case 'clip-left':
                    return [
                        { clipPath: 'inset(0% 100% 0% 0%)', autoAlpha: 0 },
                        { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, duration: 1.1 * D, ease: 'power4.inOut', clearProps: 'clipPath' }
                    ];
                case 'clip-right':
                    return [
                        { clipPath: 'inset(0% 0% 0% 100%)', autoAlpha: 0 },
                        { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, duration: 1.1 * D, ease: 'power4.inOut', clearProps: 'clipPath' }
                    ];
                default: // 'up'
                    return [
                        { autoAlpha: 0, y: isMobile ? 32 : 48 },
                        { autoAlpha: 1, y: 0, duration: 1 * D, ease: 'power3.out', clearProps: 'transform' }
                    ];
            }
        }

        const grouped = new Set();
        document.querySelectorAll('[data-reveal-stagger]').forEach((parent) => {
            const kids = Array.from(parent.querySelectorAll(':scope > [data-reveal]'));
            if (!kids.length) return;
            const stag = parseFloat(parent.dataset.revealStagger) || 0.12;
            const tl = gsap.timeline({
                scrollTrigger: { trigger: parent, start: 'top 82%', once: true }
            });
            kids.forEach((kid, i) => {
                grouped.add(kid);
                const [from, to] = revealVars(kid.dataset.reveal);
                tl.fromTo(kid, from, to, i * stag);
            });
        });

        document.querySelectorAll('[data-reveal]').forEach((el) => {
            if (grouped.has(el)) return;
            const [from, to] = revealVars(el.dataset.reveal);
            gsap.fromTo(el, from, Object.assign({}, to, {
                scrollTrigger: { trigger: el, start: 'top 85%', once: true }
            }));
        });

        /* ---------- Tech-lines: border draw + stagger ---------- */
        document.querySelectorAll('.tech-line').forEach((line) => {
            const draw = document.createElement('span');
            draw.className = 'line-draw';
            line.prepend(draw);

            const num = line.querySelector('.tech-num');
            const content = line.querySelector(':scope > div');
            const tl = gsap.timeline({
                scrollTrigger: { trigger: line, start: 'top 85%', once: true }
            });
            tl.fromTo(draw, { scaleX: 0 }, { scaleX: 1, duration: 0.9 * D, ease: 'power3.inOut' }, 0);
            if (num) tl.fromTo(num, { x: -16, autoAlpha: 0 }, { x: 0, autoAlpha: 0.25, duration: 0.7 * D, ease: 'power3.out', clearProps: 'all' }, 0.15);
            if (content) tl.fromTo(content, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 * D, ease: 'power3.out', clearProps: 'transform' }, 0.25);
        });

        /* ---------- Marquee infinito ---------- */
        document.querySelectorAll('.marquee-track').forEach((track) => {
            const tween = gsap.to(track, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
            ScrollTrigger.create({
                trigger: track.parentElement,
                start: 'top bottom',
                end: 'bottom top',
                onToggle: (self) => (self.isActive ? tween.play() : tween.pause())
            });
            tween.pause();
        });

        /* ---------- SplitText: títulos e taglines (espera pelas fontes) ---------- */
        const fontsReady = Promise.race([
            document.fonts ? document.fonts.ready : Promise.resolve(),
            new Promise((r) => setTimeout(r, 1000))
        ]);

        fontsReady.then(() => {
            heroIntro();
            heroParallax();

            // h2 grandes: linhas a subir
            document.querySelectorAll('.js-split-lines').forEach((el) => {
                let targets = [el];
                if (window.SplitText) targets = new SplitText(el, { type: 'lines' }).lines;
                gsap.fromTo(targets,
                    { yPercent: 60, autoAlpha: 0 },
                    {
                        yPercent: 0, autoAlpha: 1, duration: 1.1 * D, stagger: 0.12, ease: 'power4.out',
                        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
                    });
            });

            // taglines: palavra a palavra com scrub
            if (window.SplitText) {
                document.querySelectorAll('.js-split-words').forEach((el) => {
                    const words = new SplitText(el, { type: 'words' }).words;
                    gsap.fromTo(words,
                        { opacity: 0.12 },
                        {
                            opacity: 1, stagger: 0.06, ease: 'none',
                            scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 35%', scrub: true }
                        });
                });
            }

            ScrollTrigger.refresh();
        });

        /* ---------- Intro do hero ---------- */
        function heroIntro() {
            const hero = document.querySelector('#hero');
            if (!hero) return;
            const kicker = hero.querySelector('.hero-kicker');
            const title = hero.querySelector('.js-split-chars');
            const cta = hero.querySelector('.hero-cta');
            const device = hero.querySelector('.hero-device');
            const hint = hero.querySelector('.scroll-hint');

            let chars = title ? [title] : [];
            if (title && window.SplitText) chars = new SplitText(title, { type: 'chars' }).chars;

            const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
            tl.fromTo('.nav-fixed', { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, clearProps: 'transform' }, 0.1);
            if (kicker) tl.fromTo(kicker, { autoAlpha: 0, letterSpacing: '12px' }, { autoAlpha: 1, letterSpacing: '4px', duration: 0.9, clearProps: 'letterSpacing' }, 0.15);
            if (chars.length) tl.fromTo(chars, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1, stagger: 0.03 }, 0.25);
            if (cta) tl.fromTo(cta, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, clearProps: 'transform' }, '-=0.5');
            if (device) tl.fromTo(device, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.5);
            if (hint) tl.fromTo(hint, { autoAlpha: 0 }, { autoAlpha: 0.55, duration: 0.6 }, '-=0.3');
        }

        /* ---------- Parallax do hero (revela o .hero-inner ao criar) ---------- */
        function heroParallax() {
            const inner = document.querySelector('.hero-inner');
            if (!inner) return;
            gsap.fromTo(inner,
                { yPercent: 0, autoAlpha: 1 },
                {
                    yPercent: 18, autoAlpha: 0.25, ease: 'none',
                    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
                });
        }

        /* ---------- Cursor custom (só desktop) ---------- */
        if (finePointer) {
            const dot = document.createElement('div');
            dot.id = 'cursor-dot';
            const ring = document.createElement('div');
            ring.id = 'cursor-ring';
            document.body.append(dot, ring);
            document.documentElement.classList.add('has-cursor');

            gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
            const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
            const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
            const rx = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' });
            const ry = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' });

            window.addEventListener('pointermove', (e) => {
                dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
            }, { passive: true });

            document.addEventListener('mouseover', (e) => {
                if (e.target.closest('a, button')) {
                    gsap.to(ring, { scale: 1.7, borderColor: '#00d4ff', duration: 0.3 });
                    gsap.to(dot, { scale: 0.4, duration: 0.3 });
                }
            });
            document.addEventListener('mouseout', (e) => {
                if (e.target.closest('a, button')) {
                    gsap.to(ring, { scale: 1, borderColor: 'rgba(0,0,0,0.45)', duration: 0.3 });
                    gsap.to(dot, { scale: 1, duration: 0.3 });
                }
            });
            document.documentElement.addEventListener('mouseleave', () => gsap.to([dot, ring], { autoAlpha: 0, duration: 0.2 }));
            document.documentElement.addEventListener('mouseenter', () => gsap.to([dot, ring], { autoAlpha: 1, duration: 0.2 }));
        }

        /* ---------- Botões magnéticos ---------- */
        if (finePointer) {
            document.querySelectorAll('[data-magnetic]').forEach((el) => {
                const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
                const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
                el.addEventListener('pointermove', (e) => {
                    const r = el.getBoundingClientRect();
                    xTo(gsap.utils.clamp(-8, 8, (e.clientX - (r.left + r.width / 2)) * 0.25));
                    yTo(gsap.utils.clamp(-8, 8, (e.clientY - (r.top + r.height / 2)) * 0.25));
                });
                el.addEventListener('pointerleave', () => {
                    gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
                });
            });
        }

        /* ---------- Phone mockup (página da app) ---------- */
        const phone = document.querySelector('.phone-mock');
        if (phone) {
            // flutuação idle
            gsap.to(phone, { y: 12, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });

            // tilt 3D com o rato (só desktop)
            if (finePointer) {
                const device = document.querySelector('.hero-device');
                gsap.set(phone, { transformPerspective: 900 });
                const rX = gsap.quickTo(phone, 'rotationX', { duration: 0.6, ease: 'power3' });
                const rY = gsap.quickTo(phone, 'rotationY', { duration: 0.6, ease: 'power3' });
                device.addEventListener('pointermove', (e) => {
                    const r = device.getBoundingClientRect();
                    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
                    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
                    rY(nx * 8); rX(-ny * 6);
                });
                device.addEventListener('pointerleave', () => { rX(0); rY(0); });
            }

            // drone a voar ao longo da rota + traço animado
            const drone = document.querySelector('.pm-drone');
            const path = document.querySelector('#flight-path');
            if (drone && path && window.MotionPathPlugin) {
                gsap.to(drone, {
                    motionPath: { path: '#flight-path', align: '#flight-path', alignOrigin: [0.5, 0.5] },
                    duration: 7, repeat: -1, repeatDelay: 0.6, ease: 'power1.inOut'
                });
                gsap.to(path, { strokeDashoffset: -24, duration: 1.6, repeat: -1, ease: 'none' });
            }
        }

        window.addEventListener('load', () => ScrollTrigger.refresh());
    }
})();
