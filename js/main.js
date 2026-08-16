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
