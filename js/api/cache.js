function getApiCacheKey(name, params) {
  if (!API_CACHEABLE_METHODS[name]) return null;
  const p = params && typeof params === 'object' ? params : {};
  return API_CACHE_PREFIX + name + ':' + JSON.stringify(p);
}

function readApiCache(name, params) {
  const key = getApiCacheKey(name, params);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const at = n(parsed.at);
    if (!at || (Date.now() - at) > API_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (e) {
    return null;
  }
}

function writeApiCache(name, params, data) {
  const key = getApiCacheKey(name, params);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data }));
  } catch (e) {
    // Ignore cache write errors (quota/private mode).
  }
}
