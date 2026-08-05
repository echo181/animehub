/**
 * TVBox 引擎 - 核心逻辑
 * 支持 TVBox JSON 配置源，通过 CORS 代理转发请求
 */

// ========== CORS 代理多路回退 ==========
// 按优先级排列，自动逐个尝试
const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url) => `https://proxy.cors.sh/${url}`,
    (url) => url // 直连尝试（某些 API 可能已支持 CORS）
];

let currentProxyIndex = 0;

async function fetchWithProxy(url, options = {}) {
    let lastError = null;
    let errors = [];
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxyIdx = (currentProxyIndex + i) % CORS_PROXIES.length;
        const proxyUrl = CORS_PROXIES[proxyIdx](url);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            const resp = await fetch(proxyUrl, { ...options, signal: controller.signal });
            clearTimeout(timeout);
            if (resp.ok) {
                currentProxyIndex = proxyIdx;
                return resp;
            }
            errors.push(`代理${proxyIdx}: HTTP ${resp.status}`);
            lastError = new Error(`HTTP ${resp.status}`);
        } catch (err) {
            errors.push(`代理${proxyIdx}: ${err.message || 'timeout'}`);
            lastError = err;
        }
    }
    const err = new Error(`所有代理均失败: ${errors.join('; ')}`);
    err.details = errors;
    throw err;
}

// ========== TVBox 配置管理 ==========
const TVBoxStore = {
    getConfigs() {
        try { return JSON.parse(localStorage.getItem('tvbox_configs') || '[]'); }
        catch { return []; }
    },
    setConfigs(list) {
        localStorage.setItem('tvbox_configs', JSON.stringify(list));
    },
    addConfig(url, name) {
        const configs = this.getConfigs();
        if (configs.find(c => c.url === url)) return false;
        configs.push({ url, name: name || url, addedAt: Date.now(), sites: null });
        this.setConfigs(configs);
        return true;
    },
    removeConfig(url) {
        const configs = this.getConfigs().filter(c => c.url !== url);
        this.setConfigs(configs);
    },
    getActiveConfig() {
        const activeUrl = localStorage.getItem('tvbox_active');
        const configs = this.getConfigs();
        return configs.find(c => c.url === activeUrl) || configs[0] || null;
    },
    setActive(url) {
        localStorage.setItem('tvbox_active', url);
    },
    getHistory() {
        try { return JSON.parse(localStorage.getItem('tvbox_history') || '[]'); }
        catch { return []; }
    },
    addHistory(item) {
        let history = this.getHistory();
        history = history.filter(h => h.id !== item.id);
        history.unshift(item);
        history = history.slice(0, 50);
        localStorage.setItem('tvbox_history', JSON.stringify(history));
    }
};

