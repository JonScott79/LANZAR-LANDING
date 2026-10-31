/*
    main.js

    Primary entry point for LANZAR homepage.
*/

import { initAnimation } from './animation.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        // Skip animation entirely
        const introSequence = document.getElementById('intro-sequence');
        const worldWindow = document.getElementById('world-window');
        introSequence.style.display = 'none';
        worldWindow.classList.remove('hidden');
    } else {
        // Initialize opening sequence
        initAnimation();
    }

    // Smooth scrolling for navigation
    document.querySelectorAll('.nav-link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({
                        behavior: 'smooth'
                    });
                    
                    // Track navigation
                    if (window.Analytics) {
                        window.Analytics.track('Navigation', 'Click', { target: targetId });
                    }
                }
            }
        });
    });
});

// =====================================
// Blog Display Controls
// =====================================
document.addEventListener("DOMContentLoaded", () => {
    const blogs = [
        "blog/philosophy.html",
        "blog/public-built.html",
        "blog/origin.html",
        "blog/digital-frontier.html",
        "blog/catting-code.html",
        "blog/ninety-nine-login.html",
        "blog/free-is-harder-than-it-sounds.html"
    ];
    let currentBlog = 0;

    function updateBlogDisplay() {
        if (screen && blogs[currentBlog]) {
            screen.src = blogs[currentBlog];
            const slug = blogs[currentBlog].split('/').pop().replace('.html', '');
            if (history.replaceState) {
                history.replaceState(null, '', '#' + slug);
            } else {
                window.location.hash = slug;
            }
        }
    }

    // Check if a specific blog was targeted via hash (e.g. #free-is-harder-than-it-sounds)
    if (window.location.hash) {
        const targetSlug = window.location.hash.replace('#', '').toLowerCase();
        const foundIndex = blogs.findIndex(b => b.toLowerCase().includes(targetSlug));
        if (foundIndex !== -1) {
            currentBlog = foundIndex;
        }
    }

    const screen = document.getElementById("blog-display");
    const btnPrev = document.getElementById("blog-previous");
    const btnNext = document.getElementById("blog-next");
    
    if (screen) {
        updateBlogDisplay();
    }
    
    if (screen && btnPrev && btnNext) {
        btnPrev.addEventListener("click", () => {
            currentBlog--;
            if (currentBlog < 0) currentBlog = blogs.length - 1;
            updateBlogDisplay();
        });
        
        btnNext.addEventListener("click", () => {
            currentBlog++;
            if (currentBlog >= blogs.length) currentBlog = 0;
            updateBlogDisplay();
        });
    }
});

