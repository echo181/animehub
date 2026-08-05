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
let retryCount = 0;

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

    const demoBanner = document.getElementById('demoBanner');
    const demoText = document.getElementById('demoText');
    if (epData.isDemo) {
        demoBanner.style.display = 'flex';
        demoText.textContent = `📺 当前播放：${currentAnime.name} 第${currentEp}话（演示视频源）`;
    } else {
        demoBanner.style.display = 'none';
    }

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
    const errorOverlay = document.getElementById('playerError');
    const errorDesc = document.getElementById('errorDesc');

    if (progressTimer) clearInterval(progressTimer);
    retryCount = 0;

    player.onerror = null;
    player.pause();
    player.removeAttribute('src');
    player.load();
    errorOverlay.style.display = 'none';
    bigPlay.classList.remove('hidden');

    player.src = epData.url;

    const saved = Store.getProgress(currentAnime.id)[currentEp];
    const restoreOnLoad = saved && saved.time > 10;

    const restoreListener = () => {
        if (saved && saved.time > 10) {
            try { player.currentTime = Math.min(saved.time, (player.duration || saved.time) - 5); } catch {}
        }
        player.removeEventListener('loadedmetadata', restoreListener);
    };
    player.addEventListener('loadedmetadata', restoreListener);

    const onError = () => {
        loading.style.display = 'none';
        const errType = determineError(player, epData);
        errorDesc.textContent = errType;
        errorOverlay.style.display = 'flex';
        bigPlay.classList.add('hidden');
    };

    player.addEventListener('error', onError, { once: true });

    player.addEventListener('stalled', () => {
        showToast('⚠️ 视频缓冲卡住，尝试继续加载...');
    });

    player.addEventListener('waiting', () => { loading.style.display = 'flex'; });
    player.addEventListener('playing', () => {
        loading.style.display = 'none';
        errorOverlay.style.display = 'none';
        bigPlay.classList.add('hidden');
    });
    player.addEventListener('pause', () => {
        if (player.readyState > 0) bigPlay.classList.remove('hidden');
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
        document.getElementById('progressPlayed').style.width = pct + '%';
        document.getElementById('progressThumb').style.left = pct + '%';
        document.getElementById('currentTime').textContent = formatTime(player.currentTime);
    });

    player.addEventListener('loadedmetadata', () => {
        document.getElementById('totalTime').textContent = formatTime(player.duration);
    });

    player.addEventListener('progress', () => {
        if (player.buffered.length > 0 && player.duration) {
            document.getElementById('progressBuffered').style.width =
                (player.buffered.end(player.buffered.length - 1) / player.duration * 100) + '%';
        }
    });

    progressTimer = setInterval(() => {
        if (player && player.currentTime > 0) {
            Store.setProgress(currentAnime.id, currentEp, player.currentTime);
        }
    }, 5000);

    bigPlay.onclick = () => {
        if (player.paused) {
            player.play().catch(err => {
                showToast('⚠️ 视频加载失败，请点击「查看配置方法」');
            });
        } else {
            player.pause();
        }
    };

    document.getElementById('playPauseBtn').onclick = () => {
        if (player.paused) {
            player.play().catch(() => {});
        } else {
            player.pause();
        }
    };

    document.getElementById('prevEpBtn').onclick = prevEp;
    document.getElementById('nextEpBtn').onclick = nextEp;
    document.getElementById('prevBtn').onclick = prevEp;
    document.getElementById('nextBtn').onclick = nextEp;

    let isDragging = false;
    const progressBar = document.getElementById('progressBar');

    function seek(e) {
        if (!player.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        player.currentTime = pct * player.duration;
    }

    progressBar.onmousedown = progressBar.ontouchstart = (e) => {
        isDragging = true;
        seek(e);
    };
    document.onmousemove = document.ontouchmove = (e) => {
        if (isDragging) seek(e);
    };
    document.onmouseup = document.ontouchend = () => { isDragging = false; };

    document.getElementById('muteBtn').onclick = () => {
        player.muted = !player.muted;
        document.getElementById('muteBtn').textContent = player.muted ? '🔇' : '🔊';
        document.getElementById('volumeSlider').value = player.muted ? 0 : player.volume;
    };

    document.getElementById('volumeSlider').oninput = () => {
        const vol = Number(document.getElementById('volumeSlider').value);
        player.volume = vol;
        player.muted = vol === 0;
        document.getElementById('muteBtn').textContent = vol === 0 ? '🔇' : '🔊';
    };

    document.getElementById('fullscreenBtn').onclick = toggleFullscreen;

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch(e.key) {
            case ' ': e.preventDefault(); document.getElementById('playPauseBtn').click(); break;
            case 'ArrowRight': player.currentTime = Math.min(player.duration || 0, player.currentTime + 10); break;
            case 'ArrowLeft': player.currentTime = Math.max(0, player.currentTime - 10); break;
            case 'ArrowUp':
                e.preventDefault();
                const vol = Math.min(1, Number(document.getElementById('volumeSlider').value) + 0.1);
                document.getElementById('volumeSlider').value = vol;
                document.getElementById('volumeSlider').oninput();
                break;
            case 'ArrowDown':
                e.preventDefault();
                const v2 = Math.max(0, Number(document.getElementById('volumeSlider').value) - 0.1);
                document.getElementById('volumeSlider').value = v2;
                document.getElementById('volumeSlider').oninput();
                break;
            case 'f': case 'F': toggleFullscreen(); break;
            case 'm': case 'M': document.getElementById('muteBtn').click(); break;
        }
    });
}

function determineError(player, epData) {
    const networkState = player.networkState;
    const error = player.error;
    if (!epData || !epData.url) return '视频源 URL 未配置，请在 data.js 中设置';
    if (networkState === 3) return '网络已断开，请检查网络连接';
    if (networkState === 2) return '无法加载视频源（服务器不可达），可能被墙或需要翻墙访问';
    if (networkState === 1 && error) {
        if (error.code === 1) return '视频加载被中断';
        if (error.code === 2) return '网络错误：视频源服务器无响应或跨域阻止';
        if (error.code === 3) return '视频解码失败：可能是格式不兼容';
        if (error.code === 4) return '视频格式不支持或资源不存在';
    }
    return '视频源不可访问。可能需要：1)替换为国内可访问的视频源 2)开启 VPN 3)检查 CORS 配置';
}

function retryVideo() {
    const epData = currentAnime.videoSources[currentEp - 1];
    const errorOverlay = document.getElementById('playerError');
    errorOverlay.style.display = 'none';
    retryCount++;
    if (retryCount > 2) {
        showToast('重试次数过多，请查看配置方法');
        showConfigGuide();
        return;
    }
    showToast(`🔄 第${retryCount}次重试...`);
    initPlayer(epData);
    setTimeout(() => {
        if (player.paused && player.readyState < 2) {
            player.play().catch(() => {});
        }
    }, 500);
}

function showConfigGuide() {
    document.getElementById('configModal').style.display = 'flex';
}

function hideConfigGuide() {
    document.getElementById('configModal').style.display = 'none';
}

function openDataSourceUrl() {
    showToast('请在 data.js 中配置您自己的视频源 URL');
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
