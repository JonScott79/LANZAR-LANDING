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
        "blog/ninety-nine-login.html"
    ];
    let currentBlog = 0;
    
    const screen = document.getElementById("blog-display");
    const btnPrev = document.getElementById("blog-previous");
    const btnNext = document.getElementById("blog-next");
    
    if (screen && btnPrev && btnNext) {
        btnPrev.addEventListener("click", () => {
            currentBlog--;
            if (currentBlog < 0) currentBlog = blogs.length - 1;
            screen.src = blogs[currentBlog];
        });
        
        btnNext.addEventListener("click", () => {
            currentBlog++;
            if (currentBlog >= blogs.length) currentBlog = 0;
            screen.src = blogs[currentBlog];
        });
    }
});
