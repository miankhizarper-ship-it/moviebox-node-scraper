import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,User-Agent,Referer,X-Client-Info,X-Request-Lang,X-Vip-Restrict,X-No-High-Risk-Restrict,X-Source');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/demo', express.static(path.join(__dirname, 'demo-website')));

const SECRET_KEY_DEFAULT_B64 = 'NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==';
const SECRET_KEY_ALT_B64 = 'WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==';
const MODERN_USER_AGENT = 'com.community.mbox.in/50020130 (Linux; U; Android 14; en_IN; Pixel 8; Build/UD1A.230803.041; Cronet/145.0.7582.0)';
const WEB_USER_AGENT = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36';
const API_BASE = 'https://h5-api.aoneroom.com/wefeed-h5api-bff';
const NATIVE_API_BASE = 'https://api3.aoneroom.com';
const BOOTSTRAP_URL = 'https://apig.inmoviebox.com/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1';
const WEB_DOMAINS = ['https://123moviesfree.club', 'https://movie-box.co', 'https://movieboxonline.net', 'https://sflix.film', 'https://h5-api.aoneroom.com', 'https://netnaija.film', 'https://movieboxhd.net'];

async function proxyRemoteResponse(req, res, targetUrl, fallbackMime = 'application/octet-stream') {
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url' });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': WEB_USER_AGENT,
        Accept: '*/*',
        Referer: 'https://moviebox.ph/',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Stream fetch failed: ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || fallbackMime;
    const contentLength = upstream.headers.get('content-length');
    const contentDisposition = upstream.headers.get('content-disposition');

    res.status(200);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error('proxyRemoteResponse failed:', error);
    return res.status(500).json({ error: 'Failed to proxy remote source' });
  }
}

app.get('/api/proxy/stream', async (req, res) => {
  const targetUrl = req.query.url;
  return proxyRemoteResponse(req, res, targetUrl, 'video/mp4');
});

app.get('/api/proxy/caption', async (req, res) => {
  const targetUrl = req.query.url;
  return proxyRemoteResponse(req, res, targetUrl, 'text/vtt');
});

function b64Decode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + pad, 'base64');
}

