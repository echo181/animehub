/**
 * TVBox UI 交互逻辑
 */

let hlsInstance = null;
let currentDetail = null;
let currentEpIndex = 0;

function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ========== 初始化 ==========
async function initTVBox() {
    const configs = TVBoxStore.getConfigs();

    if (configs.length === 0) {
        const presets = [
            { url: 'https://qiaoji8.com/tvbox/bj8.json', name: '俏佳人' },
            { url: 'http://www.饭太硬.com/tv/', name: '饭太硬' },
            { url: 'http://fan.888484.xyz/tv', name: 'Fan' },
            { url: 'http://www.荷城茶秀.com/tv/', name: '荷城茶秀' }
        ];
        presets.forEach(p => TVBoxStore.addConfig(p.url, p.name));
    }

    renderConfigList();
    renderHistory();

    const active = TVBoxStore.getActiveConfig();
    if (active) {
        await loadConfig(active.url);
    } else {
        document.getElementById('siteList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📥</div>
                <p>还没有添加影视源</p>
                <button class="btn-primary" onclick="showConfigPanel()">添加影视源</button>
            </div>
        `;
    }
}

async function loadConfig(url) {
    TVBoxStore.setActive(url);
    document.getElementById('siteList').innerHTML = '<div class="loading-text">⏳ 正在加载影视源配置...</div>';

    try {
        const result = await TVBoxEngine.loadConfig(url);
        renderSites(result.sites);
    } catch (err) {
        document.getElementById('siteList').innerHTML = `
            <div class="error-box">
                <p>❌ 加载失败：${err.message}</p>
                <p class="error-hint">可能是该源暂时不可用，请尝试其他源或稍后重试</p>
                <button class="btn-primary" onclick="showConfigPanel()">更换影视源</button>
            </div>
        `;
    }
}

function renderSites(sites) {
    if (!sites || sites.length === 0) {
        document.getElementById('siteList').innerHTML = '<div class="loading-text">未找到可用站点</div>';
        return;
    }

    const html = sites.slice(0, 30).map(site => `
        <button class="site-chip" onclick="selectSite('${site.key}')">
            <span class="site-type type-${site.type}">${site.type === 1 ? 'JSON' : 'XML'}</span>
            <span class="site-name">${site.name}</span>
        </button>
    `).join('');

    document.getElementById('siteList').innerHTML = html;
}

let currentSiteKey = null;

async function selectSite(siteKey) {
    currentSiteKey = siteKey;
    document.querySelectorAll('.site-chip').forEach(el => el.classList.remove('active'));
    event?.target?.closest('.site-chip')?.classList.add('active');

    const site = TVBoxEngine.sites.find(s => s.key === siteKey);
    if (!site) return;

    document.getElementById('resultTitle').textContent = `${site.name} - 首页推荐`;
    document.getElementById('videoGrid').innerHTML = '<div class="loading-text">⏳ 加载中...</div>';

    try {
        const categories = await TVBoxEngine.getCategories(siteKey);
        renderCategories(categories, siteKey);

        const videos = await TVBoxEngine.getCategoryVideos(siteKey, '', 1);
        renderVideos(videos);
    } catch (err) {
        document.getElementById('videoGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>加载失败：${err.message}</p>
            </div>
        `;
    }
}

function renderCategories(categories, siteKey) {
    const section = document.getElementById('categorySection');
    const tabs = document.getElementById('categoryTabs');

    if (!categories || categories.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    tabs.innerHTML = `
        <button class="cat-tab active" onclick="loadCategory('${siteKey}', '', this, event)">全部</button>
        ${categories.map(c => `
            <button class="cat-tab" onclick="loadCategory('${siteKey}', '${c.type_id}', this, event)">${c.type_name}</button>
        `).join('')}
    `;
}

async function loadCategory(siteKey, typeId, btn, e) {
    e?.preventDefault();
    document.querySelectorAll('.cat-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');

    document.getElementById('videoGrid').innerHTML = '<div class="loading-text">⏳ 加载中...</div>';

    try {
        const videos = await TVBoxEngine.getCategoryVideos(siteKey, typeId, 1);
        renderVideos(videos);
    } catch (err) {
        document.getElementById('videoGrid').innerHTML = `<div class="empty-state"><p>加载失败</p></div>`;
    }
}

function renderVideos(videos) {
    if (!videos || videos.length === 0) {
        document.getElementById('videoGrid').innerHTML = '<div class="empty-state"><p>暂无内容</p></div>';
        return;
    }

    const html = videos.map(v => `
        <div class="anime-card" onclick="showDetail('${v.siteKey}', '${v.id}')">
            <div class="anime-cover">
                ${v.pic ? `<img src="${proxyImageUrl(v.pic)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('no-pic')">
                <div class="cover-emoji">🎬</div>` : '<div class="cover-emoji">🎬</div>'}
                ${v.remarks ? `<span class="anime-badge">${v.remarks}</span>` : ''}
            </div>
            <div class="anime-info">
                <div class="anime-name">${v.name}</div>
                <div class="anime-meta">${v.siteName || ''}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('videoGrid').innerHTML = html;
}

async function doSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) return;
    if (!currentSiteKey) {
        showToast('请先选择一个影视源站点');
        return;
    }

    document.getElementById('resultTitle').textContent = `搜索: "${keyword}"`;
    document.getElementById('videoGrid').innerHTML = '<div class="loading-text">⏳ 搜索中...</div>';

    try {
        const results = await TVBoxEngine.search(keyword, currentSiteKey);
        if (results.length === 0) {
            document.getElementById('videoGrid').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>未找到相关内容</p>
                    <p class="empty-sub">试试其他关键词或其他影视源</p>
                </div>
            `;
        } else {
            renderVideos(results);
        }
    } catch (err) {
        document.getElementById('videoGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>搜索失败：${err.message}</p>
            </div>
        `;
    }
}

// ========== 详情弹窗 ==========
async function showDetail(siteKey, videoId) {
    document.getElementById('detailModal').style.display = 'flex';
    document.getElementById('detailContent').innerHTML = '<div class="loading-text">⏳ 加载详情...</div>';

    try {
        const detail = await TVBoxEngine.getDetail(siteKey, videoId);
        currentDetail = detail;
        renderDetail(detail);
    } catch (err) {
        document.getElementById('detailContent').innerHTML = `
            <div class="error-box">
                <p>❌ 加载失败：${err.message}</p>
                <button class="btn-primary" onclick="hideDetailModal()">关闭</button>
            </div>
        `;
    }
}

function renderDetail(detail) {
    const html = `
        <div class="detail-modal-header">
            ${detail.pic ? `<img src="${proxyImageUrl(detail.pic)}" class="detail-modal-pic" onerror="this.style.display='none'">` : ''}
            <div class="detail-modal-info">
                <h2>${detail.name || '未知'}</h2>
                <div class="detail-modal-meta">
                    ${detail.year ? `<span>📅 ${detail.year}</span>` : ''}
                    ${detail.area ? `<span>🌍 ${detail.area}</span>` : ''}
                    ${detail.category ? `<span>🏷️ ${detail.category}</span>` : ''}
                </div>
                ${detail.director ? `<p class="detail-modal-line"><b>导演:</b> ${detail.director}</p>` : ''}
                ${detail.actor ? `<p class="detail-modal-line"><b>主演:</b> ${detail.actor}</p>` : ''}
                ${detail.desc ? `<p class="detail-modal-desc">${detail.desc}</p>` : ''}
                <div class="detail-modal-source">源: ${detail.siteName}</div>
            </div>
        </div>
        ${detail.episodes.length > 0 ? `
            <div class="detail-modal-episodes">
                <h3>剧集列表 (${detail.episodes.length}集)</h3>
                <div class="episode-list">
                    ${detail.episodes.map((ep, i) => `
                        <button class="ep-btn ${i === 0 ? 'active' : ''}" onclick="playEpisode(${i})" title="${ep.title}">
                            ${ep.ep}
                        </button>
                    `).join('')}
                </div>
                <button class="btn-watch" style="width:100%;margin-top:16px" onclick="playEpisode(0)">▶ 立即播放</button>
            </div>
        ` : '<p class="loading-text">暂无播放资源</p>'}
    `;
    document.getElementById('detailContent').innerHTML = html;
}

function hideDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// ========== 播放器 ==========
async function playEpisode(index) {
    if (!currentDetail || !currentDetail.episodes[index]) return;

    currentEpIndex = index;
    const ep = currentDetail.episodes[index];

    document.getElementById('detailModal').style.display = 'none';
    document.getElementById('playerModal').style.display = 'flex';
    document.getElementById('playerTitle').textContent = `${currentDetail.name} - ${ep.title}`;
    document.getElementById('tvboxLoading').style.display = 'flex';
    document.getElementById('tvboxPlayerError').style.display = 'none';

    renderPlayerEpisodes(index);

    TVBoxStore.addHistory({
        id: `${currentDetail.siteKey}_${currentDetail.id}`,
        name: currentDetail.name,
        ep: ep.title,
        siteKey: currentDetail.siteKey,
        videoId: currentDetail.id,
        epIndex: index,
        time: Date.now()
    });
    renderHistory();

    const video = document.getElementById('tvboxPlayer');
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

    try {
        const resolved = await TVBoxEngine.resolvePlayUrl(ep.url);
        document.getElementById('tvboxLoading').style.display = 'none';

        if (resolved.type === 'iframe') {
            document.getElementById('tvboxErrorDesc').textContent = '该视频需要解析播放，暂不支持网页播放。请尝试其他源或集数。';
            document.getElementById('tvboxPlayerError').style.display = 'flex';
            return;
        }

        if (resolved.type === 'hls' || resolved.url.includes('.m3u8')) {
            if (Hls.isSupported()) {
                hlsInstance = new Hls();
                hlsInstance.loadSource(resolved.url);
                hlsInstance.attachMedia(video);
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
                hlsInstance.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        showTvboxError('HLS 播放失败：' + (data.details || '未知错误'));
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = resolved.url;
                video.play().catch(() => {});
            } else {
                showTvboxError('浏览器不支持 HLS 播放');
            }
        } else {
            video.src = resolved.url;
            video.play().catch(() => {});
        }

        video.onerror = () => {
            showTvboxError('视频加载失败，可能源不可用或跨域限制');
        };

    } catch (err) {
        showTvboxError(err.message);
    }
}

function showTvboxError(msg) {
    document.getElementById('tvboxLoading').style.display = 'none';
    document.getElementById('tvboxErrorDesc').textContent = msg;
    document.getElementById('tvboxPlayerError').style.display = 'flex';
}

function retryTvboxPlay() {
    document.getElementById('tvboxPlayerError').style.display = 'none';
    playEpisode(currentEpIndex);
}

function renderPlayerEpisodes(activeIndex) {
    if (!currentDetail) return;
    const list = document.getElementById('playerEpisodeList');
    list.innerHTML = currentDetail.episodes.map((ep, i) => `
        <button class="ep-btn ${i === activeIndex ? 'active' : ''}" onclick="playEpisode(${i})">${ep.ep}</button>
    `).join('');
}

function hidePlayer() {
    document.getElementById('playerModal').style.display = 'none';
    const video = document.getElementById('tvboxPlayer');
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
}

// ========== 配置管理 ==========
function showConfigPanel() {
    document.getElementById('configPanel').style.display = 'flex';
    renderConfigList();
}

function hideConfigPanel() {
    document.getElementById('configPanel').style.display = 'none';
}

function addConfig() {
    const url = document.getElementById('newConfigUrl').value.trim();
    const name = document.getElementById('newConfigName').value.trim();
    if (!url) { showToast('请输入配置地址'); return; }

    if (TVBoxStore.addConfig(url, name || url)) {
        showToast('✅ 已添加');
        document.getElementById('newConfigUrl').value = '';
        document.getElementById('newConfigName').value = '';
        renderConfigList();
    } else {
        showToast('该源已存在');
    }
}

function addPreset(url, name) {
    if (TVBoxStore.addConfig(url, name)) {
        showToast(`✅ 已添加: ${name}`);
        renderConfigList();
    } else {
        showToast('该源已存在');
    }
}

function removeConfig(url) {
    TVBoxStore.removeConfig(url);
    renderConfigList();
    if (TVBoxStore.getConfigs().length === 0) {
        renderSites([]);
    } else {
        initTVBox();
    }
}

function activateConfig(url) {
    loadConfig(url);
    hideConfigPanel();
}

function renderConfigList() {
    const configs = TVBoxStore.getConfigs();
    const active = TVBoxStore.getActiveConfig();
    const container = document.getElementById('configList');

    if (configs.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">暂无配置源</p>';
        return;
    }

    container.innerHTML = configs.map(c => `
        <div class="config-item ${c.url === active?.url ? 'active' : ''}">
            <div class="config-item-info">
                <div class="config-item-name">${c.name}</div>
                <div class="config-item-url">${c.url}</div>
                ${c.sites ? `<div class="config-item-sites">${c.sites.length} 个站点</div>` : ''}
            </div>
            <div class="config-item-actions">
                <button class="btn-text" onclick="activateConfig('${c.url}')">使用</button>
                <button class="btn-text danger" onclick="removeConfig('${c.url}')">删除</button>
            </div>
        </div>
    `).join('');
}

// ========== 历史 ==========
function renderHistory() {
    const history = TVBoxStore.getHistory();
    const container = document.getElementById('historyList');

    if (history.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;padding:12px">暂无观看历史</p>';
        document.getElementById('historySection').style.display = 'block';
        return;
    }

    container.innerHTML = history.slice(0, 10).map(h => `
        <div class="history-item" onclick="resumeWatch('${h.siteKey}', '${h.videoId}', ${h.epIndex})">
            <span class="history-name">${h.name}</span>
            <span class="history-ep">${h.ep}</span>
            <span class="history-time">${formatTimeAgo(h.time)}</span>
        </div>
    `).join('');
}

async function resumeWatch(siteKey, videoId, epIndex) {
    await showDetail(siteKey, videoId);
    setTimeout(() => playEpisode(epIndex), 500);
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (day > 0) return `${day}天前`;
    if (hour > 0) return `${hour}小时前`;
    if (min > 0) return `${min}分钟前`;
    return '刚刚';
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', initTVBox);
