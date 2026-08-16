/**
 * LANZAR About Page - Terminal Interaction Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const chapters = Array.from(document.querySelectorAll('.chapter'));
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const chapterSelect = document.getElementById('chapter-select');
    
    // Map of id -> index for quick lookup
    const chapterIds = chapters.map(ch => ch.id);
    let currentIndex = 0;

    function init() {
        // Handle initial hash if present
        const hash = window.location.hash.replace('#', '');
        if (hash && chapterIds.includes(hash)) {
            currentIndex = chapterIds.indexOf(hash);
        }
        updateTerminal();
        
        // Listeners
        btnPrev.addEventListener('click', () => navigate(-1));
        btnNext.addEventListener('click', () => navigate(1));
        chapterSelect.addEventListener('change', (e) => goToChapter(e.target.value));
        
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('keydown', handleKeyboard);
    }

    function navigate(direction) {
        let newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < chapters.length) {
            goToChapter(chapterIds[newIndex]);
        }
    }

    function goToChapter(id) {
        const index = chapterIds.indexOf(id);
        if (index === -1) return;
        
        currentIndex = index;
        
        // Update URL without jumping the page
        // We use history.pushState to support browser history (back/forward buttons)
        if (window.location.hash !== '#' + id) {
            history.pushState(null, null, '#' + id);
        }
        updateTerminal();
    }

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '');
        if (hash && chapterIds.includes(hash)) {
            currentIndex = chapterIds.indexOf(hash);
            updateTerminal();
        }
    }

    function handleKeyboard(e) {
        // Prevent interfering with inputs if we had any
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                navigate(-1);
                break;
            case 'ArrowRight':
                navigate(1);
                break;
            case 'Home':
                e.preventDefault();
                goToChapter(chapterIds[0]);
                break;
            case 'End':
                e.preventDefault();
                goToChapter(chapterIds[chapterIds.length - 1]);
                break;
        }
    }

    function updateTerminal() {
        // Update Classes
        chapters.forEach((ch, idx) => {
            if (idx === currentIndex) {
                ch.classList.add('active');
                ch.setAttribute('aria-hidden', 'false');
            } else {
                ch.classList.remove('active');
                ch.setAttribute('aria-hidden', 'true');
            }
        });

        // Update Select Dropdown
        chapterSelect.value = chapterIds[currentIndex];

        // Update Buttons
        btnPrev.disabled = currentIndex === 0;
        btnNext.disabled = currentIndex === chapters.length - 1;
    }

    init();
});
