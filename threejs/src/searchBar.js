export function initSearchBar({ map, searcher, search_delay = 250, search_result_count = 5 } = {}) {

    const input = document.getElementById('search');
    const container = document.getElementById('search-bar');
    const intermediateResults = document.getElementById('intermediate_results');
    const mobileBtn = document.getElementById('mobile-search-btn');
    const closeBtn = document.getElementById('search-close-btn');

    if (!input || !container || !intermediateResults) return;

    let timeout;

    function debounce(fn, wait) {
        return function (...args) {
            window.clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function createOverlayIfNeeded() {
        // Only create the dark full-screen overlay on small screens
        if (!window.matchMedia('(max-width:620px)').matches) return null;

        let overlay = document.getElementById('search-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'search-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', closePanel);
        }
        return overlay;
    }

    function openPanel() {
        container.classList.add('mobile-open');
        document.body.classList.add('search-active-mobile');

        const overlay = createOverlayIfNeeded();
        if (overlay) overlay.classList.add('visible');

        // only lock scroll on small screens where overlay is used
        if (window.matchMedia('(max-width:620px)').matches) {
            document.body.style.overflow = 'hidden';
        }
    }

    function closePanel() {
        intermediateResults.classList.remove('open');
        container.classList.remove('mobile-open');
        document.body.classList.remove('search-active-mobile');

        const overlay = document.getElementById('search-overlay');
        if (overlay) overlay.classList.remove('visible');

        // allow transition before removing overlay and restoring scroll
        setTimeout(() => {
            const ov = document.getElementById('search-overlay');
            if (ov) ov.remove();
            document.body.style.overflow = '';
            // hide sheet offscreen
            container.style.visibility = '';
        }, 260);
    }

    function show_intermediate_results(search_results) {
        intermediateResults.innerHTML = '';
        if (!search_results || search_results.length === 0) {
            intermediateResults.classList.add('open');
            intermediateResults.innerHTML = '<div class="empty">No results</div>';
            return;
        }

        const ul = document.createElement('ul');
        const keys = search_results.map(el => el.item && el.item.attributes && el.item.attributes.key ? el.item.attributes.key : String(el));
        for (let i = 0; i < keys.length; i++) {
            const li = document.createElement('li');
            li.textContent = keys[i];
            li.tabIndex = 0;
            li.addEventListener('click', () => {
                searcher.search_and_zoom(keys[i], map);
                closePanel();
            });
            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    searcher.search_and_zoom(keys[i], map);
                    closePanel();
                }
            });
            ul.appendChild(li);
        }
        intermediateResults.appendChild(ul);
        intermediateResults.classList.add('open');
        // ensure the sheet is visible
        openPanel();
    }

    // input handlers
    input.addEventListener('keyup', (event) => {
        const value = event.target.value;
        if (!value || value.trim().length === 0) {
            intermediateResults.classList.remove('open');
            return;
        }
        if (event.key === 'Enter') {
            searcher.search_and_zoom(value, map);
            closePanel();
            return;
        }
        const deb = debounce(() => {
            const results = searcher.search_n_best_matches(value, search_result_count);
            show_intermediate_results(results);
        }, search_delay);
        deb();
    });

    input.addEventListener('focusin', () => {
        if (input.value && input.value.trim()) openPanel();
    });

    input.addEventListener('focusout', () => {
        setTimeout(() => {
            if (!intermediateResults.contains(document.activeElement) && document.activeElement !== input) {
                closePanel();
            }
        }, 120);
    });

     // open sheet when mobile button pressed
    if (mobileBtn) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPanel();
            setTimeout(() => input.focus(), 80);
        });
    }

    /* sheet is closed via overlay, ESC, clicking outside or selecting a result */

    // clicking outside closes (but allow mobile button)
    document.addEventListener('click', (e) => {
        if (mobileBtn && mobileBtn.contains(e.target)) return;
        if (!container.contains(e.target) && !intermediateResults.contains(e.target)) {
            closePanel();
        }
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });

}