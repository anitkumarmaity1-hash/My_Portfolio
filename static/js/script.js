/* ═══════════════════════════════════════════════
   ANIT KUMAR MAITY — Portfolio Script v2.0
   ═══════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════
   1. LOADER
   ════════════════════════════════════════════════ */
(function () {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('ld-bar');
    const pct = document.getElementById('ld-pct');
    const lines = [
        document.getElementById('ll1'),
        document.getElementById('ll2'),
        document.getElementById('ll3'),
        document.getElementById('ll4'),
    ];

    let progress = 0;
    let lineIndex = 0;

    // Animate progress bar
    function setProgress(val) {
        progress = Math.min(val, 100);
        bar.style.width = progress + '%';
        pct.textContent = Math.floor(progress) + '%';
    }

    function showLine(i) {
        if (i >= lines.length) return;
        lines[i].classList.add('show');
        setTimeout(() => {
            lines[i].classList.add('done');
            showLine(i + 1);
        }, 420);
    }

    // Staggered sequence
    setTimeout(() => showLine(0), 400);

    // Progress animation
    const intervals = [
        { target: 30, delay: 500, duration: 300 },
        { target: 62, delay: 900, duration: 400 },
        { target: 85, delay: 1400, duration: 300 },
        { target: 100, delay: 1800, duration: 250 },
    ];
    intervals.forEach(({ target, delay, duration }) => {
        setTimeout(() => {
            const start = progress;
            const diff = target - start;
            const steps = 20;
            let s = 0;
            const step = setInterval(() => {
                s++;
                setProgress(start + diff * (s / steps));
                if (s >= steps) clearInterval(step);
            }, duration / steps);
        }, delay);
    });

    // Exit loader
    setTimeout(() => {
        loader.classList.add('exit');
        setTimeout(() => {
            loader.style.display = 'none';
            // Trigger hero animations
            document.body.classList.add('loaded');
            startTyping();
            scheduleGlitch();
        }, 750);
    }, 2200);
})();


/* ════════════════════════════════════════════════
   2. CUSTOM CURSOR
   ════════════════════════════════════════════════ */
(function () {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mx = -100, my = -100;
    let rx = -100, ry = -100;

    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top = my + 'px';
    });

    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-click'));

    // Hoverable targets
    const hoverTargets = 'a, button, .btn, .tag, .proj-tags span, .hs-link, .contact-item, .skill-group, .stat-card, .cert-card, .nav-links a';
    document.querySelectorAll(hoverTargets).forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

    // Smooth ring follow (lerp)
    (function animateRing() {
        rx += (mx - rx) * 0.14;
        ry += (my - ry) * 0.14;
        ring.style.left = rx + 'px';
        ring.style.top = ry + 'px';
        requestAnimationFrame(animateRing);
    })();
})();


/* ════════════════════════════════════════════════
   3. NEURAL CANVAS (mouse-reactive)
   ════════════════════════════════════════════════ */
