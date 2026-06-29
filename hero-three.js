/* NiceDrop — campo de partículas "drone swarm" atrás do hero (só index, só desktop) */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

(function () {
    'use strict';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse || window.innerWidth < 768) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) {
        return; // sem WebGL: o sky.png é o fallback, nada quebra
    }

    renderer.setClearColor(0x000000, 0); // transparente — o céu fica visível
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const canvas = renderer.domElement;
    canvas.id = 'hero-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    document.body.prepend(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.z = 60;

    /* Sprite circular: os Points por defeito são quadrados */
    function dotTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        return new THREE.CanvasTexture(c);
    }
    const sprite = dotTexture();

    /* Swarm principal: pontos pretos pequenos */
    const COUNT = 150;
    const BOX = { x: 70, y: 40, z: 30 };
    const positions = new Float32Array(COUNT * 3);
    const baseX = new Float32Array(COUNT);
    const baseY = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    const drift = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
        baseX[i] = (Math.random() * 2 - 1) * BOX.x;
        baseY[i] = (Math.random() * 2 - 1) * BOX.y;
        positions[i * 3] = baseX[i];
        positions[i * 3 + 1] = baseY[i];
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOX.z;
        phase[i] = Math.random() * Math.PI * 2;
        speed[i] = 0.4 + Math.random() * 0.8;
        drift[i] = 0.6 + Math.random() * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const swarm = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x000000, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.4,
        map: sprite, alphaTest: 0.1, depthWrite: false
    }));
    scene.add(swarm);

    /* Beacons ciano: poucos pontos maiores como acento */
    const BCOUNT = 5;
    const bPositions = new Float32Array(BCOUNT * 3);
    const bPhase = new Float32Array(BCOUNT);
    for (let i = 0; i < BCOUNT; i++) {
        bPositions[i * 3] = (Math.random() * 2 - 1) * BOX.x * 0.8;
        bPositions[i * 3 + 1] = (Math.random() * 2 - 1) * BOX.y * 0.8;
        bPositions[i * 3 + 2] = (Math.random() * 2 - 1) * BOX.z * 0.5;
        bPhase[i] = Math.random() * Math.PI * 2;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPositions, 3));
    const beaconMat = new THREE.PointsMaterial({
        color: 0x00d4ff, size: 3, sizeAttenuation: true, transparent: true, opacity: 0.8,
        map: sprite, alphaTest: 0.1, depthWrite: false
    });
    scene.add(new THREE.Points(bGeo, beaconMat));

    /* Parallax do rato */
    let mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
        mx = (e.clientX / window.innerWidth) * 2 - 1;
        my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    /* Loop — pára fora do hero e com a tab escondida */
    const clock = new THREE.Clock();
    let running = false;
    let rafId = 0;

    function frame() {
        const t = clock.getElapsedTime();
        const pos = geo.attributes.position.array;
        for (let i = 0; i < COUNT; i++) {
            // deriva horizontal contínua com wraparound + flutuação vertical
            const x = baseX[i] + t * drift[i];
            pos[i * 3] = ((x + BOX.x) % (BOX.x * 2)) - BOX.x;
            pos[i * 3 + 1] = baseY[i] + Math.sin(t * speed[i] + phase[i]) * 1.8;
        }
        geo.attributes.position.needsUpdate = true;
        beaconMat.opacity = 0.5 + Math.sin(t * 2) * 0.3;

        camera.position.x += (mx * 6 - camera.position.x) * 0.05;
        camera.position.y += (-my * 4 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
    }

    function shouldRun() {
        return !document.hidden && window.scrollY < window.innerHeight * 1.2;
    }

    function syncLoop() {
        // fade do canvas ao longo do primeiro viewport
        canvas.style.opacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.8));
        if (shouldRun() && !running) {
            running = true;
            rafId = requestAnimationFrame(frame);
        } else if (!shouldRun() && running) {
            running = false;
            cancelAnimationFrame(rafId);
        }
    }

    window.addEventListener('scroll', syncLoop, { passive: true });
    document.addEventListener('visibilitychange', syncLoop);
    syncLoop();

    /* Resize com debounce */
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }, 150);
    });
})();
