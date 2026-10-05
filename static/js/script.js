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