function md5Hex(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

function generateDeviceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateXClientToken(timestamp) {
  const ts = String(timestamp);
  const reversed = ts.split('').reverse().join('');
  return `${ts},${md5Hex(Buffer.from(reversed, 'utf8'))}`;
}

function generateClientInfo(deviceId) {
  return JSON.stringify({
    package_name: 'com.community.mbox.in',
    version_name: '4.0.03.0920.03',
    version_code: 50020130,
    os: 'android',
    os_version: '14',
    device_id: deviceId,
    install_store: 'official',
    gaid: '1b2212c1-dadf-43c3-a0c8-bd6ce48ae22d',
    brand: 'Google',
    model: 'Pixel 8',
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'IN',
    timezone: 'Asia/Calcutta',
    sp_code: '',
  });
}

function getSecretBytes(useAlt = false) {
  const outer = useAlt ? SECRET_KEY_ALT_B64 : SECRET_KEY_DEFAULT_B64;
  const inner = b64Decode(outer).toString('utf8');
  return b64Decode(inner);
}

function buildCanonicalString(method, accept, contentType, url, body, timestamp) {
  const parsed = new URL(url);
  const pathName = parsed.pathname || '/';
  let canonicalUrl = pathName;

  if (parsed.search) {
    const pairs = [];
    for (const part of parsed.search.slice(1).split('&')) {
      if (!part) continue;
      const [key, rawValue = ''] = part.split('=');
      pairs.push([key, rawValue]);
    }
    pairs.sort(([a], [b]) => a.localeCompare(b));
    canonicalUrl = `${pathName}?${pairs.map(([k, v]) => `${k}=${v}`).join('&')}`;
  }

  const bodyBytes = body ? Buffer.from(body, 'utf8') : null;
  const bodyLength = bodyBytes ? String(bodyBytes.length) : '';
  const bodyHash = bodyBytes ? md5Hex(bodyBytes.subarray(0, 102400)) : '';

  return [
    String(method).toUpperCase(),
    accept || '',
    contentType || '',
    bodyLength,
    String(timestamp),
    bodyHash,
    canonicalUrl,
  ].join('\n');
}

function generateXTrSignature(method, accept, contentType, url, body, timestamp, useAlt = false) {
  const canonical = buildCanonicalString(method, accept, contentType, url, body, timestamp);
  const key = getSecretBytes(useAlt);
  const digest = crypto.createHmac('md5', key).update(canonical, 'utf8').digest();
  const sigB64 = digest.toString('base64');
  return `${timestamp}|2|${sigB64}`;
}

function buildAuthHeaders(method, url, body = null, token = null, deviceId = null, useAlt = false) {
  const timestamp = Date.now();
  const devId = deviceId || generateDeviceId();
  const headers = {
    'user-agent': MODERN_USER_AGENT,
    accept: 'application/json',
    'content-type': 'application/json',
    connection: 'keep-alive',
    'x-client-token': generateXClientToken(timestamp),
    'x-tr-signature': generateXTrSignature(method, 'application/json', 'application/json', url, body, timestamp, useAlt),
    'x-client-info': generateClientInfo(devId),
    'x-client-status': '0',
  };

  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function extractPolicyResource(signCookie) {
  if (!signCookie) return null;

  const edgeMatch = signCookie.match(/Edge-Cache-Cookie=urlprefix=([^:;\s]+)/);
  if (edgeMatch) {
    try {
      const decoded = b64Decode(edgeMatch[1]).toString('utf8').replace(/\/+$/, '');
      return `${decoded}/index.mpd`;
    } catch {
      // ignore
    }
  }

  const cfMatch = signCookie.match(/CloudFront-Policy=([^;]+)/);
  if (cfMatch) {
    const raw = cfMatch[1];
    for (const kind of ['cf', 'std']) {
      try {
        const base = kind === 'cf' ? raw.replace(/-/g, '+').replace(/_/g, '=') : raw;
        const padded = base + '='.repeat((4 - (base.length % 4)) % 4);
        const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        for (const statement of parsed.Statement || []) {
          if (statement.Resource) {
            return `${String(statement.Resource).replace(/\*+$/, '').replace(/\/+$/, '')}/index.mpd`;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

class MovieBoxEngine {
  constructor() {
    this.deviceId = generateDeviceId();
    this.bearerToken = null;
  }

  async bootstrapToken(force = false) {
    if (this.bearerToken && !force) return this.bearerToken;

    const headers = buildAuthHeaders('GET', BOOTSTRAP_URL, null, null, this.deviceId, false);
    const response = await fetch(BOOTSTRAP_URL, { method: 'GET', headers });
    const xUser = response.headers.get('x-user');
    if (!xUser) {
      const error = new Error('Failed to bootstrap MovieBox token');
      error.statusCode = 502;
      throw error;
    }

    const tokenData = JSON.parse(xUser);
    const token = tokenData?.token;
    if (!token) {
      const error = new Error('Empty token in upstream header');
      error.statusCode = 502;
      throw error;
    }

    this.bearerToken = token;
    return token;
  }

  async apiRequest(method, pathOrUrl, bodyDict = null, useToken = true, retryAuth = true) {
    const fullUrl = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${NATIVE_API_BASE}${pathOrUrl}`;

    if (useToken && !this.bearerToken) {
      await this.bootstrapToken();
    }

    const bodyStr = bodyDict !== null && bodyDict !== undefined ? JSON.stringify(bodyDict) : null;
    const headers = buildAuthHeaders(method, fullUrl, bodyStr, useToken ? this.bearerToken : null, this.deviceId, false);

    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers,
      body: method.toUpperCase() === 'POST' && bodyStr ? bodyStr : undefined,
    });

    if ([401, 441].includes(response.status) && retryAuth) {
      await this.bootstrapToken(true);
      return this.apiRequest(method, pathOrUrl, bodyDict, useToken, false);
    }

    if (response.status !== 200) {
      const error = new Error(`API returned HTTP ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    return response.json();
  }

  async search(query, page = 1, perPage = 20) {
    const payload = { keyword: query, page, perPage };
    const data = await this.apiRequest('POST', '/wefeed-mobile-bff/subject-api/search', payload).then((body) => body?.data || {});
    const rawItems = data.items || data.list || [];

    return rawItems.map((item) => {
      const sub = item.subject || item;
      return {
        subject_id: String(sub.subjectId ?? ''),
        title: sub.title,
        type: sub.subjectType === 1 ? 'Movie' : 'Series',
        subject_type: sub.subjectType,
        release_date: sub.releaseDate,
        imdb_rating: sub.imdbRatingValue,
        genre: sub.genre,
        cover: sub.cover && typeof sub.cover === 'object' ? sub.cover.url : null,
        detail_path: sub.detailPath,
        language: sub.language,
      };
    });
  }

  async getDetails(subjectId) {
    const data = await this.apiRequest('GET', `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`).then((body) => body?.data || {});
    const detailUrl = data.detailUrl || '';
    const detailPath = detailUrl.includes('/') ? detailUrl.split('/').pop() : detailUrl;

    return {
      subject_id: String(data.subjectId ?? ''),
      title: data.title,
      subject_type: data.subjectType,
      type: data.subjectType === 1 ? 'Movie' : 'Series',
      description: data.description,
      release_date: data.releaseDate,
      duration: data.duration,
      imdb_rating: data.imdbRatingValue,
      genre: data.genre,
      country: data.countryName,
      language: data.language,
      cover: data.cover && typeof data.cover === 'object' ? data.cover.url : null,
      detail_path: detailPath,
      dubs: (data.dubs || []).filter(Boolean).map((dub) => ({
        subject_id: String(dub.subjectId ?? ''),
        lang_name: dub.lanName,
        language: dub.language,
      })),
    };
  }

  async getEpisodes(subjectId) {
    const res = await this.apiRequest('GET', `/wefeed-mobile-bff/subject-api/season-info?subjectId=${subjectId}`);
    const seasons = res?.data?.seasons || [];
    return seasons.map((season) => ({
      season: season.se ?? 1,
      episode_count: season.maxEp ?? 1,
      resolutions: season.resolutions || [],
    }));
  }

  async getStreams(subjectId, season = 0, episode = 0, detailPath = null) {
    let resolvedDetailPath = detailPath;
    if (!resolvedDetailPath) {
      try {
        const details = await this.getDetails(subjectId);
        resolvedDetailPath = details.detail_path || '';
      } catch {
        resolvedDetailPath = '';
      }
    }

    const token = await this.bootstrapToken();
    const streams = [];
    const seen = new Set();

    for (const domain of WEB_DOMAINS) {
      const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${subjectId}&se=${season}&ep=${episode}&detailPath=${resolvedDetailPath}&streamSignType=1&supportCodecs%5Bhevc%5D=1&supportCodecs%5Bh264%5D=1`;
      const referer = `${domain}/movies/${resolvedDetailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`;

      try {
        const response = await fetch(playUrl, {
          method: 'GET',
          headers: {
            'User-Agent': WEB_USER_AGENT,
            Referer: referer,
            Accept: 'application/json',
            'x-client-info': '{"timezone":"Asia/Calcutta"}',
            'x-request-lang': 'en',
            'x-vip-restrict': '0',
            'x-no-high-risk-restrict': '0',
            'x-source': 'moviebox',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status !== 200) continue;

        const data = await response.json();
        const rawStreams = data?.data?.streams || [];
        const dashItems = data?.data?.dash || [];

        if (!rawStreams.length && !dashItems.length) continue;

        for (const st of rawStreams) {
          const url = st.url;
          if (!url || seen.has(url)) continue;
          seen.add(url);

          const resStr = String(st.resolutions || 'unknown');
          const sizeBytes = Number(st.size || 0);
          const sizeMb = sizeBytes ? sizeBytes / (1024 * 1024) : 0;
          let qualityValue = 0;

          for (const q of [2160, 1440, 1080, 720, 480, 360, 240]) {
            if (resStr.includes(String(q))) {
              qualityValue = q;
              break;
            }
          }

          streams.push({
            source: `Web CDN (${domain})`,
            format: st.format || 'MP4',
            quality: qualityValue ? `${qualityValue}p` : resStr,
            quality_value: qualityValue,
            resolution_tag: resStr,
            url,
            size_mb: Number(sizeMb.toFixed(1)),
            codec: st.codecName,
            duration_sec: st.duration,
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Referer: `${domain}/`,
              Origin: domain,
            },
          });
        }

        for (const d of dashItems) {
          const url = d.url;
          const cookie = d.signCookie;
          const extractedMpd = cookie ? extractPolicyResource(cookie) : null;
          const finalUrl = extractedMpd || url;
          if (!finalUrl || seen.has(finalUrl)) continue;
          seen.add(finalUrl);

          const resTag = String(d.resolutions || 'adaptive');
          streams.push({
            source: `Web DASH (${domain})`,
            format: 'DASH',
            quality: resTag.includes('1080') ? '1080p (Adaptive)' : 'Adaptive',
            quality_value: resTag.includes('1080') ? 1080 : 999,
            resolution_tag: resTag,
            url: finalUrl,
            size_mb: 0,
            codec: 'hevc/h264',
            duration_sec: null,
            cookie,
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Referer: `${domain}/`,
              Origin: domain,
            },
          });
        }

        break;
      } catch {
        // ignore
      }
    }

    try {
      const nativeUrl = `/wefeed-mobile-bff/subject-api/play-info?subjectId=${subjectId}&se=${season}&ep=${episode}`;
      const nativeData = await this.apiRequest('GET', nativeUrl).then((body) => body?.data || {});
      for (const st of nativeData.streams || []) {
        const rawUrl = st.url;
        if (!rawUrl || rawUrl.includes('b164fbfb4347792950bdfbfb563d39d9')) continue;

        const cookie = st.signCookie;
        const policyUrl = cookie ? extractPolicyResource(cookie) : null;
        const finalUrl = policyUrl || rawUrl;
        if (seen.has(finalUrl)) continue;
        seen.add(finalUrl);

        const resStr = String(st.resolutions || '');
        let qualityValue = 0;
        for (const q of [2160, 1440, 1080, 720, 480, 360, 240]) {
          if (resStr.includes(String(q))) {
            qualityValue = q;
            break;
          }
        }

        const sizeBytes = Number(st.size || 0);
        const sizeMb = sizeBytes ? sizeBytes / (1024 * 1024) : 0;

        streams.push({
          source: 'Mobile Native CDN',
          format: policyUrl || finalUrl.includes('.mpd') ? 'DASH' : st.format || 'MP4',
          quality: qualityValue ? `${qualityValue}p` : resStr || 'Default',
          quality_value: qualityValue,
          resolution_tag: resStr,
          url: finalUrl,
          size_mb: Number(sizeMb.toFixed(1)),
          codec: st.codecName,
          duration_sec: st.duration,
          headers: {
            'User-Agent': MODERN_USER_AGENT,
            Referer: 'https://api3.aoneroom.com/',
          },
        });
      }
    } catch {
      // ignore
    }

    streams.sort((a, b) => (b.quality_value || 0) - (a.quality_value || 0));
    return streams;
  }

  async getSubtitles(subjectId, streamId = null, season = 0, episode = 0) {
    let resolvedStreamId = streamId;
    if (!resolvedStreamId) {
      try {
        const nativeUrl = `/wefeed-mobile-bff/subject-api/play-info?subjectId=${subjectId}&se=${season}&ep=${episode}`;
        const rawStreams = await this.apiRequest('GET', nativeUrl).then((body) => body?.data?.streams || []);
        if (rawStreams[0]?.id) resolvedStreamId = String(rawStreams[0].id);
      } catch {
        // ignore
      }
    }

    const subs = [];
    const seen = new Set();

    const addSub = (item) => {
      const url = item?.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      subs.push({
        id: String(item.id || ''),
        language: item.lanName || item.language || 'English',
        code: item.lan || '',
        url,
        size: item.size,
      });
    };

    if (resolvedStreamId) {
      try {
        const url = `/wefeed-mobile-bff/subject-api/get-stream-captions?subjectId=${subjectId}&streamId=${resolvedStreamId}`;
        const data = await this.apiRequest('GET', url).then((body) => body?.data || []);
        const captions = Array.isArray(data) ? data : data.extCaptions || data.captions || [];
        for (const caption of captions) {
          if (caption && typeof caption === 'object') addSub(caption);
        }
      } catch {
        // ignore
      }
    }

    try {
      const resourceId = resolvedStreamId || '0';
      const url = `/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=${subjectId}&resourceId=${resourceId}&episode=${episode}`;
      const data = await this.apiRequest('GET', url).then((body) => body?.data || []);
      const ext = Array.isArray(data) ? data : data.extCaptions || data.captions || [];
      for (const caption of ext) {
        if (caption && typeof caption === 'object') addSub(caption);
      }
    } catch {
      // ignore
    }

    return subs;
  }

  async searchSuggest(query) {
    const response = await fetch(`${API_BASE}/subject/search-suggest`, {
      method: 'POST',
      headers: {
        'User-Agent': WEB_USER_AGENT,
        Referer: 'https://moviebox.ph/',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword: query, perPage: 10 }),
    });

    const data = await response.json().catch(() => ({}));
    const raw = data?.data?.items || [];
    return raw.map((item) => {
      const sub = item.subject || {};
      return {
        title: sub.title || item.word || item.title,
        slug: sub.detailPath || item.detailPath,
        subject_id: String(sub.subjectId || item.subjectId || ''),
      };
    });
  }
}

const engine = new MovieBoxEngine();

app.get('/', (req, res) => {
  res.redirect('/demo');
});

app.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.per_page || req.query.perPage || 20);

  try {
    const results = await engine.search(q, page, perPage);
    res.json({ query: q, page, results });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Search failed' });
  }
});

app.get('/search/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const suggestions = await engine.searchSuggest(q);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Suggest failed' });
  }
});

app.get('/detail/:subject_id', async (req, res) => {
  try {
    const data = await engine.getDetails(req.params.subject_id);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get details' });
  }
});

app.get('/episodes/:subject_id', async (req, res) => {
  try {
    const seasons = await engine.getEpisodes(req.params.subject_id);
    res.json({ subject_id: req.params.subject_id, seasons });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get episodes' });
  }
});

app.get('/api/stream/:subject_id', async (req, res) => {
  try {
    const subjectId = req.params.subject_id;
    const season = Number(req.query.se || 0);
    const episode = Number(req.query.ep || 0);
    const detailPath = req.query.detail_path || null;

    const streams = await engine.getStreams(subjectId, season, episode, detailPath);
    res.json({ subject_id: subjectId, season, episode, count: streams.length, streams });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to resolve streams' });
  }
});

app.get('/api/stream/:subject_id/captions', async (req, res) => {
  try {
    const subjectId = req.params.subject_id;
    const season = Number(req.query.se || 0);
    const episode = Number(req.query.ep || 0);
    const streamId = req.query.stream_id || null;

    const captions = await engine.getSubtitles(subjectId, streamId, season, episode);
    res.json({ subject_id: subjectId, season, episode, count: captions.length, captions });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch captions' });
  }
});

app.get('/movies', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || req.query.perPage || 24);
    const sort = req.query.sort || 'RECOMMEND';

    const response = await fetch(`${API_BASE}/subject/filter`, {
      method: 'POST',
      headers: {
        'User-Agent': WEB_USER_AGENT,
        Referer: 'https://moviebox.ph/',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tabId: 2,
        filter: { sort, genre: 'ALL', country: 'ALL', year: 'ALL', language: 'ALL' },
        page,
        perPage,
      }),
    });

    const data = await response.json().catch(() => ({}));
    const raw = data?.data?.items || data?.data?.subjects || [];

    res.json({
      page,
      per_page: perPage,
      total: data?.data?.pager?.totalCount || raw.length,
      items: raw.map((item) => ({
        title: item.title,
        subject_id: String(item.subjectId ?? ''),
        detail_path: item.detailPath,
        cover: item.cover && typeof item.cover === 'object' ? item.cover.url : null,
        rating: item.imdbRatingValue,
        year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch movies' });
  }
});

app.get('/tv-series', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || req.query.perPage || 24);
    const sort = req.query.sort || 'RECOMMEND';

    const response = await fetch(`${API_BASE}/subject/filter`, {
      method: 'POST',
      headers: {
        'User-Agent': WEB_USER_AGENT,
        Referer: 'https://moviebox.ph/',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tabId: 5,
        filter: { sort, genre: 'ALL', country: 'ALL', year: 'ALL', language: 'ALL' },
        page,
        perPage,
      }),
    });

    const data = await response.json().catch(() => ({}));
    const raw = data?.data?.items || data?.data?.subjects || [];

    res.json({
      page,
      per_page: perPage,
      total: data?.data?.pager?.totalCount || raw.length,
      items: raw.map((item) => ({
        title: item.title,
        subject_id: String(item.subjectId ?? ''),
        detail_path: item.detailPath,
        cover: item.cover && typeof item.cover === 'object' ? item.cover.url : null,
        rating: item.imdbRatingValue,
        year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch TV series' });
  }
});

app.get('/home', async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/home?host=moviebox.ph`, {
      method: 'GET',
      headers: {
        'User-Agent': WEB_USER_AGENT,
        Referer: 'https://moviebox.ph/',
        Accept: 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to fetch home feed' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`MovieBox API running on http://localhost:${port}`);
});
