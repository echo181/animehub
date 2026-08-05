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
    },
    setProgress(id, ep, time) {
        const data = this.getProgress(id);
        data[ep] = { time, updatedAt: Date.now() };
        localStorage.setItem(`progress_${id}`, JSON.stringify(data));
    }
};

let currentAnime = null;
let currentEp = 1;
let player = null;
let progressTimer = null;

function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function renderWatch() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const ep = Number(params.get('ep') || 1);

    currentAnime = getAnimeById(id);
    if (!currentAnime) {
        document.querySelector('.main').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <p>找不到这部动漫</p>
                <button class="btn-primary" style="margin-top:16px;" onclick="location.href='index.html'">返回首页</button>
            </div>
        `;
        return;
    }

    currentEp = Math.min(Math.max(1, ep), currentAnime.updatedEp);

    const epData = currentAnime.videoSources[currentEp - 1];
    document.title = `${currentAnime.name} - 第${currentEp}话 - AnimeHub`;

    document.getElementById('playerTitle').textContent = `${currentAnime.name} · 第${currentEp}话`;
    document.getElementById('watchTitle').textContent = `${currentAnime.name}`;
    document.getElementById('animeDesc').textContent = currentAnime.desc;

    document.getElementById('watchMeta').innerHTML = `
        <span>第${currentEp}话</span> ·
        <span>★ ${currentAnime.score}</span> ·
        <span>${currentAnime.year}</span> ·
        <span>${currentAnime.status}</span> ·
        <span>${currentAnime.studio}</span> ·
        <span>更新至 ${currentAnime.updatedEp} 话</span>
    `;

    const isFav = Store.isFavorite(currentAnime.id);
    const favBtn = document.getElementById('favBtn');
    favBtn.classList.toggle('active', isFav);
    favBtn.textContent = isFav ? '⭐ 已追番' : '⭐ 追番';

    initPlayer(epData);
    renderEpisodeList();
    updateNavButtons();
}

function initPlayer(epData) {
    player = document.getElementById('videoPlayer');
    const loading = document.getElementById('loadingSpinner');
    const bigPlay = document.getElementById('bigPlayBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progress = document.getElementById('progressPlayed');
    const buffered = document.getElementById('progressBuffered');
    const thumb = document.getElementById('progressThumb');
    const progressBar = document.getElementById('progressBar');
    const currEl = document.getElementById('currentTime');
    const totalEl = document.getElementById('totalTime');
    const prevBtn = document.getElementById('prevEpBtn');
    const nextBtn = document.getElementById('nextEpBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volume = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    if (progressTimer) clearInterval(progressTimer);

    player.src = epData.url;
    player.load();

    const saved = Store.getProgress(currentAnime.id)[currentEp];
    if (saved && saved.time > 10) {
        showToast(`⏯ 上次看到 ${formatTime(saved.time)}，为您恢复进度`);
        player.addEventListener('loadedmetadata', function restore() {
            try { player.currentTime = Math.min(saved.time, player.duration - 5); } catch {}
            player.removeEventListener('loadedmetadata', restore);
        });
    }

    player.addEventListener('loading', () => loading.style.display = 'flex');
    player.addEventListener('waiting', () => loading.style.display = 'flex');
    player.addEventListener('canplay', () => loading.style.display = 'none');
    player.addEventListener('playing', () => {
        loading.style.display = 'none';
        bigPlay.classList.add('hidden');
        playPauseBtn.textContent = '⏸';
    });
    player.addEventListener('pause', () => {
        bigPlay.classList.remove('hidden');
        playPauseBtn.textContent = '▶';
    });
    player.addEventListener('ended', () => {
        if (currentEp < currentAnime.updatedEp) {
            showToast('✅ 本集已看完，3秒后播放下一集...');
            setTimeout(() => nextEp(), 3000);
        } else {
            showToast('🎉 已看完最新一集！');
        }
    });

    player.addEventListener('timeupdate', () => {
        if (!player.duration) return;
        const pct = (player.currentTime / player.duration) * 100;
        progress.style.width = pct + '%';
        thumb.style.left = pct + '%';
        currEl.textContent = formatTime(player.currentTime);
    });

    player.addEventListener('loadedmetadata', () => {
        totalEl.textContent = formatTime(player.duration);
    });

    player.addEventListener('progress', () => {
        if (player.buffered.length > 0 && player.duration) {
            buffered.style.width = (player.buffered.end(player.buffered.length - 1) / player.duration * 100) + '%';
        }
    });

    progressTimer = setInterval(() => {
        if (player && player.currentTime > 0) {
            Store.setProgress(currentAnime.id, currentEp, player.currentTime);
        }
    }, 5000);

    bigPlay.onclick = () => {
        if (player.paused) player.play().catch(() => showToast('请手动点击播放'));
        else player.pause();
    };

    playPauseBtn.onclick = () => {
        if (player.paused) player.play().catch(() => {});
        else player.pause();
    };

    prevBtn.onclick = prevEp;
    nextBtn.onclick = nextEp;

    document.getElementById('prevBtn').onclick = prevEp;
    document.getElementById('nextBtn').onclick = nextEp;

    let isDragging = false;
    progressBar.onmousedown = progressBar.ontouchstart = (e) => {
        isDragging = true;
        seek(e);
    };
    document.onmousemove = document.ontouchmove = (e) => {
        if (isDragging) seek(e);
    };
    document.onmouseup = document.ontouchend = () => { isDragging = false; };

    function seek(e) {
        if (!player.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        player.currentTime = pct * player.duration;
    }

    muteBtn.onclick = () => {
        player.muted = !player.muted;
        muteBtn.textContent = player.muted ? '🔇' : '🔊';
        volume.value = player.muted ? 0 : player.volume;
    };

    volume.oninput = () => {
        player.volume = volume.value;
        player.muted = volume.value === 0;
        muteBtn.textContent = player.muted ? '🔇' : '🔊';
    };

    fullscreenBtn.onclick = toggleFullscreen;

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch(e.key) {
            case ' ': e.preventDefault(); playPauseBtn.onclick(); break;
            case 'ArrowRight': player.currentTime = Math.min(player.duration || 0, player.currentTime + 10); break;
            case 'ArrowLeft': player.currentTime = Math.max(0, player.currentTime - 10); break;
            case 'ArrowUp': e.preventDefault(); volume.value = Math.min(1, Number(volume.value) + 0.1); volume.oninput(); break;
            case 'ArrowDown': e.preventDefault(); volume.value = Math.max(0, Number(volume.value) - 0.1); volume.oninput(); break;
            case 'f': case 'F': toggleFullscreen(); break;
            case 'm': case 'M': muteBtn.onclick(); break;
        }
    });
}

function toggleFullscreen() {
    const wrapper = document.getElementById('videoWrapper');
    const doc = document;
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        (wrapper.requestFullscreen || wrapper.webkitRequestFullscreen).call(wrapper).catch(() => {
            if (player.webkitEnterFullscreen) player.webkitEnterFullscreen();
        });
    } else {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    }
}

function prevEp() {
    if (currentEp <= 1) {
        showToast('已经是第一集了');
        return;
    }
    if (player && player.currentTime > 0) {
        Store.setProgress(currentAnime.id, currentEp, player.currentTime);
    }
    goWatch(currentAnime.id, currentEp - 1);
}

function nextEp() {
    if (currentEp >= currentAnime.updatedEp) {
        showToast('没有更多集了');
        return;
    }
    if (player && player.currentTime > 0) {
        Store.setProgress(currentAnime.id, currentEp, player.currentTime);
    }
    goWatch(currentAnime.id, currentEp + 1);
}

function updateNavButtons() {
    document.getElementById('prevBtn').disabled = currentEp <= 1;
    document.getElementById('nextBtn').disabled = currentEp >= currentAnime.updatedEp;
    document.getElementById('prevEpBtn').style.opacity = currentEp <= 1 ? 0.4 : 1;
    document.getElementById('nextEpBtn').style.opacity = currentEp >= currentAnime.updatedEp ? 0.4 : 1;
}

function renderEpisodeList() {
    const list = document.getElementById('episodeList');
    list.innerHTML = '';
    currentAnime.videoSources.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'ep-btn' + (ep.ep === currentEp ? ' active' : '');
        if (ep.isNew && currentAnime.status === '连载中') btn.classList.add('new');
        const seen = Store.getProgress(currentAnime.id)[ep.ep];
        if (seen && seen.time > 60 && ep.ep !== currentEp) {
            btn.style.background = 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(74,222,128,0.05))';
            btn.style.borderColor = 'rgba(74,222,128,0.3)';
        }
        btn.textContent = ep.ep;
        btn.title = ep.title || `第${ep.ep}话`;
        btn.onclick = () => {
            if (player && player.currentTime > 0) {
                Store.setProgress(currentAnime.id, currentEp, player.currentTime);
            }
            goWatch(currentAnime.id, ep.ep);
        };
        list.appendChild(btn);
    });
}

document.getElementById('favBtn').addEventListener('click', () => {
    const added = Store.toggleFavorite(currentAnime.id);
    const btn = document.getElementById('favBtn');
    btn.classList.toggle('active', added);
    btn.textContent = added ? '⭐ 已追番' : '⭐ 追番';
    showToast(added ? '⭐ 已添加到追番列表' : '已取消追番');
});

document.addEventListener('DOMContentLoaded', () => {
    renderWatch();
});

window.addEventListener('beforeunload', () => {
    if (player && player.currentTime > 0) {
        Store.setProgress(currentAnime.id, currentEp, player.currentTime);
    }
});
