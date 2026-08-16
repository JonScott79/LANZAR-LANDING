/*
    animation.js

    Handles the LANZAR opening sequence.
*/

export function initAnimation() {
    const introSequence = document.getElementById('intro-sequence');
    const worldWindow = document.getElementById('world-window');
    const skipBtn = document.getElementById('skip-intro');
    const rocketWrapper = document.getElementById('intro-rocket-wrapper');
    const revealRect = document.getElementById('reveal-rect');
    const smoke = document.querySelector('.intro-smoke');
    const logoGraphics = document.getElementById('logo-graphics');
    const logoSvg = document.getElementById('intro-lanzar-logo');

    let isSkipped = false;

    function completeIntro() {
        if (isSkipped) return;
        isSkipped = true;
        
        // Hide intro, show world
        introSequence.style.opacity = '0';
        setTimeout(() => {
            introSequence.style.display = 'none';
            worldWindow.classList.remove('hidden');
            // Slight fade in
            worldWindow.animate([
                { opacity: 0, transform: 'scale(1.05)' },
                { opacity: 1, transform: 'scale(1)' }
            ], { duration: 1500, easing: 'ease-out' });
        }, 1000);
    }

    skipBtn.addEventListener('click', completeIntro);

    // Simple procedural animation sequence using Web Animations API and timeouts
    // FRAME 1: Dark opening. LANZAR text centered (hidden by clip path initially).
    // FRAME 2: Rocket enters.
    setTimeout(() => {
        if (isSkipped) return;
        rocketWrapper.style.opacity = '1';
        
        // Animate rocket flying across to reveal text
        const endX = window.innerWidth + 200;
        rocketWrapper.animate([
            { transform: 'translate(0px, -50%)' },
            { transform: `translate(${endX}px, -50%)` }
        ], { duration: 3000, easing: 'ease-in-out', fill: 'forwards' });

        // Show smoke
        smoke.style.opacity = '1';

        // Animate reveal mask matching rocket position roughly
        revealRect.animate([
            { width: '0px' },
            { width: '900px' }
        ], { duration: 3000, easing: 'ease-in-out', fill: 'forwards' });

    }, 1000);

    // FRAME 5 & 6: Logo completes, rocket settles (we'll just fade it out and show the rest of the graphics)
    setTimeout(() => {
        if (isSkipped) return;
        smoke.style.opacity = '0';
        rocketWrapper.style.opacity = '0';
        logoGraphics.style.opacity = '1';
        logoGraphics.animate([
            { opacity: 0 },
            { opacity: 1 }
        ], { duration: 1000, fill: 'forwards' });
    }, 4000);

    // FRAME 7 & 8: Logo shrinks, camera pulls back, world reveals
    setTimeout(() => {
        if (isSkipped) return;
        
        logoSvg.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(0.5)' }
        ], { duration: 1500, easing: 'ease-in-out', fill: 'forwards' });

        setTimeout(completeIntro, 1000);

    }, 6000);
}
