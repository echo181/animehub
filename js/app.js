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
    },
    setProgress(id, ep, time) {
        const data = this.getProgress(id);
        data[ep] = { time, updatedAt: Date.now() };
        localStorage.setItem(`progress_${id}`, JSON.stringify(data));
    },
    getNotifyEnabled() {
        return localStorage.getItem('notify_enabled') === 'true';
    },
    setNotifyEnabled(v) {
        localStorage.setItem('notify_enabled', v ? 'true' : 'false');
    },
    getLastSeenUpdate(id) {
        try { return JSON.parse(localStorage.getItem('last_seen_updates') || '{}')[id] || 0; }
        catch { return 0; }
    },
    setLastSeenUpdate(id, ep) {
        const data = JSON.parse(localStorage.getItem('last_seen_updates') || '{}');
        data[id] = ep;
        localStorage.setItem('last_seen_updates', JSON.stringify(data));
    }
};

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

function initNavigation() {
    const pages = {
        home: document.getElementById('homePage'),
        updates: document.getElementById('updatesPage'),
        favorites: document.getElementById('favoritesPage')
    };

    function switchPage(pageName) {
        Object.entries(pages).forEach(([name, el]) => {
            el.classList.toggle('active', name === pageName);
        });
        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.dataset.page === pageName);
        });
        document.querySelectorAll('.mobile-nav-item').forEach(a => {
            a.classList.toggle('active', a.dataset.page === pageName);
        });
        location.hash = pageName;
        if (pageName === 'favorites') renderFavorites();
        if (pageName === 'updates') renderUpdatesPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage(el.dataset.page);
        });
    });

    const hash = location.hash.replace('#', '') || 'home';
    if (pages[hash]) switchPage(hash);
}

function initBanner() {
    const slider = document.getElementById('bannerSlider');
    const dots = document.getElementById('bannerDots');
    if (!slider || !dots) return;

    const hotAnime = ANIME_DATA.filter(a => a.isHot).slice(0, 5);
    hotAnime.forEach((anime, i) => {
        const item = document.createElement('div');
        item.className = 'banner-item';
        item.style.background = anime.banner;
        item.style.position = 'relative';
        item.onclick = () => goDetail(anime.id);

        item.innerHTML = `
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80px;opacity:0.3;">
                ${anime.coverEmoji || '🎬'}
            </div>
            <div class="banner-content">
                <span class="banner-tag">${anime.status}</span>
                <div class="banner-title">${anime.name}</div>
                <div class="banner-desc">${anime.desc}</div>
            </div>
        `;
        slider.appendChild(item);

        const dot = document.createElement('div');
        dot.className = 'banner-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => goToSlide(i);
        dots.appendChild(dot);
    });

    let currentSlide = 0;
    const totalSlides = hotAnime.length;

    function goToSlide(n) {
        currentSlide = (n + totalSlides) % totalSlides;
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots.querySelectorAll('.banner-dot').forEach((d, i) => {
            d.classList.toggle('active', i === currentSlide);
        });
    }

    setInterval(() => goToSlide(currentSlide + 1), 5000);
}

function renderAnimeGrids() {
    const hotGrid = document.getElementById('hotGrid');
    const latestGrid = document.getElementById('latestGrid');
    const allGrid = document.getElementById('allGrid');

    if (hotGrid) {
        ANIME_DATA.filter(a => a.isHot).slice(0, 8).forEach(a => hotGrid.appendChild(createAnimeCard(a)));
    }

    if (latestGrid) {
        [...ANIME_DATA].sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate))
            .slice(0, 8).forEach(a => latestGrid.appendChild(createAnimeCard(a)));
    }

    if (allGrid) {
        ANIME_DATA.forEach(a => allGrid.appendChild(createAnimeCard(a)));
    }
}