(function () {
    const canvas = document.getElementById('neural-canvas');
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [];

    const CYAN = '0, 212, 255';
    const NODE_COUNT = window.innerWidth < 600 ? 28 : 60;
    const CONNECT_DIST = 165;
    const MOUSE_RADIUS = 120;
    const MOUSE_FORCE = 0.4;

    let mouse = { x: -9999, y: -9999 };

    document.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function spawnNodes() {
        nodes = [];
        for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.32,
                vy: (Math.random() - 0.5) * 0.32,
                r: Math.random() * 1.8 + 0.8,
                pulse: Math.random() * Math.PI * 2,
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        nodes.forEach(n => {
            n.pulse += 0.02;

            // Mouse repulsion
            const dx = n.x - mouse.x;
            const dy = n.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS && dist > 0) {
                const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
                n.vx += (dx / dist) * force;
                n.vy += (dy / dist) * force;
            }

            // Damping
            n.vx *= 0.995;
            n.vy *= 0.995;

            // Clamp speed
            const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            if (speed > 1.2) { n.vx = (n.vx / speed) * 1.2; n.vy = (n.vy / speed) * 1.2; }

            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > W) n.vx *= -1;
            if (n.y < 0 || n.y > H) n.vy *= -1;
        });

        // Connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECT_DIST) {
                    const alpha = (1 - dist / CONNECT_DIST) * 0.18;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }

        // Mouse glow connection burst
        nodes.forEach(n => {
            const dx = n.x - mouse.x;
            const dy = n.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS) {
                const alpha = (1 - dist / MOUSE_RADIUS) * 0.35;
                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`;
                ctx.lineWidth = 0.9;
                ctx.stroke();
            }
        });

        // Draw nodes
        nodes.forEach(n => {
            const pulseFactor = 0.3 + 0.2 * Math.sin(n.pulse);
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + pulseFactor, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${CYAN}, 0.55)`;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => { resize(); spawnNodes(); });
    resize();
    spawnNodes();
    draw();
})();


/* ════════════════════════════════════════════════
   4. TYPING EFFECT
   ════════════════════════════════════════════════ */
const ROLES = [
    'AI / ML Engineer',
    'Computer Vision Researcher',
    'Deep Learning Architect',
    'NLP Systems Builder',
    'RAG Systems Developer',
];
let roleIdx = 0, charIdx = 0, deleting = false;
const typedEl = document.getElementById('typed-role');

function startTyping() {
    if (!typedEl) return;
    typeStep();
}

function typeStep() {
    const current = ROLES[roleIdx];
    if (!deleting) {
        charIdx++;
        typedEl.textContent = current.slice(0, charIdx);
        if (charIdx === current.length) {
            setTimeout(() => { deleting = true; typeStep(); }, 2000);
            return;
        }
        setTimeout(typeStep, 58 + Math.random() * 30);
    } else {
        charIdx--;
        typedEl.textContent = current.slice(0, charIdx);
        if (charIdx === 0) {
            deleting = false;
            roleIdx = (roleIdx + 1) % ROLES.length;
            setTimeout(typeStep, 350);
            return;
        }
        setTimeout(typeStep, 32);
    }
}


/* ════════════════════════════════════════════════
   5. HERO GLITCH
   ════════════════════════════════════════════════ */
function scheduleGlitch() {
    const name = document.getElementById('hero-name');
    if (!name) return;

    function doGlitch() {
        name.classList.add('glitching');
        setTimeout(() => name.classList.remove('glitching'), 500);
        setTimeout(doGlitch, 7000 + Math.random() * 6000);
    }
    setTimeout(doGlitch, 1500);
}


/* ════════════════════════════════════════════════
   6. SCROLL PROGRESS BAR
   ════════════════════════════════════════════════ */
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
    if (!progressBar) return;
    const scrolled = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;
    progressBar.style.width = (scrolled / total * 100) + '%';
}, { passive: true });


/* ════════════════════════════════════════════════
   7. NAV SCROLL STATE
   ════════════════════════════════════════════════ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });


/* ════════════════════════════════════════════════
   8. MOBILE MENU
   ════════════════════════════════════════════════ */
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');
if (burger && mobileMenu) {
    burger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    mobileMenu.querySelectorAll('.mob-link').forEach(l =>
        l.addEventListener('click', () => mobileMenu.classList.remove('open'))
    );
}


/* ════════════════════════════════════════════════
   9. ACTIVE NAV LINK
   ════════════════════════════════════════════════ */
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
        if (window.scrollY >= s.offsetTop - 130) current = s.id;
    });
    navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
    });
}, { passive: true });


/* ════════════════════════════════════════════════
   10. SCROLL REVEAL (multi-type)
   ════════════════════════════════════════════════ */
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);

            // Trigger cert bars
            if (entry.target.classList.contains('cert-card')) {
                entry.target.classList.add('bar-animated');
            }
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal-up, .reveal-left').forEach(el =>
    revealObserver.observe(el)
);


