function showToast(msg, duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

function getAnimeById(id) {
    return ANIME_DATA.find(a => a.id === Number(id));
}

function goHome() { location.href = 'index.html'; }
function goBack() {
    if (document.referrer && document.referrer.includes(location.hostname)) {
        history.back();
    } else {
        location.href = 'index.html';
    }
}
function goDetail(id) { location.href = `detail.html?id=${id}`; }
function goWatch(id, ep = 1) { location.href = `watch.html?id=${id}&ep=${ep}`; }

const Store = {
    getFavorites() {
        try { return JSON.parse(localStorage.getItem('anime_favs') || '[]'); }
        catch { return []; }
    },
    setFavorites(list) {
        localStorage.setItem('anime_favs', JSON.stringify(list));
    },
    isFavorite(id) {
        return this.getFavorites().includes(id);
    },
    toggleFavorite(id) {
        const favs = this.getFavorites();
        const idx = favs.indexOf(id);
        if (idx >= 0) favs.splice(idx, 1);
        else favs.push(id);
        this.setFavorites(favs);
        return idx < 0;
    },
    getProgress(id) {
        try { return JSON.parse(localStorage.getItem(`progress_${id}`) || '{}'); }
        catch { return {}; }
    }
};

function createAnimeCard(anime) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.onclick = () => goDetail(anime.id);

    const progress = Store.getProgress(anime.id);
    const lastEp = Object.keys(progress).length > 0
        ? Math.max(...Object.keys(progress).map(Number))
        : 0;

    card.innerHTML = `
        <div class="anime-cover">
            ${anime.cover
                ? `<img src="${anime.cover}" alt="${anime.name}" loading="lazy">`
                : `<div class="anime-cover-placeholder">${anime.coverEmoji || '🎬'}</div>`
            }
            ${anime.isHot ? '<span class="anime-badge">🔥 热</span>' : ''}
            ${anime.isNew ? '<span class="anime-badge" style="background:#4ade80;color:#0f0f1a;">NEW</span>' : ''}
            <span class="anime-score">★ ${anime.score}</span>
            <span class="anime-ep">${lastEp > 0 ? `看至${lastEp}话` : `更新至${anime.updatedEp}话`}</span>
        </div>
        <div class="anime-info">
            <div class="anime-name">${anime.name}</div>
            <div class="anime-meta">
                <span>${anime.year}</span>
                <span>·</span>
                <span>${anime.status}</span>
                ${anime.category.slice(0, 2).map(c => `<span class="anime-cat">${c}</span>`).join('')}
            </div>
        </div>
    `;
    return card;
}

function renderDetail() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const anime = getAnimeById(id);

    if (!anime) {
        document.querySelector('.main').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <p>找不到这部动漫</p>
                <button class="btn-primary" style="margin-top:16px;" onclick="goHome()">返回首页</button>
            </div>
        `;
        return;
    }

    document.title = `${anime.name} - AnimeHub`;

    const hero = document.getElementById('detailHero');
    if (hero) {
        hero.style.background = anime.banner;
        hero.style.position = 'relative';
        hero.innerHTML = `
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:120px;opacity:0.2;">
                ${anime.coverEmoji || '🎬'}
            </div>
        `;
    }

    const info = document.getElementById('detailInfo');
    if (info) {
        const isFav = Store.isFavorite(anime.id);
        const progress = Store.getProgress(anime.id);
        const lastEp = Object.keys(progress).length > 0
            ? Math.max(...Object.keys(progress).map(Number))
            : 0;
        const continueEp = lastEp > 0 ? lastEp : 1;

        info.innerHTML = `
            <div class="detail-cover">
                ${anime.cover
                    ? `<img src="${anime.cover}" alt="${anime.name}" style="width:100%;height:100%;object-fit:cover;">`
                    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:64px;background:linear-gradient(135deg,#16213e,#1a1a2e);">${anime.coverEmoji || '🎬'}</div>`
                }
            </div>
            <div class="detail-text">
                <h1 class="detail-title">${anime.name}</h1>
                <div class="detail-meta-grid">
                    <div class="detail-meta-item">评分 <span>★ ${anime.score}</span></div>
                    <div class="detail-meta-item">年份 <span>${anime.year}</span></div>
                    <div class="detail-meta-item">状态 <span style="color:${anime.status === '连载中' ? '#4ade80' : 'inherit'};">${anime.status}</span></div>
                    <div class="detail-meta-item">集数 <span>${anime.updatedEp} / ${anime.totalEp || '?'}</span></div>
                    <div class="detail-meta-item">制作 <span>${anime.studio}</span></div>
                    <div class="detail-meta-item">更新 <span>${WEEK_DAYS[anime.updateDay]}</span></div>
                </div>
                <div class="detail-tags">
                    ${anime.category.map(c => `<span class="detail-tag">${c}</span>`).join('')}
                </div>
                <p class="detail-desc">${anime.desc}</p>
                <div class="detail-actions">
                    <button class="btn-watch" onclick="goWatch(${anime.id}, ${continueEp})">
                        ${lastEp > 0 ? `▶ 继续观看 第${continueEp}话` : '▶ 开始观看'}
                    </button>
                    <button class="btn-fav ${isFav ? 'active' : ''}" id="favBtn" onclick="toggleFav(${anime.id})">
                        ${isFav ? '⭐ 已追番' : '☆ 追番'}
                    </button>
                </div>
            </div>
        `;
    }

    const epList = document.getElementById('episodeList');
    if (epList) {
        epList.innerHTML = '';
        anime.videoSources.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'ep-btn';
            if (ep.isNew && anime.status === '连载中') btn.classList.add('new');
            const seen = Store.getProgress(anime.id)[ep.ep];
            if (seen && seen.time > 60) {
                btn.style.background = 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.05))';
                btn.style.borderColor = 'rgba(74,222,128,0.3)';
            }
            btn.textContent = ep.ep;
            btn.title = ep.title || `第${ep.ep}话`;
            btn.onclick = () => goWatch(anime.id, ep.ep);
            epList.appendChild(btn);
        });
    }

    const relatedGrid = document.getElementById('relatedGrid');
    if (relatedGrid) {
        relatedGrid.innerHTML = '';
        const related = ANIME_DATA.filter(a =>
            a.id !== anime.id &&
            a.category.some(c => anime.category.includes(c))
        ).slice(0, 6);
        if (related.length === 0) {
            ANIME_DATA.filter(a => a.id !== anime.id).slice(0, 6)
                .forEach(a => relatedGrid.appendChild(createAnimeCard(a)));
        } else {
            related.forEach(a => relatedGrid.appendChild(createAnimeCard(a)));
        }
    }
}

function toggleFav(id) {
    const added = Store.toggleFavorite(id);
    const btn = document.getElementById('favBtn');
    if (btn) {
        btn.classList.toggle('active', added);
        btn.textContent = added ? '⭐ 已追番' : '☆ 追番';
    }
    showToast(added ? '⭐ 已添加到追番列表' : '已取消追番');
}

document.addEventListener('DOMContentLoaded', renderDetail);
