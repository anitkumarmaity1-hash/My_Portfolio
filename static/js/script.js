'use strict';

/* Nav shadow / border on scroll */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* Mobile menu */
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');
if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('open');
        burger.setAttribute('aria-expanded', open);
    });
    mobileMenu.querySelectorAll('.mob-link').forEach(l =>
        l.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
            burger.setAttribute('aria-expanded', 'false');
        })
    );
}

/* Active nav link while scrolling */
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

/* Subtle one-time reveal on scroll into view */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal-up').forEach(el => revealObserver.observe(el));
} else {
    document.querySelectorAll('.reveal-up').forEach(el => el.classList.add('visible'));
}

/* Back to top */
const backBtn = document.getElementById('back-to-top');
window.addEventListener('scroll', () => {
    if (backBtn) backBtn.classList.toggle('show', window.scrollY > 600);
}, { passive: true });
if (backBtn) {
    backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
}

/* Theme toggle (saved in localStorage) */
(function () {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (_) { /* storage blocked */ }
    });
})();

/* Scroll progress bar */
(function () {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    const update = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();

/* Rotating hero focus line */
(function () {
    const el = document.getElementById('rotator');
    if (!el || reduceMotion) return;
    const words = ['Generative AI apps', 'RAG pipelines', 'Computer Vision models', 'NLP & speech systems'];
    let i = 0;
    setInterval(() => {
        el.classList.add('fade');
        setTimeout(() => {
            i = (i + 1) % words.length;
            el.textContent = words[i];
            el.classList.remove('fade');
        }, 250);
    }, 2600);
})();

/* Copy email */
(function () {
    const btn = document.getElementById('copy-email');
    if (!btn) return;
    const email = btn.dataset.email;
    btn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(email);
            btn.textContent = 'Copied ✓';
            btn.classList.add('copied');
        } catch (_) {
            window.location.href = `mailto:${email}`;
            return;
        }
        setTimeout(() => { btn.textContent = 'Copy email'; btn.classList.remove('copied'); }, 1800);
    });
})();

/* Project filter chips */
(function () {
    const chips = document.querySelectorAll('#proj-filter .chip');
    const cards = document.querySelectorAll('.project-card');
    chips.forEach(chip => chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        chips.forEach(c => c.classList.toggle('active', c === chip));
        cards.forEach(card => {
            const show = f === 'all' || (card.dataset.cat || '').split(' ').includes(f);
            card.hidden = !show;
            if (show) card.classList.add('visible');
        });
    }));
})();

/* Project cards: keep the first paragraph, expand the rest on demand */
(function () {
    document.querySelectorAll('.project-card').forEach(card => {
        const descs = card.querySelectorAll('.proj-desc');
        if (descs.length < 2) return;
        const extra = Array.from(descs).slice(1);
        extra.forEach(d => d.classList.add('is-collapsed'));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'proj-more';
        btn.textContent = 'Show details';
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', () => {
            const open = btn.getAttribute('aria-expanded') !== 'true';
            extra.forEach(d => d.classList.toggle('is-collapsed', !open));
            btn.textContent = open ? 'Show less' : 'Show details';
            btn.setAttribute('aria-expanded', open);
        });
        descs[0].after(btn);
    });
})();

/* Contact form -> FastAPI /api/contact */
(function () {
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');

    if (!form) return;

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'form-status ' + type;
    }

    function hideStatus() {
        statusEl.textContent = '';
        statusEl.className = 'form-status';
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        hideStatus();

        const name = document.getElementById('cf-name').value.trim();
        const email = document.getElementById('cf-email').value.trim();
        const subject = document.getElementById('cf-subject').value.trim();
        const message = document.getElementById('cf-message').value.trim();

        if (!name) { showStatus('Please enter your name.', 'error'); return; }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showStatus('Please enter a valid email address.', 'error'); return;
        }
        if (!message) { showStatus('Please enter a message.', 'error'); return; }

        submitBtn.disabled = true;
        btnText.textContent = 'Sending…';

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject, message }),
            });

            let data = {};
            try { data = await res.json(); } catch (_) { /* non-JSON response */ }

            if (res.ok) {
                showStatus("Message sent — I'll get back to you soon.", 'success');
                form.reset();
                statusEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
            } else {
                const errMsg = data.detail || data.message || `Server error (${res.status}). Please try emailing directly.`;
                showStatus(errMsg, 'error');
            }
        } catch (err) {
            showStatus('Could not connect to the server. Please email anitkumarmaity1@gmail.com directly.', 'error');
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Send Message';
        }
    });
})();