// =====================================
// LANZAR Dispatch Subscription Modal
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    const backdrop = document.getElementById('dispatch-modal-backdrop');
    const modal = document.getElementById('dispatch-modal');
    const closeBtn = document.getElementById('dispatch-modal-close');
    const form = document.getElementById('dispatch-form');
    const emailInput = document.getElementById('dispatch-email');
    const hpInput = document.getElementById('dispatch-hp');
    const submitBtn = document.getElementById('dispatch-submit-btn');
    const submitText = document.getElementById('dispatch-submit-text');
    const feedback = document.getElementById('dispatch-feedback');
    const openBtns = document.querySelectorAll('.open-dispatch-btn');

    let lastFocusedElement = null;

    if (!backdrop || !form) return;

    // Determine API Base URL
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBaseUrl = isLocal ? 'http://localhost:3001' : 'https://api.tickets.lanzar.me';

    function openModal(triggerElement) {
        lastFocusedElement = triggerElement;
        backdrop.style.display = 'flex';
        // Force reflow for CSS opacity transition
        void backdrop.offsetWidth;
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
        
        // Reset state
        feedback.textContent = '';
        feedback.className = 'dispatch-feedback';
        
        // Focus email input
        setTimeout(() => {
            if (emailInput) emailInput.focus();
        }, 50);

        document.addEventListener('keydown', handleKeyDown);
    }

    function closeModal() {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        
        setTimeout(() => {
            backdrop.style.display = 'none';
        }, 250);

        document.removeEventListener('keydown', handleKeyDown);

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    }

    // Attach open triggers
    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(btn);
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
        });
    }

    // Close when clicking background outside modal card
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeModal();
        }
    });

    // Handle asynchronous form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.textContent = '';
        feedback.className = 'dispatch-feedback';

        // Honeypot bot protection check
        if (hpInput && hpInput.value.trim() !== '') {
            feedback.textContent = 'Transmission confirmed! Welcome aboard the LANZAR Dispatch.';
            feedback.className = 'dispatch-feedback success';
            form.reset();
            return;
        }

        const email = emailInput ? emailInput.value.trim() : '';

        // Basic client-side email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            feedback.textContent = 'Please enter a valid email address.';
            feedback.className = 'dispatch-feedback error';
            if (emailInput) emailInput.focus();
            return;
        }

        // Submitting state
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'TRANSMITTING...';

        try {
            const response = await fetch(`${apiBaseUrl}/api/newsletter/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    source: 'homepage'
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                feedback.innerHTML = `
                    <div style="margin-bottom: 0.75rem; font-weight: bold;">
                        ${data.message || 'Transmission confirmed! Welcome aboard the LANZAR Dispatch.'}
                    </div>
                    <div class="dispatch-id-invite">
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #102A43; font-weight: 600;">
                            Want to get more from LANZAR?
                        </p>
                        <a href="https://auth.lanzar.me" target="_blank" rel="noopener" class="btn-primary" style="display: inline-block; padding: 0.5rem 1.25rem; font-size: 0.85rem; text-decoration: none;">
                            CREATE YOUR LANZAR ID &rarr;
                        </a>
                    </div>
                `;
                feedback.className = 'dispatch-feedback success';
                form.reset();
                if (emailInput) emailInput.disabled = true;
                if (submitBtn) submitBtn.style.display = 'none';
            } else {
                feedback.textContent = data.error || 'Unable to join the transmission. Please try again.';
                feedback.className = 'dispatch-feedback error';
                if (submitBtn) submitBtn.disabled = false;
                if (submitText) submitText.textContent = 'JOIN THE TRANSMISSION';
            }
        } catch (error) {
            console.error('[DISPATCH ERROR]', error);
            feedback.textContent = 'Transmission interrupted. Please check your connection and try again.';
            feedback.className = 'dispatch-feedback error';
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = 'JOIN THE TRANSMISSION';
        }
    });
});


// =====================================
// Layered Background Parallax Physics
// =====================================
document.addEventListener("DOMContentLoaded", () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const skyLayer = document.getElementById('citySkyLayer');
    const panoLayer = document.getElementById('cityPanoLayer');
    const aeroLayer = document.getElementById('cityAeroLayer');

    if (!panoLayer || !aeroLayer) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isTicking = false;

    window.addEventListener('mousemove', (e) => {
        const xNorm = (e.clientX / window.innerWidth) - 0.5;
        const yNorm = (e.clientY / window.innerHeight) - 0.5;
        targetX = xNorm;
        targetY = yNorm;

        if (!isTicking) {
            requestAnimationFrame(updateParallax);
            isTicking = true;
        }
    }, { passive: true });

    function updateParallax() {
        // Smooth lerp
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;

        if (skyLayer) {
            skyLayer.style.transform = `translate3d(${currentX * 12}px, ${currentY * 8}px, 0)`;
        }
        panoLayer.style.transform = `translate3d(${currentX * 24}px, ${currentY * 14}px, 0)`;
        aeroLayer.style.transform = `translate3d(${currentX * 42}px, ${currentY * 26}px, 0)`;

        if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
            requestAnimationFrame(updateParallax);
        } else {
            isTicking = false;
        }
    }
});