function initSearch() {
    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchBtn');
    const allGrid = document.getElementById('allGrid');

    function doSearch() {
        const q = input.value.trim().toLowerCase();
        const currentCat = document.querySelector('.cat-btn.active')?.dataset.cat || 'all';
        if (!allGrid) return;
        allGrid.innerHTML = '';
        let list = ANIME_DATA;
        if (q) list = list.filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.category.some(c => c.includes(q)) ||
            a.studio.toLowerCase().includes(q)
        );
        if (currentCat !== 'all') list = list.filter(a => a.category.includes(currentCat));
        if (list.length === 0) {
            allGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🔍</div><p>没有找到相关动漫</p><p class="empty-sub">试试其他关键词吧</p></div>';
            return;
        }
        list.forEach(a => allGrid.appendChild(createAnimeCard(a)));
    }

    input.addEventListener('input', debounce(doSearch, 300));
    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            doSearch();
        });
    });
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function renderFavorites() {
    const grid = document.getElementById('favGrid');
    const empty = document.getElementById('favEmpty');
    if (!grid) return;
    grid.innerHTML = '';
    const favs = Store.getFavorites();
    if (favs.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    favs.forEach(id => {
        const anime = getAnimeById(id);
        if (anime) grid.appendChild(createAnimeCard(anime));
    });
}

function renderUpdatesPage() {
    const tabs = document.getElementById('weekTabs');
    const list = document.getElementById('updatesList');
    if (!tabs || !list) return;

    const todayIdx = new Date().getDay();

    if (!tabs.dataset.rendered) {
        tabs.innerHTML = '';
        WEEK_DAYS.forEach((day, i) => {
            const btn = document.createElement('button');
            btn.className = 'week-tab' + (i === todayIdx ? ' today active' : '');
            btn.textContent = i === todayIdx ? `今天 · ${day}` : day;
            btn.onclick = () => {
                tabs.querySelectorAll('.week-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderUpdatesList(i);
            };
            tabs.appendChild(btn);
        });
        tabs.dataset.rendered = 'true';
    }

    renderUpdatesList(todayIdx);
    checkNewUpdates();
}

function renderUpdatesList(dayIdx) {
    const list = document.getElementById('updatesList');
    if (!list) return;
    list.innerHTML = '';
    const animes = ANIME_DATA.filter(a => a.updateDay === dayIdx && a.status === '连载中');

    if (animes.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>今天没有动漫更新</p><p class="empty-sub">看看其他日期吧~</p></div>';
        return;
    }

    animes.forEach(anime => {
        const lastSeen = Store.getLastSeenUpdate(anime.id);
        const hasNew = anime.updatedEp > lastSeen;
        const item = document.createElement('div');
        item.className = 'update-item';
        item.onclick = () => {
            Store.setLastSeenUpdate(anime.id, anime.updatedEp);
            goWatch(anime.id, anime.updatedEp);
        };
        item.innerHTML = `
            <div class="anime-cover">
                ${anime.cover
                    ? `<img src="${anime.cover}" alt="${anime.name}" loading="lazy">`
                    : `<div class="anime-cover-placeholder">${anime.coverEmoji || '🎬'}</div>`
                }
                ${hasNew ? '<span class="anime-badge" style="background:#4ade80;color:#0f0f1a;">新</span>' : ''}
            </div>
            <div class="update-content">
                <div class="update-name">${anime.name}</div>
                <div class="update-ep">📺 更新至 第${anime.updatedEp}话 ${hasNew ? '· 有更新！' : ''}</div>
                <div class="update-time">上次更新: ${anime.lastUpdate} · ${anime.studio}</div>
            </div>
        `;
        list.appendChild(item);
    });
}

function checkNewUpdates() {
    const favs = Store.getFavorites();
    const newUpdates = [];
    favs.forEach(id => {
        const anime = getAnimeById(id);
        if (!anime) return;
        const lastSeen = Store.getLastSeenUpdate(anime.id);
        if (anime.updatedEp > lastSeen) {
            newUpdates.push({ anime, newEp: anime.updatedEp - lastSeen });
        }
    });
    if (newUpdates.length > 0 && Store.getNotifyEnabled()) {
        setTimeout(() => {
            showToast(`📢 ${newUpdates[0].anime.name} 等${newUpdates.length}部追番有更新！`);
            sendNotify(newUpdates);
        }, 1500);
    }
}

async function sendNotify(updates) {
    if (!Store.getNotifyEnabled()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        updates.slice(0, 3).forEach(({ anime, newEp }, i) => {
            setTimeout(() => {
                new Notification(`🎬 ${anime.name} 更新了！`, {
                    body: `更新了 ${newEp} 集，目前更新至第${anime.updatedEp}话`,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎬</text></svg>'
                });
            }, i * 2000);
        });
    }
}

function initNotifyButton() {
    const btn = document.getElementById('enableNotifyBtn');
    if (!btn) return;

    function updateBtn() {
        const enabled = Store.getNotifyEnabled();
        btn.textContent = enabled ? '✅ 提醒已开启' : '🔔 开启更新提醒';
    }

    btn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showToast('您的浏览器不支持通知功能');
            return;
        }
        if (Notification.permission === 'denied') {
            showToast('请在浏览器设置中允许通知权限');
            return;
        }
        if (Notification.permission !== 'granted') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') {
                showToast('通知权限被拒绝');
                return;
            }
        }
        const nowOn = !Store.getNotifyEnabled();
        Store.setNotifyEnabled(nowOn);
        updateBtn();
        showToast(nowOn ? '✅ 已开启更新提醒，追番更新会通知您' : '🔕 已关闭更新提醒');
    });

    updateBtn();
}

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initBanner();
    renderAnimeGrids();
    initSearch();
    initNotifyButton();
});