// ========== TVBox 引擎 ==========
let TVBoxEngine = {
    config: null,
    sites: [],
    parses: [],

    async loadConfig(configUrl) {
        const resp = await fetchWithProxy(configUrl);
        const text = await resp.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('配置文件不是有效的 JSON 格式');
        }

        this.sites = (data.sites || []).filter(s => s.type !== 3);
        this.parses = data.parses || [];
        this.lives = data.lives || [];

        const config = TVBoxStore.getActiveConfig();
        if (config) {
            config.sites = this.sites.map(s => ({ key: s.key, name: s.name, type: s.type }));
            config.parses = this.parses;
            TVBoxStore.setConfigs(TVBoxStore.getConfigs());
        }

        return { sites: this.sites, parses: this.parses };
    },

    async search(keyword, siteKey) {
        const site = this.sites.find(s => s.key === siteKey);
        if (!site) throw new Error('找不到该影视源');

        let apiUrl;
        if (site.type === 1) {
            apiUrl = `${site.api}?wd=${encodeURIComponent(keyword)}&quick=false`;
        } else {
            apiUrl = `${site.api}?wd=${encodeURIComponent(keyword)}`;
        }

        const resp = await fetchWithProxy(apiUrl);
        const text = await resp.text();

        if (site.type === 1) {
            return this.parseJsonSearch(text, site);
        } else {
            return this.parseXmlSearch(text, site);
        }
    },

    parseJsonSearch(text, site) {
        try {
            const data = JSON.parse(text);
            const list = data.list || [];
            return list.map(item => ({
                id: item.vod_id,
                name: item.vod_name,
                pic: item.vod_pic,
                remarks: item.vod_remarks || '',
                siteKey: site.key,
                siteName: site.name
            }));
        } catch {
            return [];
        }
    },

    parseXmlSearch(text, site) {
        try {
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const items = xml.querySelectorAll('list > video, rss > list > video');
            return Array.from(items).map(item => ({
                id: item.querySelector('id')?.textContent?.trim() || '',
                name: item.querySelector('name')?.textContent?.trim() || '',
                pic: item.querySelector('pic')?.textContent?.trim() || '',
                remarks: item.querySelector('note')?.textContent?.trim() || '',
                siteKey: site.key,
                siteName: site.name
            }));
        } catch {
            return [];
        }
    },

    async getDetail(siteKey, videoId) {
        const site = this.sites.find(s => s.key === siteKey);
        if (!site) throw new Error('找不到该影视源');

        let apiUrl;
        if (site.type === 1) {
            apiUrl = `${site.api}?ac=detail&ids=${encodeURIComponent(videoId)}`;
        } else {
            apiUrl = `${site.api}?ac=videolist&ids=${encodeURIComponent(videoId)}`;
        }

        const resp = await fetchWithProxy(apiUrl);
        const text = await resp.text();

        let detail;
        if (site.type === 1) {
            detail = this.parseJsonDetail(text);
        } else {
            detail = this.parseXmlDetail(text);
        }

        detail.siteKey = site.key;
        detail.siteName = site.name;
        return detail;
    },

    parseJsonDetail(text) {
        const data = JSON.parse(text);
        const item = (data.list || [])[0] || {};
        const playUrl = item.vod_play_url || '';
        const episodes = this.parsePlayUrl(playUrl);
        return {
            id: item.vod_id,
            name: item.vod_name,
            pic: item.vod_pic,
            desc: item.vod_content || item.vod_blurb || '',
            year: item.vod_year,
            area: item.vod_area,
            actor: item.vod_actor,
            director: item.vod_director,
            category: item.type_name,
            episodes
        };
    },

    parseXmlDetail(text) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const video = xml.querySelector('video') || xml.querySelector('list > video');
        if (!video) return { episodes: [] };
        const playUrl = video.querySelector('dl > dd')?.textContent?.trim() || '';
        const episodes = this.parsePlayUrl(playUrl);
        return {
            id: video.querySelector('id')?.textContent?.trim(),
            name: video.querySelector('name')?.textContent?.trim(),
            pic: video.querySelector('pic')?.textContent?.trim(),
            desc: video.querySelector('des')?.textContent?.trim() || '',
            year: video.querySelector('year')?.textContent?.trim(),
            area: video.querySelector('area')?.textContent?.trim(),
            actor: video.querySelector('actor')?.textContent?.trim(),
            director: video.querySelector('director')?.textContent?.trim(),
            category: video.querySelector('type')?.textContent?.trim(),
            episodes
        };
    },

    parsePlayUrl(playUrl) {
        if (!playUrl) return [];
        const episodes = [];
        const groups = playUrl.split('#');
        for (const group of groups) {
            const parts = group.split('$');
            if (parts.length >= 2) {
                episodes.push({
                    ep: episodes.length + 1,
                    title: parts[0].trim() || `第${episodes.length + 1}集`,
                    url: parts[1].trim()
                });
            } else if (group.trim()) {
                episodes.push({
                    ep: episodes.length + 1,
                    title: `第${episodes.length + 1}集`,
                    url: group.trim()
                });
            }
        }
        return episodes;
    },

    async getCategories(siteKey) {
        const site = this.sites.find(s => s.key === siteKey);
        if (!site) return [];

        try {
            let apiUrl;
            if (site.type === 1) {
                apiUrl = `${site.api}?ac=list`;
            } else {
                apiUrl = `${site.api}?ac=list`;
            }
            const resp = await fetchWithProxy(apiUrl);
            const text = await resp.text();

            if (site.type === 1) {
                const data = JSON.parse(text);
                return data.class || [];
            } else {
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'text/xml');
                const classes = xml.querySelectorAll('class > ty');
                return Array.from(classes).map(ty => ({
                    type_id: ty.querySelector('type_id')?.textContent?.trim(),
                    type_name: ty.querySelector('type_name')?.textContent?.trim()
                }));
            }
        } catch {
            return [];
        }
    },

    async getCategoryVideos(siteKey, typeId, page = 1) {
        const site = this.sites.find(s => s.key === siteKey);
        if (!site) return [];

        let apiUrl;
        if (site.type === 1) {
            apiUrl = `${site.api}?ac=detail&t=${typeId}&pg=${page}`;
        } else {
            apiUrl = `${site.api}?ac=videolist&t=${typeId}&pg=${page}`;
        }

        const resp = await fetchWithProxy(apiUrl);
        const text = await resp.text();

        if (site.type === 1) {
            const data = JSON.parse(text);
            return (data.list || []).map(item => ({
                id: item.vod_id,
                name: item.vod_name,
                pic: item.vod_pic,
                remarks: item.vod_remarks || '',
                siteKey: site.key,
                siteName: site.name
            }));
        } else {
            return this.parseXmlSearch(text, site);
        }
    },

    isDirectPlayUrl(url) {
        if (!url) return false;
        const lower = url.toLowerCase();
        return lower.endsWith('.m3u8') ||
               lower.endsWith('.mp4') ||
               lower.endsWith('.webm') ||
               lower.endsWith('.ogg') ||
               lower.includes('.m3u8?') ||
               lower.includes('.mp4?');
    },

    async resolvePlayUrl(url) {
        if (this.isDirectPlayUrl(url)) {
            return { url, type: 'direct' };
        }

        if (this.parses.length > 0) {
            for (const parse of this.parses) {
                try {
                    const parseUrl = parse.url + encodeURIComponent(url);
                    const resp = await fetchWithProxy(parseUrl);
                    const text = await resp.text();
                    const m3u8Match = text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i);
                    const mp4Match = text.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
                    if (m3u8Match) return { url: m3u8Match[0], type: 'hls' };
                    if (mp4Match) return { url: mp4Match[0], type: 'mp4' };
                } catch {}
            }
        }

        return { url, type: 'iframe' };
    }
};

// ========== UI 渲染辅助 ==========
function proxyImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return CORS_PROXIES[0](url);
    }
    return url;
}

window.TVBoxEngine = TVBoxEngine;
window.TVBoxStore = TVBoxStore;
window.fetchWithProxy = fetchWithProxy;
window.proxyImageUrl = proxyImageUrl;
window.CORS_PROXIES = CORS_PROXIES;
