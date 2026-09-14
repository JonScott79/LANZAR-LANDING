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
