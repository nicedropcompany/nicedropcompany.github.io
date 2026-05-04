// ELEMENTS
const revealItems = document.querySelectorAll(".reveal, .fade-section");


// -----------------------------
// REVEAL ON SCROLL
// -----------------------------

function initReveal() {

	if (!("IntersectionObserver" in window)) {
		revealItems.forEach(el => el.classList.add("visible"));
		return;
	}

	const observer = new IntersectionObserver((entries, obs) => {

		entries.forEach(entry => {

			if (entry.isIntersecting) {
				entry.target.classList.add("visible");
				obs.unobserve(entry.target);
			}

		});

	}, {
		rootMargin: "0px 0px -10% 0px",
		threshold: 0.2
	});

	revealItems.forEach(el => observer.observe(el));

}


// -----------------------------
// DRONE STORY — scroll journey
// -----------------------------

function initDroneStory() {

	const sticky  = document.getElementById("dsSticky");
	if (!sticky || typeof ScrollTrigger === "undefined") return;

	const drone  = document.getElementById("dsDrone");
	const panel1 = document.getElementById("dsPanel1");
	const panel2 = document.getElementById("dsPanel2");
	const pd1    = document.getElementById("dsPd1");
	const pd2    = document.getElementById("dsPd2");

	// Register plugin
	gsap.registerPlugin(ScrollTrigger);

	// Initial state — drone tiny (far away)
	gsap.set(drone,  { scale: 0.07 });
	gsap.set([panel1, panel2], { opacity: 0 });

	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: sticky,
			start:   "top top",
			end:     "+=3400",      // px of scroll distance for the whole journey
			scrub:   1.4,
			pin:     true,
			pinSpacing: true,
			anticipatePin: 1,
			onUpdate(self) {
				const p = self.progress;
				pd1.classList.toggle("on", p > 0.08 && p < 0.58);
				pd2.classList.toggle("on", p >= 0.58);
			}
		}
	});

	// ── Phase 1: zoom in (0 → 0.25) ──
	tl.to(drone, {
		scale: 1.7,
		filter: "drop-shadow(0 0 80px rgba(14,165,233,0.65))",
		duration: 3,
		ease: "power2.inOut"
	});

	// ── Phase 2: text 1 appears (0.25 → 0.42) ──
	tl.to(panel1, { opacity: 1, duration: 1.5, ease: "power2.out" })
	  .to(drone,  { scale: 1.7, duration: 1.5 }, "<");   // hold

	// ── Hold (0.42 → 0.50) ──
	tl.to({}, { duration: 0.8 });

	// ── Phase 3: text 1 out + zoom out (0.50 → 0.65) ──
	tl.to(panel1, { opacity: 0, duration: 0.8, ease: "power2.in" })
	  .to(drone,  {
			scale: 0.07,
			filter: "drop-shadow(0 0 30px rgba(14,165,233,0.2))",
			duration: 2.2,
			ease: "power2.inOut"
		}, "<0.3");

	// ── Phase 4: zoom in again, closer (0.65 → 0.82) ──
	tl.to(drone, {
		scale: 2.3,
		filter: "drop-shadow(0 0 100px rgba(56,189,248,0.75))",
		duration: 2.8,
		ease: "power2.inOut"
	});

	// ── Phase 5: text 2 appears (0.82 → 1.0) ──
	tl.to(panel2, { opacity: 1, duration: 1.5, ease: "power2.out" }, "-=0.5")
	  .to({}, { duration: 1.2 }); // final hold

}


// -----------------------------
// INIT
// -----------------------------

function init() {

	initReveal();
	initDroneStory();

}

document.addEventListener("DOMContentLoaded", init);
