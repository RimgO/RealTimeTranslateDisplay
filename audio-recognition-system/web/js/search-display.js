/**
 * Search Results Management
 * 
 * Handles rendering of keyword search results (articles and images).
 */

const searchResultsList = document.getElementById('searchResults');
const clearSearchBtn = document.getElementById('clearSearchBtn');

if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', clearSearchResults);
}

/**
 * Handle incoming keywords and search results
 */
export function handleKeywords(data) {
    const { keywords, articles, images, pair_id } = data;

    if (!keywords || keywords.length === 0) return;

    // Clear placeholder if present
    const placeholder = searchResultsList.querySelector('.search-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    // Create new search group
    const group = document.createElement('div');
    group.className = 'search-group';
    group.dataset.pairId = pair_id;

    // Keywords Header
    const kwHtml = keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('');

    // Articles HTML
    let articlesHtml = '';
    if (articles && articles.length > 0) {
        articlesHtml = articles.map(art => `
            <div class="article-card">
                <h4><a href="${art.link}" target="_blank">${art.title}</a></h4>
                <p>${art.snippet}</p>
            </div>
        `).join('');
    }

    // Images HTML
    let imagesHtml = '';
    if (images && images.length > 0) {
        imagesHtml = `
            <div class="image-grid">
                ${images.map(img => `
                    <div class="image-item" onclick="window.open('${img.url}', '_blank')">
                        <img src="${img.thumbnail || img.image}" title="${img.title || ''}" alt="${img.title || ''}">
                    </div>
                `).join('')}
            </div>
        `;
    }

    group.innerHTML = `
        <div class="search-keywords">${kwHtml}</div>
        <div class="search-articles">${articlesHtml}</div>
        <div class="search-images">${imagesHtml}</div>
    `;

    // Add to top of list
    searchResultsList.prepend(group);

    // Keep only last 10 search results to avoid memory issues
    const groups = searchResultsList.querySelectorAll('.search-group');
    if (groups.length > 10) {
        groups[groups.length - 1].remove();
    }
}

/**
 * Clear all search results
 */
export function clearSearchResults() {
    searchResultsList.innerHTML = '<p class="search-placeholder">Keywords and related info will appear here.</p>';
}