/* ════════════════════════════════════════════════
   11. COUNTER ANIMATION
   ════════════════════════════════════════════════ */
const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.target);
        const decimals = parseInt(el.dataset.decimals || '0');
        const duration = 1800;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
            const value = target * eased;
            el.textContent = decimals > 0
                ? value.toFixed(decimals)
                : Math.floor(value).toLocaleString();
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
        counterObserver.unobserve(el);
    });
}, { threshold: 0.4 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));


/* ════════════════════════════════════════════════
   12. 3D CARD TILT
   ════════════════════════════════════════════════ */
document.querySelectorAll('.project-card, .cert-card, .stat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = (cy - y) / 22;
        const rotY = (x - cx) / 22;
        card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});


/* ════════════════════════════════════════════════
   13. SKILL TAG STAGGER REVEAL
   ════════════════════════════════════════════════ */
const skillObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const tags = entry.target.querySelectorAll('.tag');
        tags.forEach((tag, i) => {
            tag.style.opacity = '0';
            tag.style.transform = 'translateY(8px) scale(0.95)';
            tag.style.transition = `opacity 0.35s ease ${i * 45}ms, transform 0.35s ease ${i * 45}ms`;
            setTimeout(() => {
                tag.style.opacity = '';
                tag.style.transform = '';
                setTimeout(() => {
                    tag.style.transition = '';
                }, 350 + i * 45);
            }, 50);
        });
        skillObserver.unobserve(entry.target);
    });
}, { threshold: 0.2 });

document.querySelectorAll('.skill-group').forEach(g => skillObserver.observe(g));


/* ════════════════════════════════════════════════
   14. BACK TO TOP
   ════════════════════════════════════════════════ */
const backBtn = document.getElementById('back-to-top');
window.addEventListener('scroll', () => {
    if (backBtn) backBtn.classList.toggle('show', window.scrollY > 600);
}, { passive: true });
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}


/* ════════════════════════════════════════════════
   15. HERO PARALLAX (subtle)
   ════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const orb1 = document.querySelector('.hero-orb-1');
    const orb2 = document.querySelector('.hero-orb-2');
    if (orb1) orb1.style.transform = `translate(${scrollY * 0.06}px, ${scrollY * 0.04}px)`;
    if (orb2) orb2.style.transform = `translate(${-scrollY * 0.04}px, ${scrollY * 0.06}px)`;
}, { passive: true });


/* ════════════════════════════════════════════════
   16. CONTACT FORM → FastAPI
   ════════════════════════════════════════════════ */
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');

if (form) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
        status.className = 'form-status';
        status.style.display = 'none';

        const payload = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            subject: form.subject.value.trim(),
            message: form.message.value.trim(),
        };

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                status.textContent = '✓ ' + data.message;
                status.className = 'form-status success';
                form.reset();
            } else {
                throw new Error(data.detail || 'Something went wrong.');
            }
        } catch (err) {
            status.textContent = '✗ ' + (err.message || 'Failed. Please email directly.');
            status.className = 'form-status error';
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Send Message';
            status.style.display = 'block';
        }
    });
}


/* ════════════════════════════════════════════════
   17. MOUSE GRADIENT BACKGROUND TRACKING
   ════════════════════════════════════════════════ */
(function () {
    let tx = 50, ty = 50, cx = 50, cy = 50;
    const hero = document.querySelector('.hero');

    document.addEventListener('mousemove', e => {
        tx = (e.clientX / window.innerWidth) * 100;
        ty = (e.clientY / window.innerHeight) * 100;
    });

    (function animate() {
        cx += (tx - cx) * 0.05;
        cy += (ty - cy) * 0.05;
        if (hero) {
            hero.style.setProperty('--mx', cx.toFixed(1) + '%');
            hero.style.setProperty('--my', cy.toFixed(1) + '%');
        }
        requestAnimationFrame(animate);
    })();
})();