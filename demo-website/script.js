const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const resultCount = document.getElementById('resultCount');
const movieTitle = document.getElementById('movieTitle');
const metaSmall = document.getElementById('metaSmall');
const subtitleSelect = document.getElementById('subtitleSelect');
const videoPlayer = document.getElementById('videoPlayer');

const defaultSubjectId = '4757760137329361264';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

function formatQuality(value) {
  if (!value) return 'Unknown';
  return value.includes('p') ? value : `${value}p`;
}

function getPlayableStream(streams) {
  const directMp4 = streams.find((stream) => (stream.format || '').toUpperCase() === 'MP4' || stream.url?.endsWith('.mp4'));
  if (directMp4) return directMp4;
  return streams[0] || null;
}

function renderResults(items) {
  resultsGrid.innerHTML = '';

  if (!items.length) {
    resultsGrid.innerHTML = '<div class="empty">No results found</div>';
    resultCount.textContent = '0';
    return;
  }

  resultCount.textContent = String(items.length);

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.innerHTML = `
      <img src="${item.cover || 'https://placehold.co/500x750/111827/ffffff?text=Movie'}" alt="${item.title}" />
      <div class="card-body">
        <h4>${item.title}</h4>
        <div class="card-meta">
          <span>${item.type || 'Movie'}</span>
          <span>${item.release_date ? item.release_date.slice(0, 4) : 'N/A'}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => selectMovie(item.subject_id));
    resultsGrid.appendChild(card);
  });
}

async function loadSearch(query) {
  try {
    const data = await fetchJson(`/search?q=${encodeURIComponent(query)}`);
    renderResults(data.results || []);

    if (data.results?.length) {
      await selectMovie(data.results[0].subject_id);
    }
  } catch (error) {
    console.error(error);
    resultsGrid.innerHTML = '<div class="empty">Unable to load results.</div>';
  }
}

async function selectMovie(subjectId) {
  try {
    const [detail, streamRes] = await Promise.all([
      fetchJson(`/detail/${subjectId}`),
      fetchJson(`/api/stream/${subjectId}`),
    ]);

    movieTitle.textContent = detail.title || 'Movie';
    metaSmall.textContent = `${detail.type || 'Movie'} • ${detail.release_date || 'N/A'} • IMDb ${detail.imdb_rating || 'N/A'}`;

    if (detail.cover) {
      videoPlayer.poster = detail.cover;
    }

    const streams = (streamRes.streams || []).filter((stream) => !stream.url?.includes('.m3u8'));
    const playable = getPlayableStream(streams);
    const captionsData = await fetchJson(`/api/stream/${subjectId}/captions`).catch(() => ({ captions: [] }));

    subtitleSelect.innerHTML = '<option value="">Subtitles Off</option>';
    (captionsData.captions || []).forEach((sub) => {
      const option = document.createElement('option');
      option.value = sub.url ? `/api/proxy/caption?url=${encodeURIComponent(sub.url)}` : '';
      option.textContent = `${sub.language} ${sub.code ? `(${sub.code})` : ''}`;
      subtitleSelect.appendChild(option);
    });

    const streamList = document.createElement('div');
    streamList.className = 'stream-list';

    streams.forEach((stream) => {
      const item = document.createElement('div');
      item.className = 'stream-item';

      item.innerHTML = `
        <div class="stream-left">
          <span class="stream-pill">${stream.format || 'MP4'}</span>
          <strong>${formatQuality(stream.quality)}</strong>
          <small>${stream.source}</small>
        </div>
        <div class="stream-btns">
          <button class="stream-btn primary" data-url="${encodeURIComponent(stream.url)}">Play</button>
          <a class="stream-btn" href="/api/proxy/stream?url=${encodeURIComponent(stream.url)}" target="_blank" rel="noreferrer">Open</a>
        </div>
      `;

      item.querySelector('.stream-btn.primary').addEventListener('click', () => {
        const proxyUrl = `/api/proxy/stream?url=${encodeURIComponent(stream.url)}`;
        videoPlayer.src = proxyUrl;
        videoPlayer.load();
        videoPlayer.play().catch(() => {});
      });

      streamList.appendChild(item);
    });

    if (playable) {
      const proxyUrl = `/api/proxy/stream?url=${encodeURIComponent(playable.url)}`;
      videoPlayer.src = proxyUrl;
      videoPlayer.load();
    }

    const oldList = document.querySelector('.stream-list');
    if (oldList) oldList.remove();
    videoPlayer.insertAdjacentElement('afterend', streamList);
  } catch (error) {
    console.error(error);
    movieTitle.textContent = 'Stream unavailable';
    metaSmall.textContent = 'Unable to fetch details';
  }
}

subtitleSelect.addEventListener('change', () => {
  if (!subtitleSelect.value) {
    Array.from(videoPlayer.querySelectorAll('track')).forEach((track) => track.remove());
    return;
  }

  Array.from(videoPlayer.querySelectorAll('track')).forEach((track) => track.remove());
  const track = document.createElement('track');
  track.kind = 'captions';
  track.label = 'Subtitle';
  track.srclang = 'en';
  track.default = true;
  track.src = subtitleSelect.value;
  videoPlayer.appendChild(track);
});

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) loadSearch(query);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const query = searchInput.value.trim();
    if (query) loadSearch(query);
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    searchInput.value = chip.dataset.query;
    loadSearch(chip.dataset.query);
  });
});

videoPlayer.crossOrigin = 'anonymous';
loadSearch('Avatar');
selectMovie(defaultSubjectId);
