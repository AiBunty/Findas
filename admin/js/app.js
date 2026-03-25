function resolveApiBase() {
  if (window.FINDAS_ADMIN_API) return window.FINDAS_ADMIN_API;
  const path = String(window.location.pathname || '');
  const marker = '/admin/';
  const idx = path.toLowerCase().indexOf(marker);
  if (idx >= 0) {
    return path.slice(0, idx);
  }
  return '';
}

const API_BASE = resolveApiBase();

const el = {
  menuList: document.getElementById('menuList'),
  sectionTitle: document.getElementById('sectionTitle'),
  panelBody: document.getElementById('panelBody'),
  loginOverlay: document.getElementById('loginOverlay'),
  loginForm: document.getElementById('loginForm'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  loginError: document.getElementById('loginError'),
  logoutBtn: document.getElementById('logoutBtn'),
  currentUserBadge: document.getElementById('currentUserBadge')
};

const state = {
  token: localStorage.getItem('findas_admin_token') || '',
  user: null,
  section: 'dashboard',
  editorModeBySection: {},
  integratedParentIdBySection: {},
  existingSlugOptions: null,
  sectionDataCache: {},
  sectionRenderToken: 0,
  // Phase 5: Performance & Canary
  metrics: { saves: [], modeSwaps: [], auditTimes: [], editorUsage: {} },
  featureFlags: { useSimpleEditor: true, productionCanary: false, useSimplifiedUI: true }
};

function sectionTitleFromKey(section) {
  return section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function clearDataCache() {
  state.sectionDataCache = {};
  state.existingSlugOptions = null;
}

function invalidateCache(path) {
  if (!path) return;
  delete state.sectionDataCache[path];
  if (path === '/api/admin/courses' || path === '/api/admin/webinars' || path === '/api/admin/digital-products') {
    state.existingSlugOptions = null;
  }
}

async function apiGetCached(path, forceRefresh = false) {
  if (!forceRefresh && state.sectionDataCache[path]) {
    return state.sectionDataCache[path];
  }
  const res = await api(path);
  state.sectionDataCache[path] = res;
  return res;
}

function showSectionLoading(section) {
  const title = escapeHtml(sectionTitleFromKey(section));
  el.panelBody.classList.add('is-loading');
  el.panelBody.innerHTML = `
    <div class="panel-loader" role="status" aria-live="polite">
      <div class="panel-loader-spinner" aria-hidden="true"></div>
      <p class="panel-loader-text">Loading ${title}...</p>
      <div class="panel-loader-skeleton"></div>
      <div class="panel-loader-skeleton short"></div>
      <div class="panel-loader-skeleton"></div>
    </div>
  `;
}

function hideSectionLoading() {
  el.panelBody.classList.remove('is-loading');
}

function setPanelBodyClickHandler(handler) {
  if (el.panelBody._clickHandler) {
    el.panelBody.removeEventListener('click', el.panelBody._clickHandler);
    el.panelBody._clickHandler = null;
  }
  if (typeof handler === 'function') {
    el.panelBody._clickHandler = handler;
    el.panelBody.addEventListener('click', handler);
  }
}

async function preloadAdminTabData() {
  const endpoints = new Set([
    '/api/admin/courses',
    '/api/admin/webinars',
    '/api/admin/digital-products',
    '/api/admin/academy-community',
    '/api/polls-api?action=getAllPolls'
  ]);

  Object.keys(sectionConfigs).forEach((key) => {
    const cfg = sectionConfigs[key];
    if (cfg && cfg.endpoint) {
      endpoints.add(cfg.endpoint);
    }
  });

  await Promise.allSettled(Array.from(endpoints).map((path) => apiGetCached(path)));
}

function parseSlugList(value) {
  const raw = String(value || '');
  if (!raw.trim()) return [];
  const seen = new Set();
  const out = [];
  raw.split(/[|,\n]+/).map((s) => s.trim()).forEach((s) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

function isListValueField(field) {
  const name = String(field && field.name || '').toLowerCase();
  return name === 'bullets' || name === 'file_includes';
}

function normalizeListValueForEditor(value) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  const seen = new Set();
  const items = [];
  raw.split(/[|,\r\n]+/).map((s) => s.trim()).forEach((s) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    items.push(s);
  });
  return items.join('\n');
}

function normalizeListValueForStorage(value) {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  const seen = new Set();
  const items = [];
  raw.split(/[|\r\n]+/).map((s) => s.trim()).forEach((s) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    items.push(s);
  });
  return items.join(' | ');
}

function normalizeHexColor(value, fallback = '#FFFFFF') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toUpperCase();
  }
  return fallback;
}

function parseMultilineUrls(value) {
  const raw = String(value || '');
  if (!raw.trim()) return [];
  const seen = new Set();
  const out = [];
  raw.split(/\r?\n/).map((s) => s.trim()).forEach((url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
}

async function getExistingSlugOptions() {
  if (Array.isArray(state.existingSlugOptions)) {
    return state.existingSlugOptions;
  }

  const [coursesRes, webinarsRes, digitalRes] = await Promise.all([
    api('/api/admin/courses'),
    api('/api/admin/webinars'),
    api('/api/admin/digital-products')
  ]);

  const seen = new Set();
  const options = [];
  function pushRows(rows, typeLabel) {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const slug = String(row.slug || '').trim();
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const title = String(row.title || '').trim();
      const suffix = title ? ` - ${title}` : '';
      options.push({ value: slug, label: `${slug} (${typeLabel})${suffix}` });
    });
  }

  pushRows(coursesRes.data, 'Course');
  pushRows(webinarsRes.data, 'Webinar');
  pushRows(digitalRes.data, 'Digital');

  options.sort((a, b) => a.value.localeCompare(b.value));
  state.existingSlugOptions = options;
  return options;
}

function setMultiSelectValues(selectNode, rawValue) {
  if (!selectNode) return;
  const selected = new Set(parseSlugList(rawValue));
  Array.from(selectNode.options).forEach((opt) => {
    opt.selected = selected.has(opt.value);
  });
}

async function hydrateDynamicFieldOptions(form, cfg, row) {
  if (!form || !cfg || !Array.isArray(cfg.fields)) return;
  const slugFields = cfg.fields.filter((f) => f.type === 'slug-multiselect');
  if (!slugFields.length) return;

  for (const field of slugFields) {
    const selectNode = form.elements[field.name];
    if (!selectNode) continue;

    const options = await getExistingSlugOptions();
    selectNode.innerHTML = options.map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    setMultiSelectValues(selectNode, row ? row[field.name] : '');
  }
}

const roleRank = { viewer: 1, editor: 2, owner: 3 };

const cloneEnabledSections = new Set(['courses', 'webinars', 'digital-products', 'membership']);

const sectionModeConfigs = {
  courses: {
    content: ['title', 'subtitle'],
    review: ['slug', 'category', 'language', 'thumbnail_url', 'redirect_url', 'payment_link', 'price_inr', 'order', 'is_active']
  },
  webinars: {
    content: ['title', 'subtitle', 'host_name', 'host_image_url', 'platform', 'timezone', 'start_datetime_local', 'end_datetime_local', 'primary_cta_text'],
    review: ['slug', 'banner_url', 'payment_link', 'price_inr', 'is_free', 'order', 'is_active']
  },
  'digital-products': {
    content: ['title', 'subtitle'],
    review: ['slug', 'category', 'language', 'thumbnail_url', 'preview_url', 'redirect_url', 'payment_link', 'price_inr', 'order', 'is_active']
  },
  membership: {
    content: ['title', 'description', 'features', 'target_audience', 'benefits'],
    review: ['plan_id', 'image_url', 'payment_link', 'price_inr', 'period', 'recommended', 'order', 'is_active']
  },
  'academy-sections': {
    content: ['title', 'description', 'details', 'icon_emoji'],
    review: ['order', 'is_active']
  },
  'academy-community': {
    content: ['post_type', 'content', 'author'],
    review: ['order', 'is_active']
  }
};

const structuredBuilderSections = new Set(['courses', 'webinars', 'digital-products', 'membership']);

const slugFieldBySection = {
  courses: 'slug',
  webinars: 'slug',
  'digital-products': 'slug',
  membership: 'plan_id'
};

function toSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getStructuredInputValue(form, id) {
  const node = form.querySelector(`#${id}`);
  return node ? String(node.value || '') : '';
}

function setStructuredInputValue(form, id, value) {
  const node = form.querySelector(`#${id}`);
  if (!node) return;
  node.value = String(value || '');
}

function getStructuredBuilderValues(form, section) {
  if (!structuredBuilderSections.has(section)) return null;
  return {
    description: getStructuredInputValue(form, 'structuredDescription'),
    whatLearn: getStructuredInputValue(form, 'structuredWhatLearn'),
    whoFor: getStructuredInputValue(form, 'structuredWhoFor'),
    outcome: getStructuredInputValue(form, 'structuredOutcome'),
    goDeeper: getStructuredInputValue(form, 'structuredGoDeeper')
  };
}

function hasStructuredBuilderContent(values) {
  if (!values) return false;
  return [values.description, values.whatLearn, values.whoFor, values.outcome, values.goDeeper]
    .some((v) => String(v || '').trim() !== '');
}

function renderStructuredBuilderHtml(section, disabled) {
  if (!structuredBuilderSections.has(section)) return '';
  const disabledAttr = disabled ? 'disabled' : '';
  const labels = sectionSpecificLabels[section] || sectionSpecificLabels.courses;
  
  // Placeholder text customized per section
  const placeholders = {
    courses: { whatLearn: 'What 1\nWhat 2\nWhat 3', whoFor: 'Profile 1\nProfile 2', outcome: 'Outcome 1\nOutcome 2', goDeeper: 'Resource 1\nResource 2' },
    webinars: { whatLearn: 'Takeaway 1\nTakeaway 2\nTakeaway 3', whoFor: 'Role 1\nRole 2', outcome: 'Knowledge 1\nKnowledge 2', goDeeper: 'Link 1\nLink 2' },
    'digital-products': { whatLearn: 'Included 1\nIncluded 2\nIncluded 3', whoFor: 'Use case 1\nUse case 2', outcome: 'Benefit 1\nBenefit 2', goDeeper: 'FAQ 1\nFAQ 2' },
    membership: { whatLearn: 'Feature 1\nFeature 2\nFeature 3', whoFor: 'Persona 1\nPersona 2', outcome: 'Benefit 1\nBenefit 2', goDeeper: 'Support\nAccess' }
  };
  const ph = placeholders[section] || placeholders.courses;
  
  return `
    <div class="simple-builder-group">
      <h4>Structured Content Builder</h4>
      <label class="field">
        <span>${escapeHtml(labels.description)}</span>
        <textarea id="structuredDescription" rows="5" placeholder="Main content for this item." ${disabledAttr}></textarea>
      </label>
      <label class="field">
        <span>${escapeHtml(labels.whatLearn)} (one line per point)</span>
        <textarea id="structuredWhatLearn" rows="5" placeholder="${escapeHtml(ph.whatLearn)}" ${disabledAttr}></textarea>
      </label>
      <label class="field">
        <span>${escapeHtml(labels.whoFor)} (one line per point)</span>
        <textarea id="structuredWhoFor" rows="4" placeholder="${escapeHtml(ph.whoFor)}" ${disabledAttr}></textarea>
      </label>
      <label class="field">
        <span>${escapeHtml(labels.outcome)} (one line per point)</span>
        <textarea id="structuredOutcome" rows="4" placeholder="${escapeHtml(ph.outcome)}" ${disabledAttr}></textarea>
      </label>
      <label class="field">
        <span>${escapeHtml(labels.goDeeper)} (one line per point)</span>
        <textarea id="structuredGoDeeper" rows="4" placeholder="${escapeHtml(ph.goDeeper)}" ${disabledAttr}></textarea>
      </label>
      <small>In Simple mode, these blocks are automatically mapped to detail records on save. Advanced mode remains available for full manual control.</small>
    </div>
  `;
}

function getCloneRowLabel(row) {
  const id = Number(row && row.id);
  const title = String((row && row.title) || '').trim();
  const slug = String((row && row.slug) || (row && row.plan_id) || '').trim();
  if (title && slug) return `#${id} - ${title} (${slug})`;
  if (title) return `#${id} - ${title}`;
  if (slug) return `#${id} - ${slug}`;
  return `#${id}`;
}

async function deleteRowsByFilter(endpoint, rows, predicate) {
  const selected = (Array.isArray(rows) ? rows : []).filter(predicate);
  for (const row of selected) {
    await api(`${endpoint}/${Number(row.id)}`, { method: 'DELETE' });
  }
}

async function createRows(endpoint, rows) {
  for (const row of rows) {
    await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(row)
    });
  }
}

function cleanSectionLabel(value) {
  return String(value || '')
    .replace(/\s*\(one per line\)\s*$/i, '')
    .trim();
}

function resolveSectionHeading(inputValue, fallbackValue) {
  const input = String(inputValue || '').trim();
  if (input) return input;
  return cleanSectionLabel(fallbackValue || '');
}

function defaultSimpleHeading(section, key) {
  const cfg = simplifiedSectionConfigs[section];
  if (!cfg || !cfg.labels) return '';
  return cleanSectionLabel(cfg.labels[key] || '');
}

function linePairsToFaqBullets(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) {
    const q = lines[i] || '';
    const a = lines[i + 1] || '';
    if (!q && !a) continue;
    pairs.push(`${q}::${a}`);
  }
  return pairs.join('|');
}

function faqBulletsToLinePairs(value) {
  const rows = normalizeListValueForEditor(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = [];
  rows.forEach((row) => {
    const parts = String(row).split('::');
    const q = String(parts[0] || '').trim();
    const a = String(parts.slice(1).join('::') || '').trim();
    if (q) lines.push(q);
    if (a) lines.push(a);
  });
  return lines.join('\n');
}

async function syncSimpleCoursesContent(slug, values) {
  const endpoint = '/api/admin/course-page-blocks';
  const res = await api(endpoint);
  const rows = Array.isArray(res.data) ? res.data : [];
  const managed = new Set(['about', 'learn', 'highlights', 'not_for', 'faq']);
  await deleteRowsByFilter(endpoint, rows, (r) => String(r.course_slug || '').trim() === slug && managed.has(String(r.block_type || '').trim()));

  const output = [];
  if (String(values.description || '').trim()) {
    output.push({
      course_slug: slug,
      block_type: 'about',
      title: resolveSectionHeading(values.descriptionLabel, defaultSimpleHeading('courses', 'description')),
      body: String(values.description || '').trim(),
      is_active: 1,
      order: 1
    });
  }
  if (String(values.whatLearn || '').trim()) {
    output.push({
      course_slug: slug,
      block_type: 'learn',
      title: resolveSectionHeading(values.field1Label, defaultSimpleHeading('courses', 'field1')),
      bullets: normalizeListValueForStorage(values.whatLearn),
      is_active: 1,
      order: 2
    });
  }
  if (String(values.whoFor || '').trim()) {
    output.push({
      course_slug: slug,
      block_type: 'highlights',
      title: resolveSectionHeading(values.field2Label, defaultSimpleHeading('courses', 'field2')),
      bullets: normalizeListValueForStorage(values.whoFor),
      is_active: 1,
      order: 3
    });
  }
  if (String(values.outcome || '').trim()) {
    output.push({
      course_slug: slug,
      block_type: 'not_for',
      title: resolveSectionHeading(values.field3Label, defaultSimpleHeading('courses', 'field3')),
      bullets: normalizeListValueForStorage(values.outcome),
      is_active: 1,
      order: 4
    });
  }
  if (String(values.goDeeper || '').trim()) {
    output.push({
      course_slug: slug,
      block_type: 'faq',
      title: resolveSectionHeading(values.faqLabel, defaultSimpleHeading('courses', 'faq')),
      bullets: linePairsToFaqBullets(values.goDeeper),
      is_active: 1,
      order: 5
    });
  }

  await createRows(endpoint, output);
}

async function syncSimpleWebinarsContent(slug, values) {
  const blocksEndpoint = '/api/admin/webinar-page-blocks';
  const cardsEndpoint = '/api/admin/webinar-key-points-cards';

  const [blocksRes, cardsRes] = await Promise.all([api(blocksEndpoint), api(cardsEndpoint)]);
  const blocks = Array.isArray(blocksRes.data) ? blocksRes.data : [];
  const cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
  const managed = new Set(['overview', 'who_for', 'faq']);

  await deleteRowsByFilter(blocksEndpoint, blocks, (r) => String(r.webinar_slug || '').trim() === slug && managed.has(String(r.block_type || '').trim()));
  await deleteRowsByFilter(cardsEndpoint, cards, (r) => String(r.webinar_slug || '').trim() === slug);

  const mergedOverview = String(values.description || '').trim();

  const outBlocks = [];
  if (mergedOverview) {
    outBlocks.push({
      webinar_slug: slug,
      block_type: 'overview',
      title: resolveSectionHeading(values.descriptionLabel, defaultSimpleHeading('webinars', 'description')),
      body: mergedOverview,
      is_active: 1,
      order: 1
    });
  }
  if (String(values.whoFor || '').trim()) {
    outBlocks.push({
      webinar_slug: slug,
      block_type: 'who_for',
      title: resolveSectionHeading(values.field2Label, defaultSimpleHeading('webinars', 'field2')),
      bullets: normalizeListValueForStorage(values.whoFor),
      is_active: 1,
      order: 2
    });
  }
  if (String(values.goDeeper || '').trim()) {
    outBlocks.push({
      webinar_slug: slug,
      block_type: 'faq',
      title: resolveSectionHeading(values.faqLabel, defaultSimpleHeading('webinars', 'faq')),
      bullets: linePairsToFaqBullets(values.goDeeper),
      is_active: 1,
      order: 3
    });
  }
  await createRows(blocksEndpoint, outBlocks);

  const learnLines = normalizeListValueForEditor(values.whatLearn)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const outCards = learnLines.map((line, idx) => ({ webinar_slug: slug, title: line, body: '', is_active: 1, order: idx + 1 }));
  await createRows(cardsEndpoint, outCards);
}

async function syncSimpleDigitalContent(slug, values) {
  const endpoint = '/api/admin/digital-product-details';
  const res = await api(endpoint);
  const rows = Array.isArray(res.data) ? res.data : [];
  const managed = new Set(['overview', 'outcomes', 'faq']);
  await deleteRowsByFilter(endpoint, rows, (r) => String(r.product_slug || '').trim() === slug && managed.has(String(r.section_type || '').trim()));

  const overviewBody = [String(values.description || '').trim(), String(values.whoFor || '').trim()]
    .filter(Boolean)
    .join('\n\n');
  const outcomesBullets = [String(values.whatLearn || '').trim(), String(values.outcome || '').trim()]
    .filter(Boolean)
    .join('\n');

  const output = [];
  if (overviewBody) {
    output.push({
      product_slug: slug,
      section_type: 'overview',
      heading: resolveSectionHeading(values.descriptionLabel, defaultSimpleHeading('digital-products', 'description')),
      body: overviewBody,
      is_active: 1,
      order: 1
    });
  }
  if (outcomesBullets.trim()) {
    output.push({
      product_slug: slug,
      section_type: 'outcomes',
      heading: resolveSectionHeading(values.field3Label, defaultSimpleHeading('digital-products', 'field3')),
      bullets: normalizeListValueForStorage(outcomesBullets),
      is_active: 1,
      order: 2
    });
  }
  if (String(values.goDeeper || '').trim()) {
    output.push({
      product_slug: slug,
      section_type: 'faq',
      heading: resolveSectionHeading(values.faqLabel, defaultSimpleHeading('digital-products', 'faq')),
      bullets: linePairsToFaqBullets(values.goDeeper),
      is_active: 1,
      order: 3
    });
  }

  await createRows(endpoint, output);
}

async function syncSimpleStructuredContent(section, slug, values) {
  if (!slug || !values) return;
  if (section === 'courses') {
    await syncSimpleCoursesContent(slug, values);
    return;
  }
  if (section === 'webinars') {
    await syncSimpleWebinarsContent(slug, values);
    return;
  }
  if (section === 'digital-products') {
    await syncSimpleDigitalContent(slug, values);
  }
}

// === REVERSE HYDRATION: Child records → Structured fields ===

async function reverseHydrateCoursesContent(slug) {
  try {
    const res = await api('/api/admin/course-page-blocks');
    const blocks = Array.isArray(res.data) ? res.data : [];
    const relevant = blocks.filter((b) => String(b.course_slug || '').trim() === slug);
    const result = {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('courses', 'description'),
      field1Label: defaultSimpleHeading('courses', 'field1'),
      field2Label: defaultSimpleHeading('courses', 'field2'),
      field3Label: defaultSimpleHeading('courses', 'field3'),
      faqLabel: defaultSimpleHeading('courses', 'faq')
    };
    
    relevant.forEach((block) => {
      const type = String(block.block_type || '').trim();
      if (type === 'about') {
        result.description = String(block.body || '').trim();
        result.descriptionLabel = resolveSectionHeading(block.title, result.descriptionLabel);
      }
      if (type === 'learn') {
        result.whatLearn = normalizeListValueForEditor(block.bullets || '');
        result.field1Label = resolveSectionHeading(block.title, result.field1Label);
      }
      if (type === 'highlights') {
        result.whoFor = normalizeListValueForEditor(block.bullets || '');
        result.field2Label = resolveSectionHeading(block.title, result.field2Label);
      }
      if (type === 'not_for') {
        result.outcome = normalizeListValueForEditor(block.bullets || '');
        result.field3Label = resolveSectionHeading(block.title, result.field3Label);
      }
      if (type === 'faq') {
        result.goDeeper = faqBulletsToLinePairs(block.bullets || '');
        result.faqLabel = resolveSectionHeading(block.title, result.faqLabel);
      }
    });
    
    return result;
  } catch (err) {
    console.warn('reverseHydrateCoursesContent error:', err);
    return {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('courses', 'description'),
      field1Label: defaultSimpleHeading('courses', 'field1'),
      field2Label: defaultSimpleHeading('courses', 'field2'),
      field3Label: defaultSimpleHeading('courses', 'field3'),
      faqLabel: defaultSimpleHeading('courses', 'faq')
    };
  }
}

async function reverseHydrateWebinarsContent(slug) {
  try {
    const [blocksRes, cardsRes] = await Promise.all([
      api('/api/admin/webinar-page-blocks'),
      api('/api/admin/webinar-key-points-cards')
    ]);
    const blocks = Array.isArray(blocksRes.data) ? blocksRes.data : [];
    const cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
    
    const relevantBlocks = blocks.filter((b) => String(b.webinar_slug || '').trim() === slug);
    const relevantCards = cards.filter((c) => String(c.webinar_slug || '').trim() === slug);
    
    const result = {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('webinars', 'description'),
      field1Label: defaultSimpleHeading('webinars', 'field1'),
      field2Label: defaultSimpleHeading('webinars', 'field2'),
      field3Label: defaultSimpleHeading('webinars', 'field3'),
      faqLabel: defaultSimpleHeading('webinars', 'faq')
    };
    
    relevantBlocks.forEach((block) => {
      const type = String(block.block_type || '').trim();
      if (type === 'overview') {
        const bodyText = String(block.body || '').trim();
        if (bodyText) result.description = bodyText;
        result.descriptionLabel = resolveSectionHeading(block.title, result.descriptionLabel);
      }
      if (type === 'who_for') {
        result.whoFor = normalizeListValueForEditor(block.bullets || '');
        result.field2Label = resolveSectionHeading(block.title, result.field2Label);
      }
      if (type === 'faq') {
        result.goDeeper = faqBulletsToLinePairs(block.bullets || '');
        result.faqLabel = resolveSectionHeading(block.title, result.faqLabel);
      }
    });
    
    const cardLines = relevantCards
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((c) => String(c.title || '').trim())
      .filter(Boolean)
      .join('\n');
    result.whatLearn = cardLines;
    
    return result;
  } catch (err) {
    console.warn('reverseHydrateWebinarsContent error:', err);
    return {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('webinars', 'description'),
      field1Label: defaultSimpleHeading('webinars', 'field1'),
      field2Label: defaultSimpleHeading('webinars', 'field2'),
      field3Label: defaultSimpleHeading('webinars', 'field3'),
      faqLabel: defaultSimpleHeading('webinars', 'faq')
    };
  }
}

async function reverseHydrateDigitalContent(slug) {
  try {
    const res = await api('/api/admin/digital-product-details');
    const details = Array.isArray(res.data) ? res.data : [];
    const relevant = details.filter((d) => String(d.product_slug || '').trim() === slug);
    const result = {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('digital-products', 'description'),
      field1Label: defaultSimpleHeading('digital-products', 'field1'),
      field2Label: defaultSimpleHeading('digital-products', 'field2'),
      field3Label: defaultSimpleHeading('digital-products', 'field3'),
      faqLabel: defaultSimpleHeading('digital-products', 'faq')
    };
    
    relevant.forEach((section) => {
      const type = String(section.section_type || '').trim();
      if (type === 'overview') {
        const bodyText = String(section.body || '').trim();
        if (bodyText) result.description = bodyText;
        result.descriptionLabel = resolveSectionHeading(section.heading, result.descriptionLabel);
      }
      if (type === 'outcomes') {
        const bulletsText = normalizeListValueForEditor(section.bullets || '');
        if (bulletsText && !result.whatLearn) result.whatLearn = bulletsText;
        else if (bulletsText) result.outcome = bulletsText;
        result.field3Label = resolveSectionHeading(section.heading, result.field3Label);
      }
      if (type === 'faq') {
        result.goDeeper = faqBulletsToLinePairs(section.bullets || '');
        result.faqLabel = resolveSectionHeading(section.heading, result.faqLabel);
      }
    });
    
    return result;
  } catch (err) {
    console.warn('reverseHydrateDigitalContent error:', err);
    return {
      description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '',
      descriptionLabel: defaultSimpleHeading('digital-products', 'description'),
      field1Label: defaultSimpleHeading('digital-products', 'field1'),
      field2Label: defaultSimpleHeading('digital-products', 'field2'),
      field3Label: defaultSimpleHeading('digital-products', 'field3'),
      faqLabel: defaultSimpleHeading('digital-products', 'faq')
    };
  }
}

// === PHASE 4: DATA CLEANUP & SECTION-SPECIFIC LABELS ===

const sectionSpecificLabels = {
  courses: {
    description: 'Course Description',
    whatLearn: 'What You Will Learn',
    whoFor: 'Who This Course Is For',
    outcome: 'Key Outcomes',
    goDeeper: 'Go Deeper Resources'
  },
  webinars: {
    description: 'Webinar Overview',
    whatLearn: 'Key Takeaways',
    whoFor: 'Who Should Attend',
    outcome: 'What You\'ll Know After',
    goDeeper: 'Additional Resources'
  },
  'digital-products': {
    description: 'Product Overview',
    whatLearn: 'What\'s Included',
    whoFor: 'Perfect For',
    outcome: 'Expected Outcomes',
    goDeeper: 'FAQ & Support' 
  },
  membership: {
    description: 'Plan Description',
    whatLearn: 'What\'s Included',
    whoFor: 'Best For',
    outcome: 'Key Benefits',
    goDeeper: 'Support & Access'
  }
};

function getStructuredLabel(section, fieldKey) {
  const labels = sectionSpecificLabels[section] || sectionSpecificLabels.courses;
  return labels[fieldKey] || fieldKey;
}

async function detectOrphanBlocks() {
  try {
    const [coursesRes, blocksRes] = await Promise.all([
      api('/api/admin/courses'),
      api('/api/admin/course-page-blocks')
    ]);
    const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
    const blocks = Array.isArray(blocksRes.data) ? blocksRes.data : [];
    const validSlugs = new Set(courses.map((c) => String(c.slug || '').trim()));
    const orphans = blocks.filter((b) => {
      const slug = String(b.course_slug || '').trim();
      return slug && !validSlugs.has(slug);
    });
    return { type: 'course-page-blocks', orphanCount: orphans.length, orphans };
  } catch (err) {
    console.warn('detectOrphanBlocks error:', err);
    return { type: 'course-page-blocks', orphanCount: 0, orphans: [] };
  }
}

async function detectOrphanWebinarBlocks() {
  try {
    const [webinarsRes, blocksRes] = await Promise.all([
      api('/api/admin/webinars'),
      api('/api/admin/webinar-page-blocks')
    ]);
    const webinars = Array.isArray(webinarsRes.data) ? webinarsRes.data : [];
    const blocks = Array.isArray(blocksRes.data) ? blocksRes.data : [];
    const validSlugs = new Set(webinars.map((w) => String(w.slug || '').trim()));
    const orphans = blocks.filter((b) => {
      const slug = String(b.webinar_slug || '').trim();
      return slug && !validSlugs.has(slug);
    });
    return { type: 'webinar-page-blocks', orphanCount: orphans.length, orphans };
  } catch (err) {
    console.warn('detectOrphanWebinarBlocks error:', err);
    return { type: 'webinar-page-blocks', orphanCount: 0, orphans: [] };
  }
}

async function detectOrphanWebinarCards() {
  try {
    const [webinarsRes, cardsRes] = await Promise.all([
      api('/api/admin/webinars'),
      api('/api/admin/webinar-key-points-cards')
    ]);
    const webinars = Array.isArray(webinarsRes.data) ? webinarsRes.data : [];
    const cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
    const validSlugs = new Set(webinars.map((w) => String(w.slug || '').trim()));
    const orphans = cards.filter((c) => {
      const slug = String(c.webinar_slug || '').trim();
      return slug && !validSlugs.has(slug);
    });
    return { type: 'webinar-key-points-cards', orphanCount: orphans.length, orphans };
  } catch (err) {
    console.warn('detectOrphanWebinarCards error:', err);
    return { type: 'webinar-key-points-cards', orphanCount: 0, orphans: [] };
  }
}

async function detectOrphanDigitalDetails() {
  try {
    const [productsRes, detailsRes] = await Promise.all([
      api('/api/admin/digital-products'),
      api('/api/admin/digital-product-details')
    ]);
    const products = Array.isArray(productsRes.data) ? productsRes.data : [];
    const details = Array.isArray(detailsRes.data) ? detailsRes.data : [];
    const validSlugs = new Set(products.map((p) => String(p.slug || '').trim()));
    const orphans = details.filter((d) => {
      const slug = String(d.product_slug || '').trim();
      return slug && !validSlugs.has(slug);
    });
    return { type: 'digital-product-details', orphanCount: orphans.length, orphans };
  } catch (err) {
    console.warn('detectOrphanDigitalDetails error:', err);
    return { type: 'digital-product-details', orphanCount: 0, orphans: [] };
  }
}

async function runFullOrphanAudit() {
  try {
    const results = await Promise.all([
      detectOrphanBlocks(),
      detectOrphanWebinarBlocks(),
      detectOrphanWebinarCards(),
      detectOrphanDigitalDetails()
    ]);
    const total = results.reduce((sum, r) => sum + r.orphanCount, 0);
    return { successful: true, total, results };
  } catch (err) {
    console.warn('runFullOrphanAudit error:', err);
    return { successful: false, total: 0, results: [] };
  }
}

// === PHASE 5: PERFORMANCE METRICS & CANARY ROLLOUT ===

function recordSaveMetric(section, mode, latencyMs, success = true) {
  state.metrics.saves.push({
    section,
    mode,
    latencyMs,
    success,
    timestamp: new Date().toISOString()
  });
  
  if (!state.metrics.editorUsage[section]) {
    state.metrics.editorUsage[section] = { simple: 0, advanced: 0 };
  }
  state.metrics.editorUsage[section][mode]++;
  
  // Keep only last 100 saves in memory
  if (state.metrics.saves.length > 100) {
    state.metrics.saves = state.metrics.saves.slice(-100);
  }
}

function recordModeSwapMetric(section, fromMode, toMode) {
  state.metrics.modeSwaps.push({
    section,
    fromMode,
    toMode,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 50 swaps
  if (state.metrics.modeSwaps.length > 50) {
    state.metrics.modeSwaps = state.metrics.modeSwaps.slice(-50);
  }
}

function recordAuditMetric(latencyMs, orphanCount) {
  state.metrics.auditTimes.push({
    latencyMs,
    orphanCount,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 30 audits
  if (state.metrics.auditTimes.length > 30) {
    state.metrics.auditTimes = state.metrics.auditTimes.slice(-30);
  }
}

function getAverageMetric(arr, field) {
  if (!arr.length) return 0;
  const sum = arr.reduce((acc, item) => acc + (item[field] || 0), 0);
  return Math.round(sum / arr.length);
}

function getMetricsReport() {
  const avgSaveLatency = getAverageMetric(state.metrics.saves, 'latencyMs');
  const successRate = state.metrics.saves.length > 0
    ? Math.round((state.metrics.saves.filter(s => s.success).length / state.metrics.saves.length) * 100)
    : 0;
  const avgAuditLatency = getAverageMetric(state.metrics.auditTimes, 'latencyMs');
  
  let editorAdoption = {};
  for (const [section, usage] of Object.entries(state.metrics.editorUsage)) {
    const total = usage.simple + usage.advanced;
    editorAdoption[section] = {
      simple: total > 0 ? Math.round((usage.simple / total) * 100) : 0,
      advanced: total > 0 ? Math.round((usage.advanced / total) * 100) : 0,
      totalSaves: total
    };
  }
  
  return {
    avgSaveLatency,
    successRate,
    totalSaves: state.metrics.saves.length,
    avgAuditLatency,
    totalAudits: state.metrics.auditTimes.length,
    editorAdoption,
    modeSwaps: state.metrics.modeSwaps.length
  };
}

const integratedChildSections = {
  courses: [
    { key: 'course-page-blocks', title: 'Course Page Blocks', parentField: 'course_slug' },
    { key: 'course-for-you-cards', title: 'Course For You Cards', parentField: 'course_slug' }
  ],
  webinars: [
    { key: 'webinar-page-blocks', title: 'Webinar Page Blocks', parentField: 'webinar_slug' },
    { key: 'webinar-key-points-cards', title: 'Webinar Key Points Cards', parentField: 'webinar_slug' }
  ],
  'digital-products': [
    { key: 'digital-product-details', title: 'Digital Product Details', parentField: 'product_slug' }
  ]
};

// === NEW SIMPLIFIED UI CONFIGURATION ===
// Complete redesign for 4 core sections with color-coded, clean forms

const simplifiedSectionConfigs = {
  courses: {
    title: '📚 Create Course',
    color: '#2196F3',
    bgColor: '#E3F2FD',
    endpoint: '/api/admin/courses',
    labels: {
      title: 'Course Name',
      description: 'What is this course about?',
      field1: 'What You Will Learn (one per line)',
      field2: 'Who This Course Is For (one per line)',
      field3: 'Key Outcomes (one per line)',
      faq: 'FAQ'
    },
    slugField: 'slug',
    imageField: 'thumbnail_url',
    imageLabel: 'Thumbnail Image URL',
    imageHint: 'Recommended: 1200 x 800 px (3:2)'
  },
  webinars: {
    title: '🎥 Create Webinar',
    color: '#4CAF50',
    bgColor: '#F1F8E9',
    endpoint: '/api/admin/webinars',
    labels: {
      title: 'Webinar Title',
      description: 'Webinar Overview',
      field1: 'Key Takeaways (one per line)',
      field2: 'Who Should Attend (one per line)',
      field3: 'What You\'ll Know After (one per line)',
      faq: 'Additional Resources'
    },
    slugField: 'slug',
    imageField: 'banner_url',
    imageLabel: 'Banner Image URL',
    imageHint: 'Recommended: 1600 x 900 px (16:9)'
  },
  'digital-products': {
    title: '🎁 Create Digital Product',
    color: '#9C27B0',
    bgColor: '#F3E5F5',
    endpoint: '/api/admin/digital-products',
    labels: {
      title: 'Product Name',
      description: 'Product Overview',
      field1: 'What\'s Included (one per line)',
      field2: 'Perfect For (one per line)',
      field3: 'Expected Outcomes (one per line)',
      faq: 'FAQ & Support'
    },
    slugField: 'slug',
    imageField: 'thumbnail_url',
    imageLabel: 'Thumbnail Image URL',
    imageHint: 'Recommended: 1200 x 800 px (3:2)'
  },
  membership: {
    title: '⭐ Create Membership Plan',
    color: '#FF9800',
    bgColor: '#FFF3E0',
    endpoint: '/api/admin/membership-plans',
    labels: {
      title: 'Plan Name',
      description: 'Plan Description',
      field1: 'What\'s Included (one per line)',
      field2: 'Best For (one per line)',
      field3: 'Key Benefits (one per line)',
      faq: 'Support & Access'
    },
    slugField: 'plan_id',
    imageField: 'image_url',
    imageLabel: 'Plan Image URL',
    imageHint: 'Recommended: 1200 x 800 px (3:2)'
  }
};

function renderSimplifiedForm(section, record = null) {
  const cfg = simplifiedSectionConfigs[section];
  if (!cfg) return '';
  
  const isEdit = record && record.id;
  const title = record ? `Edit #${record.id}` : cfg.title;
  const formId = `simplified-form-${section}`;
  
  const titleValue = record ? (record.title || record.plan_id || '') : '';
  const descValue = record ? (record.subtitle || record.description || '') : '';
  
  // Migrate old data: convert old child records to field1/field2/field3
  let field1Value = record ? (record.features || '') : '';
  let field2Value = record ? (record.target_audience || '') : '';
  let field3Value = record ? (record.benefits || '') : '';
  let goDeeperValue = record ? String(record.goDeeper || '') : '';

  const descriptionLabelValue = record && record.descriptionLabel ? String(record.descriptionLabel) : cleanSectionLabel(cfg.labels.description);
  const field1LabelValue = record && record.field1Label ? String(record.field1Label) : cleanSectionLabel(cfg.labels.field1);
  const field2LabelValue = record && record.field2Label ? String(record.field2Label) : cleanSectionLabel(cfg.labels.field2);
  const field3LabelValue = record && record.field3Label ? String(record.field3Label) : cleanSectionLabel(cfg.labels.field3);
  const faqLabelValue = record && record.faqLabel ? String(record.faqLabel) : cleanSectionLabel(cfg.labels.faq || 'FAQ');
  
  return `
    <div class="simplified-section" style="border-left: 6px solid ${cfg.color}; background: ${cfg.bgColor}; padding: 24px; border-radius: 4px; max-width: 700px;">
      <h2 style="color: ${cfg.color}; margin-top: 0;">${escapeHtml(title)}</h2>
      
      <form id="${formId}" class="simplified-form">
        <input type="hidden" name="id" value="${isEdit ? record.id : ''}">
        <input type="hidden" name="section" value="${escapeHtml(section)}">
        
        <!-- Title Field -->
        <label class="simplified-field">
          <span style="font-weight: 600; color: #333;">${escapeHtml(cfg.labels.title)}</span>
          <input type="text" name="title" id="${formId}-title" placeholder="Enter ${escapeHtml(cfg.labels.title).toLowerCase()}" 
                 value="${escapeHtml(titleValue)}" required 
                 style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
        </label>

        <!-- Slug Field -->
        <label class="simplified-field" style="margin-top: 16px;">
          <span style="font-weight: 600; color: #555;">🔖 Slug <small style="font-weight:400; color:#888;">(used in Reviews &amp; page links — auto-filled, editable)</small></span>
          <input type="text" name="${cfg.slugField}" id="${formId}-slug"
                 placeholder="auto-filled-from-title"
                 value="${escapeHtml(String(record ? (record[cfg.slugField] || record.slug || '') : ''))}"
                 style="width: 100%; padding: 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: monospace; background: #fafafa;">
          <small style="color: #999;">Lowercase, hyphens only. Changing an existing slug will break review links.</small>
        </label>

        <!-- Description Field -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">Section heading on website</span>
          <input type="text" name="description_label" placeholder="Section heading"
                 value="${escapeHtml(descriptionLabelValue)}"
                 style="width: 100%; padding: 8px 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Used as this section header in modal.</small>
        </label>
        <label class="simplified-field" style="margin-top: 12px;">
          <span style="font-weight: 600; color: #333;">${escapeHtml(cfg.labels.description)}</span>
          <textarea name="description" placeholder="Write a compelling description..." rows="4" 
                    style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: inherit;">${escapeHtml(descValue)}</textarea>
        </label>
        
        <!-- Field 1 -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">Section heading on website</span>
          <input type="text" name="field1_label" placeholder="Section heading"
                 value="${escapeHtml(field1LabelValue)}"
                 style="width: 100%; padding: 8px 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Used as this section header in modal.</small>
        </label>
        <label class="simplified-field" style="margin-top: 12px;">
          <span style="font-weight: 600; color: #555;">${escapeHtml(cfg.labels.field1)}</span>
          <textarea name="field1" placeholder="Line 1\nLine 2\nLine 3\nLine 4" rows="4"
                    style="width: 100%; padding: 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: monospace;">${escapeHtml(field1Value)}</textarea>
          <small style="color: #999;">Separate each item with a new line</small>
        </label>
        
        <!-- Field 2 -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">Section heading on website</span>
          <input type="text" name="field2_label" placeholder="Section heading"
                 value="${escapeHtml(field2LabelValue)}"
                 style="width: 100%; padding: 8px 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Used as this section header in modal.</small>
        </label>
        <label class="simplified-field" style="margin-top: 12px;">
          <span style="font-weight: 600; color: #555;">${escapeHtml(cfg.labels.field2)}</span>
          <textarea name="field2" placeholder="Line 1\nLine 2\nLine 3\nLine 4" rows="4"
                    style="width: 100%; padding: 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: monospace;">${escapeHtml(field2Value)}</textarea>
          <small style="color: #999;">Separate each item with a new line</small>
        </label>
        
        <!-- Field 3 -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">Section heading on website</span>
          <input type="text" name="field3_label" placeholder="Section heading"
                 value="${escapeHtml(field3LabelValue)}"
                 style="width: 100%; padding: 8px 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Used as this section header in modal.</small>
        </label>
        <label class="simplified-field" style="margin-top: 12px;">
          <span style="font-weight: 600; color: #555;">${escapeHtml(cfg.labels.field3)}</span>
          <textarea name="field3" placeholder="Line 1\nLine 2\nLine 3\nLine 4" rows="4"
                    style="width: 100%; padding: 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: monospace;">${escapeHtml(field3Value)}</textarea>
          <small style="color: #999;">Separate each item with a new line</small>
        </label>

        <!-- FAQ Field -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">Section heading on website</span>
          <input type="text" name="faq_label" placeholder="Section heading"
                 value="${escapeHtml(faqLabelValue)}"
                 style="width: 100%; padding: 8px 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Used as this section header in modal.</small>
        </label>
        <label class="simplified-field" style="margin-top: 12px;">
          <span style="font-weight: 600; color: #555;">${escapeHtml(cfg.labels.faq || 'FAQ')}</span>
          <textarea name="goDeeper" placeholder="Question line 1\nAnswer line 1\nQuestion line 2\nAnswer line 2" rows="6"
                    style="width: 100%; padding: 10px; font-size: 0.9em; border: 1px solid ${cfg.color}; border-radius: 4px; margin-top: 8px; font-family: monospace;">${escapeHtml(goDeeperValue)}</textarea>
          <small style="color: #999;">Enter FAQ in line pairs: line 1 question, line 2 answer, line 3 question, line 4 answer.</small>
        </label>

        <!-- Image URL -->
        <label class="simplified-field" style="margin-top: 20px;">
          <span style="font-weight: 600; color: #333;">🖼️ ${escapeHtml(cfg.imageLabel)}</span>
          <input type="url" name="${cfg.imageField}" placeholder="https://... (direct image URL)"
                 value="${escapeHtml(String(record ? (record[cfg.imageField] || '') : ''))}"
                 style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          <small style="color: #999;">Paste a direct image link (jpg/png/webp). ${escapeHtml(cfg.imageHint || 'Recommended: 1200 x 800 px (3:2)')}.</small>
        </label>

        <!-- Pricing & Payment Link -->
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 2fr; gap: 16px; align-items: start;">
          <label class="simplified-field">
            <span style="font-weight: 600; color: #333;">💰 Price (INR)</span>
            <input type="number" name="price_inr" step="0.01" min="0" placeholder="e.g. 1999"
                   value="${escapeHtml(String(record ? (record.price_inr ?? '') : ''))}"
                   style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
            <small style="color: #999;">Leave blank if free</small>
          </label>
          <label class="simplified-field">
            <span style="font-weight: 600; color: #333;">🔗 Payment / Enrollment Form Link</span>
            <input type="url" name="payment_link" placeholder="https://forms... or https://razorpay..."
                   value="${escapeHtml(String(record ? (record.payment_link || '') : ''))}"
                   style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
            <small style="color: #999;">Embedded form URL or payment gateway redirect</small>
          </label>
        </div>

        ${section === 'webinars' ? `
        <!-- Webinar Dates -->
        <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;">
          <label class="simplified-field">
            <span style="font-weight: 600; color: #333;">📅 Start Date &amp; Time</span>
            <input type="datetime-local" name="start_datetime_local"
                   value="${escapeHtml(String(record ? (record.start_datetime_local || '') : ''))}"
                   style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          </label>
          <label class="simplified-field">
            <span style="font-weight: 600; color: #333;">📅 End Date &amp; Time</span>
            <input type="datetime-local" name="end_datetime_local"
                   value="${escapeHtml(String(record ? (record.end_datetime_local || '') : ''))}"
                   style="width: 100%; padding: 10px; font-size: 1em; border: 2px solid ${cfg.color}; border-radius: 4px; margin-top: 8px;">
          </label>
        </div>
        ` : ''}

        <!-- Actions -->
        <div style="margin-top: 24px; display: flex; gap: 12px;">
          <button type="submit" style="background: ${cfg.color}; color: white; padding: 12px 24px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 1em;">
            ${isEdit ? '💾 Update' : '✚ Create'}
          </button>
          <button type="button" id="${formId}-preview-btn" style="background: #ffffff; color: ${cfg.color}; padding: 12px 24px; border: 1px solid ${cfg.color}; border-radius: 4px; cursor: pointer; font-weight: 600;">
            Preview
          </button>
          <button type="reset" style="background: #f0f0f0; color: #333; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            Clear
          </button>
        </div>
        
        <p id="${formId}-status" style="margin-top: 16px; font-weight: 600; min-height: 20px; color: #666;"></p>
      </form>
    </div>
  `;
}

function setupSimplifiedSlugAutoFill(formId, slugField, color) {
  const titleInput = document.getElementById(`${formId}-title`);
  const slugInput = document.getElementById(`${formId}-slug`);
  if (!titleInput || !slugInput) return;
  let userEditedSlug = slugInput.value.trim() !== '';
  slugInput.addEventListener('input', () => { userEditedSlug = true; });
  titleInput.addEventListener('input', () => {
    if (!userEditedSlug) {
      slugInput.value = toSlug(titleInput.value);
    }
  });
  // If editing (has value), ensure flag is set
  if (slugInput.value.trim() !== '') userEditedSlug = true;
}

function splitInputLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatLocalDateTimeLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Not set';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function getWebinarTimingStatus(endDateRaw) {
  const raw = String(endDateRaw || '').trim();
  if (!raw) return { label: 'Draft', klass: 'is-draft' };
  const endDate = new Date(raw);
  if (Number.isNaN(endDate.getTime())) return { label: 'Scheduled', klass: 'is-upcoming' };
  return endDate.getTime() < Date.now()
    ? { label: 'Past', klass: 'is-past' }
    : { label: 'Upcoming', klass: 'is-upcoming' };
}

function buildSimplifiedModalPreviewHtml(section, form, cfg) {
  if (!form || !cfg) return '<p class="preview-empty">Fill the form to see a preview.</p>';

  const getValue = (name) => String(form.elements[name] && form.elements[name].value || '').trim();
  const title = getValue('title') || 'Untitled';
  const slug = getValue(cfg.slugField) || toSlug(title) || 'missing-slug';
  const description = getValue('description');
  const imageUrl = getValue(cfg.imageField);
  const priceRaw = getValue('price_inr');
  const paymentLink = getValue('payment_link');
  const field1 = splitInputLines(getValue('field1'));
  const field2 = splitInputLines(getValue('field2'));
  const field3 = splitInputLines(getValue('field3'));

  const safeTitle = escapeHtml(title);
  const safeSlug = escapeHtml(slug);
  const safeDescription = description ? nl2brSafe(description) : 'Add a description to preview.';
  const ctaDisabled = paymentLink ? '' : 'disabled';
  const ctaHref = paymentLink ? escapeHtml(paymentLink) : '#';

  const priceNumber = Number(priceRaw);
  const hasPrice = priceRaw !== '' && Number.isFinite(priceNumber) && priceNumber > 0;
  const priceLabel = hasPrice ? `INR ${priceNumber.toLocaleString('en-IN')}` : 'Free';

  const listBlock = (titleText, items) => {
    if (!items.length) {
      return `
        <section class="simplified-preview-list-card">
          <h4>${escapeHtml(titleText)}</h4>
          <p class="preview-empty">No points added.</p>
        </section>
      `;
    }
    return `
      <section class="simplified-preview-list-card">
        <h4>${escapeHtml(titleText)}</h4>
        <ul>
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>
    `;
  };

  const webinarMeta = section === 'webinars'
    ? (() => {
        const startValue = getValue('start_datetime_local');
        const endValue = getValue('end_datetime_local');
        const timingStatus = getWebinarTimingStatus(endValue);
        return `
          <div class="simplified-preview-meta-row">
            <span><strong>Start:</strong> ${escapeHtml(formatLocalDateTimeLabel(startValue))}</span>
            <span><strong>End:</strong> ${escapeHtml(formatLocalDateTimeLabel(endValue))}</span>
            <span class="simplified-preview-status ${timingStatus.klass}">${escapeHtml(timingStatus.label)}</span>
          </div>
        `;
      })()
    : '';

  const mediaBlock = imageUrl
    ? `
      <div class="simplified-preview-media-wrap">
        <img src="${escapeHtml(imageUrl)}" alt="${safeTitle}" loading="lazy" class="simplified-preview-hero-image">
      </div>
    `
    : '<div class="simplified-preview-media-wrap is-empty">Add an image URL to preview cover image.</div>';

  return `
    <article class="simplified-preview-card" style="--accent-color: ${cfg.color};">
      ${mediaBlock}
      <div class="simplified-preview-body-content">
        <div class="simplified-preview-headline-row">
          <h2>${safeTitle}</h2>
          <span class="simplified-preview-price">${escapeHtml(priceLabel)}</span>
        </div>
        <div class="simplified-preview-slug-row">
          <span class="simplified-preview-slug">${safeSlug}</span>
          <a href="${ctaHref}" target="_blank" rel="noopener noreferrer" class="simplified-preview-cta ${ctaDisabled}">Open Payment / Form</a>
        </div>
        ${webinarMeta}
        <p class="simplified-preview-description">${safeDescription}</p>
        <div class="simplified-preview-list-grid">
          ${listBlock(cfg.labels.field1, field1)}
          ${listBlock(cfg.labels.field2, field2)}
          ${listBlock(cfg.labels.field3, field3)}
        </div>
      </div>
    </article>
  `;
}

function setupSimplifiedPreviewModal(section, form, cfg) {
  const modal = document.getElementById(`simplified-preview-modal-${section}`);
  const previewBtn = document.getElementById(`simplified-form-${section}-preview-btn`);
  if (!modal || !previewBtn || !form) return () => {};

  const previewBodyId = `simplified-preview-body-${section}`;
  const previewBody = document.getElementById(previewBodyId);
  if (!previewBody) return () => {};

  const refreshPreview = () => {
    previewBody.innerHTML = buildSimplifiedModalPreviewHtml(section, form, cfg);
  };

  form.addEventListener('input', refreshPreview);
  form.addEventListener('change', refreshPreview);
  refreshPreview();

  const closeModal = () => {
    modal.classList.remove('open');
    document.body.classList.remove('no-scroll');
    modal.setAttribute('aria-hidden', 'true');
  };

  previewBtn.addEventListener('click', () => {
    refreshPreview();
    modal.classList.add('open');
    document.body.classList.add('no-scroll');
    modal.setAttribute('aria-hidden', 'false');
  });

  modal.addEventListener('click', (event) => {
    const closeTrigger = event.target.closest('[data-simplified-preview-close]');
    if (closeTrigger || event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  return refreshPreview;
}

const sectionConfigs = {
  hero: {
    kind: 'singleton',
    endpoint: '/api/admin/hero',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { name: 'button_text_1', label: 'Primary Button Text', type: 'text' },
      { name: 'button_text_2', label: 'Secondary Button Text', type: 'text' },
      { name: 'video_url', label: 'Video URL', type: 'text' }
    ]
  },
  about: {
    kind: 'singleton',
    endpoint: '/api/admin/about',
    fields: [
      { name: 'founder_name', label: 'Founder Name', type: 'text', required: true },
      { name: 'founder_title', label: 'Founder Title', type: 'text' },
      { name: 'paragraph_1', label: 'Paragraph 1', type: 'textarea' },
      { name: 'paragraph_2', label: 'Paragraph 2', type: 'textarea' },
      { name: 'paragraph_3', label: 'Paragraph 3', type: 'textarea' },
      { name: 'founder_image_url', label: 'Founder Image URL', type: 'text' }
    ]
  },
  contact: {
    kind: 'singleton',
    endpoint: '/api/admin/contact',
    fields: [
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'gallery_enabled', label: 'Show Gallery Section On Website', type: 'checkbox' },
      { name: 'footer_brand_name', label: 'Footer Brand Name', type: 'text' },
      { name: 'footer_about_text', label: 'Footer About Text', type: 'textarea' },
      { name: 'footer_quick_links_title', label: 'Quick Links Title', type: 'text' },
      { name: 'footer_quick_link_1', label: 'Quick Link 1 Label', type: 'text' },
      { name: 'footer_quick_link_2', label: 'Quick Link 2 Label', type: 'text' },
      { name: 'footer_quick_link_3', label: 'Quick Link 3 Label', type: 'text' },
      { name: 'footer_quick_link_4', label: 'Quick Link 4 Label', type: 'text' },
      { name: 'footer_quick_link_5', label: 'Quick Link 5 Label', type: 'text' },
      { name: 'footer_quick_link_6', label: 'Quick Link 6 Label', type: 'text' },
      { name: 'footer_contact_title', label: 'Contact Column Title', type: 'text' },
      { name: 'footer_phone', label: 'Footer Phone', type: 'text' },
      { name: 'footer_address', label: 'Footer Address', type: 'textarea' },
      { name: 'footer_social_title', label: 'Social Column Title', type: 'text' },
      { name: 'footer_social_instagram', label: 'Instagram URL', type: 'text' },
      { name: 'footer_social_facebook', label: 'Facebook URL', type: 'text' },
      { name: 'footer_social_youtube', label: 'YouTube URL', type: 'text' },
      { name: 'footer_social_twitter', label: 'Twitter/X URL', type: 'text' },
      { name: 'footer_social_whatsapp', label: 'WhatsApp URL', type: 'text' },
      { name: 'footer_copyright', label: 'Footer Copyright (HTML allowed)', type: 'textarea' }
    ]
  },
  'site-config': {
    kind: 'singleton',
    endpoint: '/api/admin/site-config',
    fields: [
      { name: 'footer_brand_name', label: 'Footer Brand Name', type: 'text' },
      { name: 'footer_about_text', label: 'Footer About Text', type: 'textarea' },
      { name: 'footer_quick_links_title', label: 'Quick Links Title', type: 'text' },
      { name: 'footer_quick_link_1', label: 'Quick Link 1 Label', type: 'text' },
      { name: 'footer_quick_link_2', label: 'Quick Link 2 Label', type: 'text' },
      { name: 'footer_quick_link_3', label: 'Quick Link 3 Label', type: 'text' },
      { name: 'footer_quick_link_4', label: 'Quick Link 4 Label', type: 'text' },
      { name: 'footer_quick_link_5', label: 'Quick Link 5 Label', type: 'text' },
      { name: 'footer_quick_link_6', label: 'Quick Link 6 Label', type: 'text' },
      { name: 'footer_contact_title', label: 'Contact Column Title', type: 'text' },
      { name: 'footer_phone', label: 'Footer Phone', type: 'text' },
      { name: 'footer_address', label: 'Footer Address', type: 'textarea' },
      { name: 'footer_social_title', label: 'Social Column Title', type: 'text' },
      { name: 'footer_social_instagram', label: 'Instagram URL', type: 'text' },
      { name: 'footer_social_facebook', label: 'Facebook URL', type: 'text' },
      { name: 'footer_social_youtube', label: 'YouTube URL', type: 'text' },
      { name: 'footer_social_twitter', label: 'Twitter/X URL', type: 'text' },
      { name: 'footer_social_whatsapp', label: 'WhatsApp URL', type: 'text' },
      { name: 'footer_copyright', label: 'Footer Copyright (HTML allowed)', type: 'textarea' }
    ]
  },
  courses: {
    kind: 'collection',
    endpoint: '/api/admin/courses',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { name: 'slug', label: 'Slug', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'language', label: 'Language', type: 'text' },
      { name: 'badge', label: 'Badge', type: 'text' },
      { name: 'students', label: 'Students Label', type: 'text' },
      { name: 'thumbnail_url', label: 'Thumbnail URL', type: 'text' },
      { name: 'price_inr', label: 'Price (INR)', type: 'number', step: '0.01' },
      { name: 'payment_link', label: 'Payment Link', type: 'text' },
      { name: 'redirect_url', label: 'Redirect URL (Optional)', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'course-page-blocks': {
    kind: 'collection',
    endpoint: '/api/admin/course-page-blocks',
    fields: [
      { name: 'course_slug', label: 'Course Slug', type: 'text', required: true },
      { name: 'slug', label: 'Legacy Slug (Optional)', type: 'text' },
      { name: 'block_type', label: 'Block Type (about|highlights|learn|not_for|faq)', type: 'text', required: true, placeholder: 'about' },
      { name: 'title', label: 'Title', type: 'text', placeholder: 'Example: Why this course works' },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea', placeholder: 'Short supporting line under the title.' },
      { name: 'body', label: 'Body', type: 'textarea', placeholder: 'Main explanation paragraph for this block.' },
      { name: 'bullets', label: 'Bullets (one point per line)', type: 'textarea', placeholder: 'Point 1\nPoint 2\nPoint 3' },
      { name: 'image_url', label: 'Image URL', type: 'text', placeholder: 'https://.../course-block-image.jpg' },
      { name: 'bg_color', label: 'Background Color', type: 'color' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'course-for-you-cards': {
    kind: 'collection',
    endpoint: '/api/admin/course-for-you-cards',
    fields: [
      { name: 'course_slug', label: 'Course Slug', type: 'text', required: true },
      { name: 'slug', label: 'Legacy Slug (Optional)', type: 'text' },
      { name: 'card_title', label: 'Card Title', type: 'text', placeholder: 'Example: Beginners in trading' },
      { name: 'card_body', label: 'Card Body', type: 'textarea', placeholder: 'Who this course is for and what result they can expect.' },
      { name: 'icon_url', label: 'Icon/Image URL', type: 'text', placeholder: 'https://.../icon.png' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  webinars: {
    kind: 'collection',
    endpoint: '/api/admin/webinars',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { name: 'slug', label: 'Slug', type: 'text' },
      { name: 'banner_url', label: 'Banner URL', type: 'text' },
      { name: 'host_image_url', label: 'Host Image URL', type: 'text' },
      { name: 'host_name', label: 'Host Name', type: 'text' },
      { name: 'platform', label: 'Platform', type: 'text' },
      { name: 'timezone', label: 'Timezone', type: 'text' },
      { name: 'start_datetime_local', label: 'Start Date & Time', type: 'datetime-local' },
      { name: 'end_datetime_local', label: 'End Date & Time', type: 'datetime-local' },
      { name: 'price_inr', label: 'Price (INR)', type: 'number', step: '0.01' },
      { name: 'is_free', label: 'Free Webinar', type: 'checkbox' },
      { name: 'payment_link', label: 'Payment Link', type: 'text' },
      { name: 'primary_cta_text', label: 'Primary CTA Text', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'webinar-page-blocks': {
    kind: 'collection',
    endpoint: '/api/admin/webinar-page-blocks',
    fields: [
      { name: 'webinar_slug', label: 'Webinar Slug', type: 'text', required: true },
      { name: 'slug', label: 'Legacy Slug (Optional)', type: 'text' },
      { name: 'block_type', label: 'Block Type (overview|who_for|faq)', type: 'text', required: true, placeholder: 'overview' },
      { name: 'title', label: 'Title', type: 'text', placeholder: 'Example: What you will learn in this webinar' },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea', placeholder: 'One-line summary for this webinar block.' },
      { name: 'body', label: 'Body', type: 'textarea', placeholder: 'Main webinar copy for this section.' },
      { name: 'bullets', label: 'Bullets (one point per line)', type: 'textarea', placeholder: 'Takeaway 1\nTakeaway 2\nTakeaway 3' },
      { name: 'image_url', label: 'Image URL', type: 'text', placeholder: 'https://.../webinar-block.jpg' },
      { name: 'bg_color', label: 'Background Color', type: 'color' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'webinar-key-points-cards': {
    kind: 'collection',
    endpoint: '/api/admin/webinar-key-points-cards',
    fields: [
      { name: 'webinar_slug', label: 'Webinar Slug', type: 'text', required: true },
      { name: 'slug', label: 'Legacy Slug (Optional)', type: 'text' },
      { name: 'title', label: 'Title', type: 'text', placeholder: 'Example: Live Q&A and strategy session' },
      { name: 'body', label: 'Body', type: 'textarea', placeholder: 'Brief explanation of this key point.' },
      { name: 'icon_url', label: 'Icon/Image URL', type: 'text', placeholder: 'https://.../key-point-icon.png' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'digital-products': {
    kind: 'collection',
    endpoint: '/api/admin/digital-products',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { name: 'slug', label: 'Slug', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'language', label: 'Language', type: 'text' },
      { name: 'badge', label: 'Badge', type: 'text' },
      { name: 'thumbnail_url', label: 'Thumbnail URL', type: 'text' },
      { name: 'price_inr', label: 'Price (INR)', type: 'number', step: '0.01' },
      { name: 'preview_url', label: 'Preview URL', type: 'text' },
      { name: 'payment_link', label: 'Payment Link', type: 'text' },
      { name: 'redirect_url', label: 'Redirect URL (Optional)', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'digital-product-details': {
    kind: 'collection',
    endpoint: '/api/admin/digital-product-details',
    fields: [
      { name: 'product_slug', label: 'Product Slug', type: 'text', required: true },
      { name: 'slug', label: 'Legacy Slug (Optional)', type: 'text' },
      { name: 'section_type', label: 'Section Type (overview|outcomes|faq)', type: 'text', required: true, placeholder: 'overview' },
      { name: 'heading', label: 'Heading', type: 'text', placeholder: 'Example: What is included in this product' },
      { name: 'body', label: 'Body', type: 'textarea', placeholder: 'Describe the product section in detail.' },
      { name: 'file_includes', label: 'File Includes (one item per line)', type: 'textarea', placeholder: 'PDF Workbook\nChecklist\nBonus Template' },
      { name: 'bullets', label: 'Bullets (one point per line)', type: 'textarea', placeholder: 'Benefit 1\nBenefit 2\nBenefit 3' },
      { name: 'image_url', label: 'Image URL', type: 'text', placeholder: 'https://.../digital-section-image.jpg' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'short-reviews': {
    kind: 'collection',
    endpoint: '/api/admin/short-reviews',
    hiddenColumns: ['course_slug', 'webinar_slug'],
    fields: [
      { name: 'slug', label: 'Select Existing Slugs (multi-select)', type: 'slug-multiselect', required: true, helperText: 'Only existing slugs are allowed. Use Ctrl/Cmd + click for multiple.' },
      { name: 'review_text', label: 'Review Text', type: 'textarea', required: true },
      { name: 'name', label: 'Reviewer Name', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'featured-reviews': {
    kind: 'collection',
    endpoint: '/api/admin/featured-reviews',
    hiddenColumns: ['course_slug', 'webinar_slug'],
    fields: [
      { name: 'slug', label: 'Select Existing Slugs (multi-select)', type: 'slug-multiselect', required: true, helperText: 'Only existing slugs are allowed. Use Ctrl/Cmd + click for multiple.' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'review_text', label: 'Review Text', type: 'textarea', required: true },
      { name: 'name', label: 'Reviewer Name', type: 'text' },
      { name: 'image_url', label: 'Image URL', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  membership: {
    kind: 'collection',
    endpoint: '/api/admin/membership',
    fields: [
      { name: 'plan_id', label: 'Plan ID (Slug)', type: 'text' },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'price_inr', label: 'Price (INR)', type: 'number', step: '0.01' },
      { name: 'period', label: 'Period', type: 'text' },
      { name: 'recommended', label: 'Recommended', type: 'checkbox' },
      { name: 'image_url', label: 'Plan Image URL', type: 'text' },
      { name: 'payment_link', label: 'Community Embed Form Link', type: 'text' },
      { name: 'features', label: 'Features', type: 'textarea' },
      { name: 'target_audience', label: 'Target Audience', type: 'textarea' },
      { name: 'benefits', label: 'Benefits', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'gallery-images': {
    kind: 'collection',
    endpoint: '/api/admin/gallery-images',
    fields: [
      { name: 'image_url', label: 'Image URL', type: 'text', required: true },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'alt_text', label: 'Alt Text', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'academy-sections': {
    kind: 'collection',
    endpoint: '/api/admin/academy-sections',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'icon_emoji', label: 'Icon Emoji', type: 'text' },
      { name: 'details', label: 'Details', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  },
  'academy-community': {
    kind: 'collection',
    endpoint: '/api/admin/academy-community',
    fields: [
      { name: 'post_type', label: 'Post Type', type: 'text' },
      { name: 'content', label: 'Content', type: 'textarea', required: true },
      { name: 'author', label: 'Author', type: 'text' },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
      { name: 'order', label: 'Order', type: 'number' }
    ]
  }
};

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function canWrite() {
  const role = String(state.user && state.user.role || 'viewer').toLowerCase();
  return (roleRank[role] || 0) >= roleRank.editor;
}

function isOwner() {
  const role = String(state.user && state.user.role || 'viewer').toLowerCase();
  return role === 'owner';
}

function applyRoleVisibility() {
  el.menuList.querySelectorAll('[data-role]').forEach((node) => {
    const required = String(node.dataset.role || '').toLowerCase();
    const allowed = required === '' || required === 'any' || (required === 'owner' && isOwner());
    node.style.display = allowed ? '' : 'none';
  });
}

function updateCurrentUserBadge() {
  if (!state.user) {
    el.currentUserBadge.textContent = 'Signed out';
    return;
  }
  const role = String(state.user.role || 'viewer').toUpperCase();
  const label = state.user.email || state.user.username || 'Admin';
  el.currentUserBadge.textContent = `${label} (${role})`;
}

async function applyAcademyDataVisibility(_forceRefresh = false) {
  // Community and academy sections should stay visible for phased content creation, even when empty.
  const targets = ['academy-sections', 'academy-community'];
  targets.forEach((section) => {
    const btn = el.menuList.querySelector(`button[data-section="${section}"]`);
    if (!btn) return;
    btn.style.display = '';
  });
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false || data.success === false) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function escapeHtml(input) {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toInputValue(type, value) {
  if (value === null || value === undefined) return '';
  if (type === 'checkbox') return Number(value) === 1;
  if (type === 'color') return normalizeHexColor(value);
  if (type === 'datetime-local') {
    const normalized = String(value).replace(' ', 'T');
    return normalized.slice(0, 16);
  }
  return String(value);
}

function renderField(field, value = '') {
  const helperText = field.helperText || getImageFieldHint(field);

  if (field.type === 'checkbox') {
    const checked = toInputValue('checkbox', value) ? 'checked' : '';
    const disabled = !canWrite() ? 'disabled' : '';
    return `<label class="field checkbox-field"><input type="checkbox" name="${field.name}" ${checked} ${disabled}> ${field.label}</label>`;
  }

  if (field.type === 'slug-multiselect') {
    const disabled = !canWrite() ? 'disabled' : '';
    return `
      <label class="field">
        <span>${field.label}</span>
        <select name="${field.name}" multiple size="8" ${field.required ? 'required' : ''} ${disabled}></select>
        ${field.helperText ? `<small>${escapeHtml(field.helperText)}</small>` : ''}
      </label>
    `;
  }

  if (field.type === 'textarea') {
    const placeholder = field.placeholder || getDefaultPlaceholder(field);
    const textValue = isListValueField(field)
      ? normalizeListValueForEditor(value)
      : toInputValue(field.type, value);
    return `
      <label class="field">
        <span>${field.label}</span>
        <textarea name="${field.name}" ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} ${field.required ? 'required' : ''} ${!canWrite() ? 'disabled' : ''}>${escapeHtml(textValue)}</textarea>
        ${helperText ? `<small>${escapeHtml(helperText)}</small>` : ''}
      </label>
    `;
  }

  const placeholder = field.placeholder || getDefaultPlaceholder(field);

  return `
    <label class="field">
      <span>${field.label}</span>
      <input
        type="${field.type || 'text'}"
        name="${field.name}"
        value="${escapeHtml(toInputValue(field.type, value))}"
        ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
        ${field.step ? `step="${field.step}"` : ''}
        ${field.required ? 'required' : ''}
        ${!canWrite() ? 'disabled' : ''}
      >
      ${helperText ? `<small>${escapeHtml(helperText)}</small>` : ''}
    </label>
  `;
}

function getDefaultPlaceholder(field) {
  const label = String(field && field.label || '').trim();
  const type = String(field && field.type || 'text').toLowerCase();
  if (!label) return '';

  if (type === 'number') return `Enter ${label} as a number`;
  if (type === 'datetime-local') return `Select ${label.toLowerCase()}`;
  if (type === 'email') return `Enter ${label.toLowerCase()} (example@domain.com)`;
  if (type === 'password') return `Enter ${label.toLowerCase()}`;
  if (type === 'textarea') return `Write ${label.toLowerCase()} here`;
  return `Enter ${label.toLowerCase()}`;
}

function getImageFieldHint(field = {}) {
  const fieldName = String(field.name || '').toLowerCase();
  const fieldLabel = String(field.label || '').toLowerCase();
  const haystack = `${fieldName} ${fieldLabel}`;
  if (!/(image|thumbnail|banner|logo|avatar|photo)/.test(haystack)) return '';
  if (fieldName.includes('banner')) return 'Recommended image size: 1600 x 900 px (16:9)';
  if (fieldName.includes('thumbnail')) return 'Recommended image size: 1200 x 800 px (3:2)';
  if (fieldName.includes('host') || fieldName.includes('founder') || fieldName.includes('avatar') || fieldName.includes('photo')) {
    return 'Recommended image size: 800 x 800 px (1:1)';
  }
  if (fieldName.includes('logo')) return 'Recommended image size: 800 x 800 px (1:1)';
  return 'Recommended image size: 1200 x 800 px (3:2)';
}

function collectFormData(form, fields) {
  const payload = {};
  fields.forEach(field => {
    const node = form.elements[field.name];
    if (!node) return;

    if (field.type === 'checkbox') {
      payload[field.name] = node.checked ? 1 : 0;
      return;
    }

    if (field.type === 'slug-multiselect') {
      const selected = Array.from(node.options || []).filter((opt) => opt.selected).map((opt) => String(opt.value || '').trim()).filter(Boolean);
      payload[field.name] = selected.join(',');
      return;
    }

    const raw = node.value;
    if (field.type === 'number') {
      payload[field.name] = raw === '' ? null : Number(raw);
      return;
    }

    if (field.type === 'color') {
      payload[field.name] = normalizeHexColor(raw);
      return;
    }

    if (field.type === 'textarea' && isListValueField(field)) {
      payload[field.name] = normalizeListValueForStorage(raw);
      return;
    }

    payload[field.name] = raw;
  });
  return payload;
}

function renderRowsTable(rows, editable = true, includeToggle = false, hiddenColumns = []) {
  if (!rows.length) {
    return '<p>No records yet.</p>';
  }

  const hiddenSet = new Set((Array.isArray(hiddenColumns) ? hiddenColumns : []).map((h) => String(h || '').trim()).filter(Boolean));
  const headers = Object.keys(rows[0]).filter((h) => !hiddenSet.has(h));
  const actionHeader = editable ? '<th>Actions</th>' : '';
  const bodyRows = rows.map(r => {
    const tds = headers.map(h => `<td>${escapeHtml(r[h])}</td>`).join('');
    let actions = '';
    if (editable) {
      const toggleBtn = includeToggle
        ? `<button class="mini-btn" data-act="toggle-active" data-id="${r.id}">${Number(r.is_active) === 1 ? 'Disable' : 'Enable'}</button>`
        : '';
      actions = `<td>${toggleBtn} <button class="mini-btn" data-act="edit" data-id="${r.id}">Edit</button> <button class="mini-btn danger" data-act="delete" data-id="${r.id}">Delete</button></td>`;
    }
    const rowClass = (includeToggle && Number(r.is_active) !== 1) ? ' class="row-disabled"' : '';
    return `<tr${rowClass}>${tds}${actions}</tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}${actionHeader}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function nl2brSafe(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function looksLikeImageUrl(value = '') {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(value);
}

function looksLikeVideoUrl(value = '') {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value);
}

function isLikelyImageField(name = '') {
  return /(image|thumbnail|banner|logo|photo|avatar)/i.test(name);
}

function isLikelyVideoField(name = '') {
  return /(video|youtube|vimeo|reel|clip)/i.test(name);
}

function toYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
  } catch (_err) {
    return '';
  }
  return '';
}

function buildMediaPreview(field, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const safeLabel = escapeHtml(field.label || field.name);
  const safeUrl = escapeHtml(trimmed);
  const isImage = isLikelyImageField(field.name) || looksLikeImageUrl(trimmed);
  const isVideo = isLikelyVideoField(field.name) || looksLikeVideoUrl(trimmed);

  if (isImage) {
    return `
      <article class="media-card">
        <h4>${safeLabel}</h4>
        <img src="${safeUrl}" alt="${safeLabel}" loading="lazy">
      </article>
    `;
  }

  if (isVideo) {
    const youtubeEmbed = toYouTubeEmbedUrl(trimmed);
    if (youtubeEmbed) {
      return `
        <article class="media-card">
          <h4>${safeLabel}</h4>
          <iframe src="${escapeHtml(youtubeEmbed)}" title="${safeLabel}" loading="lazy" allowfullscreen></iframe>
        </article>
      `;
    }

    if (looksLikeVideoUrl(trimmed)) {
      return `
        <article class="media-card">
          <h4>${safeLabel}</h4>
          <video controls preload="metadata" src="${safeUrl}"></video>
        </article>
      `;
    }

    return `
      <article class="media-card">
        <h4>${safeLabel}</h4>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open video link</a>
      </article>
    `;
  }

  return '';
}

function buildPreviewHtml(payload, fields, emptyText = 'Start typing to see a preview.') {
  const contentItems = [];
  const mediaItems = [];

  fields.forEach((field) => {
    const value = payload[field.name];
    if (field.type === 'checkbox') {
      contentItems.push(`
        <article class="preview-item">
          <h4>${escapeHtml(field.label)}</h4>
          <p>${Number(value) === 1 ? 'Enabled' : 'Disabled'}</p>
        </article>
      `);
      return;
    }

    const text = String(value ?? '').trim();
    if (!text) return;

    const media = buildMediaPreview(field, text);
    if (media) {
      mediaItems.push(media);
      return;
    }

    contentItems.push(`
      <article class="preview-item">
        <h4>${escapeHtml(field.label)}</h4>
        <p>${nl2brSafe(text)}</p>
      </article>
    `);
  });

  if (!contentItems.length && !mediaItems.length) {
    return `<p class="preview-empty">${escapeHtml(emptyText)}</p>`;
  }

  const mediaBlock = mediaItems.length
    ? `<div class="preview-media-grid">${mediaItems.join('')}</div>`
    : '';

  const contentBlock = contentItems.length
    ? `<div class="preview-grid">${contentItems.join('')}</div>`
    : '';

  return `${mediaBlock}${contentBlock}`;
}

function wireFormPreview(form, fields, previewBodyId, emptyText) {
  const previewBody = document.getElementById(previewBodyId);
  if (!previewBody) return () => {};

  const update = () => {
    const payload = collectFormData(form, fields);
    previewBody.innerHTML = buildPreviewHtml(payload, fields, emptyText);
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
  return update;
}

function setCollectionFormRowValues(form, cfg, row) {
  if (!form || !row) return;
  form.elements.id.value = String(row.id);
  cfg.fields.forEach(field => {
    const input = form.elements[field.name];
    if (!input) return;
    if (field.type === 'checkbox') {
      input.checked = Number(row[field.name]) === 1;
    } else if (field.type === 'slug-multiselect') {
      setMultiSelectValues(input, row[field.name]);
    } else {
      input.value = toInputValue(field.type, row[field.name]);
    }
  });
}

async function renderIntegratedChildren(sectionKey, parentRow) {
  const root = document.getElementById('integratedChildrenRoot');
  if (!root) return;

  const groups = integratedChildSections[sectionKey] || [];
  if (!groups.length) {
    root.innerHTML = '';
    return;
  }

  const parentSlug = String(parentRow && parentRow.slug || '').trim();
  if (!parentSlug) {
    root.innerHTML = '<p class="form-status">Save a valid parent slug first to manage integrated modal content.</p>';
    return;
  }

  const payloads = await Promise.all(groups.map(async (g) => {
    const cfg = sectionConfigs[g.key];
    const res = await api(cfg.endpoint);
    const allRows = Array.isArray(res.data) ? res.data : [];
    const rows = allRows.filter((r) => String(r[g.parentField] || '').trim() === parentSlug || String(r.slug || '').trim() === parentSlug);
    return { group: g, cfg, rows };
  }));

  root.innerHTML = payloads.map((block) => {
    const { group, cfg, rows } = block;
    const fields = cfg.fields.filter((f) => f.name !== group.parentField);
    const body = rows.length
      ? renderRowsTable(rows, canWrite())
      : '<p>No records yet for this item.</p>';
    return `
      <div class="crud-form" data-child-group="${group.key}">
        <h3>${escapeHtml(group.title)} (${escapeHtml(parentSlug)})</h3>
        <form class="nestedChildForm" data-child-key="${group.key}">
          <input type="hidden" name="id" value="">
          <div class="form-grid">
            ${fields.map((f) => renderField(f, f.type === 'checkbox' ? 1 : '')).join('')}
          </div>
          <div class="form-actions">
            <button type="submit" ${!canWrite() ? 'disabled' : ''}>Add</button>
            <button type="button" class="ghost-btn" data-child-reset="${group.key}" ${!canWrite() ? 'disabled' : ''}>Reset</button>
            <p class="form-status" data-child-status="${group.key}"></p>
          </div>
        </form>
        ${body}
      </div>
    `;
  }).join('');

  payloads.forEach((block) => {
    const { group, cfg, rows } = block;
    const wrapper = root.querySelector(`[data-child-group="${group.key}"]`);
    if (!wrapper) return;
    const form = wrapper.querySelector('form.nestedChildForm');
    const status = wrapper.querySelector(`[data-child-status="${group.key}"]`);
    const resetBtn = wrapper.querySelector(`[data-child-reset="${group.key}"]`);
    const filteredFields = cfg.fields.filter((f) => f.name !== group.parentField);

    function resetChildForm() {
      form.reset();
      form.elements.id.value = '';
      filteredFields.forEach((field) => {
        if (field.type !== 'checkbox') return;
        const input = form.elements[field.name];
        if (input) input.checked = true;
      });
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Add';
      status.textContent = '';
    }

    resetBtn.addEventListener('click', resetChildForm);
    resetChildForm();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canWrite()) {
        status.textContent = 'Read-only access for your role.';
        return;
      }
      status.textContent = 'Saving...';
      const payload = collectFormData(form, filteredFields);
      payload[group.parentField] = parentSlug;
      if (!payload.slug) payload.slug = parentSlug;

      try {
        const itemId = form.elements.id.value;
        if (itemId) {
          await api(`${cfg.endpoint}/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          await api(cfg.endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        await renderIntegratedChildren(sectionKey, parentRow);
      } catch (error) {
        status.textContent = error.message;
      }
    });

    wrapper.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || !canWrite()) return;
      const action = btn.dataset.act;
      const id = Number(btn.dataset.id);
      const found = rows.find((r) => Number(r.id) === id);
      if (!found) return;

      if (action === 'edit') {
        form.elements.id.value = String(id);
        filteredFields.forEach((field) => {
          const input = form.elements[field.name];
          if (!input) return;
          if (field.type === 'checkbox') {
            input.checked = Number(found[field.name]) === 1;
          } else {
            input.value = toInputValue(field.type, found[field.name]);
          }
        });
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Update';
        status.textContent = `Editing #${id}`;
        return;
      }

      if (action === 'delete') {
        if (!window.confirm(`Delete record #${id}?`)) return;
        status.textContent = 'Deleting...';
        try {
          await api(`${cfg.endpoint}/${id}`, { method: 'DELETE' });
          await renderIntegratedChildren(sectionKey, parentRow);
        } catch (error) {
          status.textContent = error.message;
        }
      }
    });
  });
}

async function setSection(section) {
  state.section = section;
  el.menuList.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  el.sectionTitle.textContent = sectionTitleFromKey(section);

  const token = ++state.sectionRenderToken;
  const startedAt = Date.now();
  showSectionLoading(section);

  try {
    await renderSection();
  } finally {
    const elapsed = Date.now() - startedAt;
    const minMs = 220;
    if (elapsed < minMs) {
      await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
    }
    if (token === state.sectionRenderToken) {
      hideSectionLoading();
    }
  }
}

async function renderDashboard() {
  setPanelBodyClickHandler(null);
  el.panelBody.innerHTML = `
    <div class="grid-cards">
      <article class="kpi"><h3>Courses</h3><p id="kpiCourses">-</p></article>
      <article class="kpi"><h3>Webinars</h3><p id="kpiWebinars">-</p></article>
      <article class="kpi"><h3>Digital Products</h3><p id="kpiDigital">-</p></article>
      <article class="kpi"><h3>Academy Posts</h3><p id="kpiCommunity">-</p></article>
    </div>
    <div class="crud-form" style="margin-top:16px;">
      <h3>System Actions</h3>
      <div class="form-actions">
        <button id="healthBtn" type="button">Check API Health</button>
        <button id="syncBtn" type="button" ${!canWrite() ? 'disabled' : ''}>Sync WebApp to MySQL</button>
        <p id="dashboardStatus" class="form-status"></p>
      </div>
    </div>
  `;
  try {
    const [c, w, d, ac] = await Promise.all([
      apiGetCached('/api/admin/courses'),
      apiGetCached('/api/admin/webinars'),
      apiGetCached('/api/admin/digital-products'),
      apiGetCached('/api/admin/academy-community')
    ]);

    document.getElementById('kpiCourses').textContent = c.data.length;
    document.getElementById('kpiWebinars').textContent = w.data.length;
    document.getElementById('kpiDigital').textContent = d.data.length;
    document.getElementById('kpiCommunity').textContent = ac.data.length;

    const statusNode = document.getElementById('dashboardStatus');
    const healthBtn = document.getElementById('healthBtn');
    const syncBtn = document.getElementById('syncBtn');

    healthBtn.addEventListener('click', async () => {
      statusNode.textContent = 'Checking health...';
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        const data = await res.json();
        statusNode.textContent = data && data.ok ? 'API health: OK' : 'API health: Failed';
      } catch (_err) {
        statusNode.textContent = 'API health check failed.';
      }
    });

    if (syncBtn && canWrite()) {
      syncBtn.addEventListener('click', async () => {
        statusNode.textContent = 'Syncing from WebApp to MySQL...';
        try {
          const sync = await api('/api/admin/sync-webapp', { method: 'POST', body: JSON.stringify({}) });
          const counts = sync && sync.data && sync.data.counts ? sync.data.counts : {};
          const compact = Object.keys(counts).slice(0, 4).map((k) => `${k}:${counts[k]}`).join(', ');
          statusNode.textContent = compact ? `Sync complete (${compact}...)` : 'Sync complete.';
          clearDataCache();
          await setSection('dashboard');
        } catch (err) {
          statusNode.textContent = err.message;
        }
      });
    }
  } catch (err) {
    el.panelBody.insertAdjacentHTML('beforeend', `<p>${err.message}</p>`);
  }
}

async function renderSingletonSection(cfg) {
  setPanelBodyClickHandler(null);
  const res = await apiGetCached(cfg.endpoint);

  const logoUploadCard = state.section === 'contact'
    ? `
      <div class="crud-form" id="logoUploadCard">
        <h3>Site Logo Upload</h3>
        <label class="field">
          <span>Upload Logo Image (stored in assets folder)</span>
          <input type="file" id="siteLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" ${!canWrite() ? 'disabled' : ''}>
          <small>Uploading a logo will apply it site-wide for navbar, footer, and loading logo.</small>
        </label>
        <div class="form-actions">
          <button type="button" id="siteLogoUploadBtn" ${!canWrite() ? 'disabled' : ''}>Upload And Apply Site-Wide</button>
          <p id="siteLogoUploadStatus" class="form-status"></p>
        </div>
      </div>
    `
    : '';

  el.panelBody.innerHTML = `
    <form id="singletonForm" class="crud-form">
      <div class="form-grid">
        ${cfg.fields.map(f => renderField(f, res.data ? res.data[f.name] : '')).join('')}
      </div>
      <div class="form-actions">
        <button type="submit" ${!canWrite() ? 'disabled' : ''}>Save Changes</button>
        <p id="formStatus" class="form-status"></p>
      </div>
      <div class="preview-panel">
        <h3>Live Preview (Before Save)</h3>
        <div id="singletonPreview" class="preview-body"></div>
      </div>
    </form>
    ${logoUploadCard}
    <h3>Current Data</h3>
    ${renderRowsTable(res.data ? [res.data] : [], false)}
  `;

  const form = document.getElementById('singletonForm');
  const status = document.getElementById('formStatus');
  wireFormPreview(form, cfg.fields, 'singletonPreview', 'No values entered yet.');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      status.textContent = 'Read-only access for your role.';
      return;
    }
    status.textContent = 'Saving...';
    try {
      const payload = collectFormData(form, cfg.fields);
      await api(cfg.endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      invalidateCache(cfg.endpoint);
      status.textContent = 'Saved successfully.';
      await renderSingletonSection(cfg);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  if (state.section === 'contact') {
    const fileInput = document.getElementById('siteLogoFile');
    const uploadBtn = document.getElementById('siteLogoUploadBtn');
    const uploadStatus = document.getElementById('siteLogoUploadStatus');

    if (uploadBtn && fileInput && uploadStatus) {
      uploadBtn.addEventListener('click', async () => {
        if (!canWrite()) {
          uploadStatus.textContent = 'Read-only access for your role.';
          return;
        }

        const file = (fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
        if (!file) {
          uploadStatus.textContent = 'Please choose a logo image first.';
          return;
        }

        uploadStatus.textContent = 'Uploading logo...';
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read selected file'));
            reader.readAsDataURL(file);
          });

          const parts = dataUrl.split(',');
          if (parts.length < 2) {
            throw new Error('Invalid file data');
          }

          const uploaded = await api('/api/admin/assets/logo', {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              base64Data: parts[1]
            })
          });

          invalidateCache('/api/site-assets');
          uploadStatus.textContent = 'Logo uploaded and applied site-wide.';

          const saved = uploaded && uploaded.data ? uploaded.data : null;
          if (saved && saved.navbar_logo_url) {
            uploadStatus.textContent = `Logo uploaded: ${saved.navbar_logo_url}`;
          }
        } catch (error) {
          uploadStatus.textContent = error.message;
        }
      });
    }
  }
}

async function renderCollectionSection(cfg) {
  const res = await apiGetCached(cfg.endpoint);
  const rows = res.data || [];
  const integratedGroups = integratedChildSections[state.section] || [];

  const canClone = cloneEnabledSections.has(state.section);
  const modeConfig = sectionModeConfigs[state.section] || null;
  const sectionMode = modeConfig ? (state.editorModeBySection[state.section] || 'simple') : 'advanced';
  const showStructuredBuilder = structuredBuilderSections.has(state.section) && sectionMode === 'simple';

  const fieldsByName = new Map(cfg.fields.map((f) => [f.name, f]));
  const simpleContentFields = modeConfig
    ? modeConfig.content.map((name) => fieldsByName.get(name)).filter(Boolean)
    : [];
  const simpleReviewFields = modeConfig
    ? modeConfig.review.map((name) => fieldsByName.get(name)).filter(Boolean)
    : [];
  const activeFields = modeConfig && sectionMode === 'simple'
    ? [...simpleContentFields, ...simpleReviewFields]
    : cfg.fields;

  const blankValues = {};
  activeFields.forEach(field => {
    if (field.type === 'checkbox') {
      blankValues[field.name] = 1;
    } else if (field.type === 'color') {
      blankValues[field.name] = '#FFFFFF';
    } else {
      blankValues[field.name] = '';
    }
  });

  const modeSwitchHtml = modeConfig
    ? `
      <div class="mode-switch-row">
        <span class="mode-switch-title">Editor Mode</span>
        <div class="mode-switch-actions">
          <button type="button" class="ghost-btn ${sectionMode === 'simple' ? 'active' : ''}" data-mode-switch="simple">Simple</button>
          <button type="button" class="ghost-btn ${sectionMode === 'advanced' ? 'active' : ''}" data-mode-switch="advanced">Advanced</button>
        </div>
      </div>
    `
    : '';

  const fieldsHtml = modeConfig && sectionMode === 'simple'
    ? `
      <div class="simple-builder-group">
        <h4>Content Builder</h4>
        <div class="form-grid">
          ${simpleContentFields.map((f) => renderField(f, blankValues[f.name])).join('')}
        </div>
      </div>
      ${renderStructuredBuilderHtml(state.section, !canWrite())}
      <div class="simple-builder-group">
        <h4>Review Section</h4>
        <div class="form-grid">
          ${simpleReviewFields.map((f) => renderField(f, blankValues[f.name])).join('')}
        </div>
      </div>
    `
    : `<div class="form-grid">${activeFields.map((f) => renderField(f, blankValues[f.name])).join('')}</div>`;

  el.panelBody.innerHTML = `
    <form id="collectionForm" class="crud-form">
      <input type="hidden" name="id" value="">
      <h3 id="collectionFormTitle">Create New</h3>
      ${modeSwitchHtml}
      ${canClone ? `
      <div class="field">
        <span>Clone From Existing</span>
        <select id="cloneSourceId" ${!canWrite() ? 'disabled' : ''}>
          <option value="">Select existing record</option>
          ${rows.map((r) => `<option value="${Number(r.id)}">${escapeHtml(getCloneRowLabel(r))}</option>`).join('')}
        </select>
        <small>Loads selected record data into this New form as a copy.</small>
      </div>
      <div class="form-actions">
        <button type="button" id="cloneSelectedBtn" class="ghost-btn" ${!canWrite() ? 'disabled' : ''}>Clone Selected</button>
      </div>` : ''}
      ${fieldsHtml}
      <div class="form-actions">
        <button type="submit" id="collectionSubmitBtn" ${!canWrite() ? 'disabled' : ''}>Save</button>
        <button type="button" id="collectionCancelBtn" class="ghost-btn" ${!canWrite() ? 'disabled' : ''}>Reset</button>
        <p id="collectionStatus" class="form-status"></p>
      </div>
      <div class="preview-panel">
        <h3>Live Preview (Before Save)</h3>
        <div id="collectionPreview" class="preview-body"></div>
      </div>
    </form>
    <h3>Records</h3>
    ${renderRowsTable(rows, canWrite(), cfg.fields.some((f) => f.name === 'is_active'), cfg.hiddenColumns || [])}
    ${integratedGroups.length ? '<h3>Integrated Modal Content</h3><div id="integratedChildrenRoot" class="table-wrap"><p class="form-status">Select a record from above to manage modal blocks under the same section.</p></div>' : ''}
  `;

  const form = document.getElementById('collectionForm');
  const status = document.getElementById('collectionStatus');
  const formTitle = document.getElementById('collectionFormTitle');
  const submitBtn = document.getElementById('collectionSubmitBtn');
  const cancelBtn = document.getElementById('collectionCancelBtn');
  const cloneSelect = document.getElementById('cloneSourceId');
  const cloneBtn = document.getElementById('cloneSelectedBtn');

  if (modeConfig) {
    el.panelBody.querySelectorAll('[data-mode-switch]').forEach((node) => {
      node.addEventListener('click', async () => {
        const nextMode = node.dataset.modeSwitch;
        if (!nextMode || (nextMode !== 'simple' && nextMode !== 'advanced')) return;
        const prevMode = state.editorModeBySection[state.section] || 'advanced';
        if (prevMode !== nextMode) {
          recordModeSwapMetric(state.section, prevMode, nextMode);
        }
        state.editorModeBySection[state.section] = nextMode;
        await renderCollectionSection(cfg);
      });
    });
  }

  await hydrateDynamicFieldOptions(form, cfg, null);
  const updateCollectionPreview = wireFormPreview(form, activeFields, 'collectionPreview', 'Fill in this form to preview the card before creating or updating.');

  const selectedParentId = Number(state.integratedParentIdBySection[state.section] || 0);
  const selectedParentRow = rows.find((r) => Number(r.id) === selectedParentId);
  if (integratedGroups.length && selectedParentRow) {
    await hydrateDynamicFieldOptions(form, cfg, selectedParentRow);
    setCollectionFormRowValues(form, cfg, selectedParentRow);
    formTitle.textContent = `Edit #${selectedParentRow.id}`;
    submitBtn.textContent = 'Save';
    status.textContent = 'Editing record.';
    updateCollectionPreview();
    await renderIntegratedChildren(state.section, selectedParentRow);
  }

  function resetForm() {
    form.reset();
    activeFields.forEach(field => {
      const input = form.elements[field.name];
      if (!input) return;
      if (field.type === 'checkbox') {
        input.checked = true;
      } else if (field.type === 'slug-multiselect') {
        setMultiSelectValues(input, '');
      }
    });
    form.elements.id.value = '';
    if (cloneSelect) cloneSelect.value = '';
    if (showStructuredBuilder) {
      setStructuredInputValue(form, 'structuredDescription', '');
      setStructuredInputValue(form, 'structuredWhatLearn', '');
      setStructuredInputValue(form, 'structuredWhoFor', '');
      setStructuredInputValue(form, 'structuredOutcome', '');
      setStructuredInputValue(form, 'structuredGoDeeper', '');
    }
    formTitle.textContent = 'Create New';
    submitBtn.textContent = 'Save';
    status.textContent = '';
    delete state.integratedParentIdBySection[state.section];
    updateCollectionPreview();
    const integratedRoot = document.getElementById('integratedChildrenRoot');
    if (integratedRoot) {
      integratedRoot.innerHTML = '<p class="form-status">Select a record from above to manage modal blocks under the same section.</p>';
    }
  }

  if (cloneBtn && cloneSelect) {
    cloneBtn.addEventListener('click', async () => {
      if (!canWrite()) {
        status.textContent = 'Read-only access for your role.';
        return;
      }

      const sourceId = Number(cloneSelect.value || 0);
      if (!sourceId) {
        status.textContent = 'Select an existing record to clone.';
        return;
      }

      const sourceRow = rows.find((r) => Number(r.id) === sourceId);
      if (!sourceRow) {
        status.textContent = 'Selected source record was not found.';
        return;
      }

      await hydrateDynamicFieldOptions(form, cfg, sourceRow);
      setCollectionFormRowValues(form, cfg, sourceRow);
      form.elements.id.value = '';

      if (showStructuredBuilder) {
        // Phase 3: Reverse hydration for clone - load child data from source
        const sourceSlug = String(sourceRow.slug || '').trim();
        let structuredValues = { description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '' };
        
        if (sourceSlug) {
          if (state.section === 'courses') {
            structuredValues = await reverseHydrateCoursesContent(sourceSlug);
          } else if (state.section === 'webinars') {
            structuredValues = await reverseHydrateWebinarsContent(sourceSlug);
          } else if (state.section === 'digital-products') {
            structuredValues = await reverseHydrateDigitalContent(sourceSlug);
          }
        }
        
        // Apply reverse-hydrated values, or fall back to parent fields if no child data exists
        setStructuredInputValue(form, 'structuredDescription', structuredValues.description || sourceRow.subtitle || sourceRow.description || '');
        setStructuredInputValue(form, 'structuredWhatLearn', structuredValues.whatLearn || sourceRow.features || '');
        setStructuredInputValue(form, 'structuredWhoFor', structuredValues.whoFor || sourceRow.target_audience || '');
        setStructuredInputValue(form, 'structuredOutcome', structuredValues.outcome || sourceRow.benefits || '');
        setStructuredInputValue(form, 'structuredGoDeeper', structuredValues.goDeeper || '');
      }

      const uniqueNode = form.elements.slug || form.elements.plan_id;
      if (uniqueNode && String(uniqueNode.value || '').trim()) {
        const base = String(uniqueNode.value).trim();
        uniqueNode.value = base.endsWith('-copy') ? base : `${base}-copy`;
      }

      formTitle.textContent = `Create New (Cloned from #${sourceId})`;
      submitBtn.textContent = 'Save';
      status.textContent = 'Record cloned into new form. Review and save.';
      updateCollectionPreview();
    });
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      status.textContent = 'Read-only access for your role.';
      return;
    }
    status.textContent = 'Saving...';
    const saveStartTime = performance.now();
    let saveSuccess = false;
    try {
      const id = form.elements.id.value;
      const payload = collectFormData(form, activeFields);
      const structuredValues = getStructuredBuilderValues(form, state.section);

      if (showStructuredBuilder && state.section === 'membership' && structuredValues) {
        payload.description = String(structuredValues.description || '').trim();
        payload.features = normalizeListValueForStorage(structuredValues.whatLearn || '');
        payload.target_audience = normalizeListValueForStorage(structuredValues.whoFor || '');
        payload.benefits = normalizeListValueForStorage([structuredValues.outcome || '', structuredValues.goDeeper || ''].join('\n'));
      }

      const slugField = slugFieldBySection[state.section];
      if (showStructuredBuilder && slugField && !String(payload[slugField] || '').trim()) {
        const baseText = payload.title || payload.name || payload.plan_id || '';
        payload[slugField] = toSlug(baseText);
      }
      const parentSlug = String(payload[slugField] || '').trim();

      if (id) {
        await api(`${cfg.endpoint}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        invalidateCache(cfg.endpoint);
        state.integratedParentIdBySection[state.section] = Number(id);
      } else {
        await api(cfg.endpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        invalidateCache(cfg.endpoint);
        delete state.integratedParentIdBySection[state.section];
      }

      if (showStructuredBuilder && state.section !== 'membership' && hasStructuredBuilderContent(structuredValues) && parentSlug) {
        await syncSimpleStructuredContent(state.section, parentSlug, structuredValues);
      }

      await renderCollectionSection(cfg);
      saveSuccess = true;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      // Phase 5: Record save metrics
      const saveEndTime = performance.now();
      const latencyMs = Math.round(saveEndTime - saveStartTime);
      const mode = state.editorModeBySection[state.section] || 'advanced';
      recordSaveMetric(state.section, mode, latencyMs, saveSuccess);
    }
  });

  setPanelBodyClickHandler(async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || !canWrite()) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.act;
    const row = rows.find(r => Number(r.id) === id);
    if (!row) return;

    if (action === 'edit') {
      await hydrateDynamicFieldOptions(form, cfg, row);
      setCollectionFormRowValues(form, cfg, row);
      if (showStructuredBuilder) {
        // Phase 3: Reverse hydration - load from child records
        const slug = String(row.slug || '').trim();
        let structuredValues = { description: '', whatLearn: '', whoFor: '', outcome: '', goDeeper: '' };
        
        if (slug) {
          if (state.section === 'courses') {
            structuredValues = await reverseHydrateCoursesContent(slug);
          } else if (state.section === 'webinars') {
            structuredValues = await reverseHydrateWebinarsContent(slug);
          } else if (state.section === 'digital-products') {
            structuredValues = await reverseHydrateDigitalContent(slug);
          }
        }
        
        // Apply reverse-hydrated values, or fall back to parent fields if no child data exists
        setStructuredInputValue(form, 'structuredDescription', structuredValues.description || row.subtitle || row.description || '');
        setStructuredInputValue(form, 'structuredWhatLearn', structuredValues.whatLearn || row.features || '');
        setStructuredInputValue(form, 'structuredWhoFor', structuredValues.whoFor || row.target_audience || '');
        setStructuredInputValue(form, 'structuredOutcome', structuredValues.outcome || row.benefits || '');
        setStructuredInputValue(form, 'structuredGoDeeper', structuredValues.goDeeper || '');
      }
      formTitle.textContent = `Edit #${id}`;
      submitBtn.textContent = 'Save';
      status.textContent = 'Editing record.';
      state.integratedParentIdBySection[state.section] = Number(id);
      updateCollectionPreview();
      if (integratedGroups.length) {
        await renderIntegratedChildren(state.section, row);
      }
      return;
    }

    if (action === 'toggle-active') {
      try {
        await api(`${cfg.endpoint}/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: Number(row.is_active) === 1 ? 0 : 1 })
        });
        invalidateCache(cfg.endpoint);
        await renderCollectionSection(cfg);
      } catch (error) {
        status.textContent = error.message;
      }
      return;
    }

    if (action === 'delete') {
      if (!window.confirm(`Delete record #${id}?`)) return;
      try {
        await api(`${cfg.endpoint}/${id}`, { method: 'DELETE' });
        invalidateCache(cfg.endpoint);
        if (Number(state.integratedParentIdBySection[state.section] || 0) === id) {
          delete state.integratedParentIdBySection[state.section];
        }
        await renderCollectionSection(cfg);
      } catch (error) {
        status.textContent = error.message;
      }
    }
  });
}

async function renderSimplifiedCollectionSection(section) {
  setPanelBodyClickHandler(null);
  const simplifiedConfig = simplifiedSectionConfigs[section];
  if (!simplifiedConfig) {
    el.panelBody.innerHTML = '<p>Section not configured.</p>';
    return;
  }

  const res = await apiGetCached(sectionConfigs[section].endpoint);
  const rows = Array.isArray(res.data) ? res.data : [];

  // Group records by active status
  const activeRecords = rows.filter(r => Number(r.is_active ?? 1) === 1);
  const inactiveRecords = rows.filter(r => Number(r.is_active ?? 1) === 0);

  const recordsListHtml = () => {
    if (!rows.length) return '<p style="color: #999; margin-top: 16px;">No records yet. Create one using the form above.</p>';

    const renderRecord = (record, isInactive = false) => {
      const displayLabel = getCloneRowLabel(record);
      const opacity = isInactive ? '0.6' : '1';
      const bgColor = isInactive ? '#f9f9f9' : '#fff';
      return `
        <div style="opacity: ${opacity}; background: ${bgColor}; border: 1px solid #e0e0e0; padding: 12px; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>${escapeHtml(displayLabel)}</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="ghost-btn" data-act="edit" data-id="${Number(record.id)}" ${!canWrite() ? 'disabled' : ''}>Edit</button>
            <button type="button" class="ghost-btn" data-act="toggle-active" data-id="${Number(record.id)}" ${!canWrite() ? 'disabled' : ''}>
              ${isInactive ? 'Activate' : 'Deactivate'}
            </button>
            <button type="button" class="ghost-btn danger" data-act="delete" data-id="${Number(record.id)}" ${!canWrite() ? 'disabled' : ''}>Delete</button>
          </div>
        </div>
      `;
    };

    let html = '';
    if (activeRecords.length) {
      html += '<h4 style="margin-top: 20px; margin-bottom: 12px; color: #333;">Active Records</h4>';
      html += activeRecords.map(r => renderRecord(r, false)).join('');
    }
    if (inactiveRecords.length) {
      html += '<h4 style="margin-top: 20px; margin-bottom: 12px; color: #999;">Inactive Records</h4>';
      html += inactiveRecords.map(r => renderRecord(r, true)).join('');
    }
    return html;
  };

  el.panelBody.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto;">
      ${renderSimplifiedForm(section)}
      <div id="simplified-records-list" style="margin-top: 32px;">
        ${recordsListHtml()}
      </div>
    </div>
    <div id="simplified-preview-modal-${section}" class="simplified-preview-modal" aria-hidden="true">
      <div class="simplified-preview-dialog" role="dialog" aria-modal="true" aria-label="Preview Before Save">
        <div class="simplified-preview-header">
          <h3>Preview Before Save</h3>
          <button type="button" class="ghost-btn" data-simplified-preview-close>Close</button>
        </div>
        <div id="simplified-preview-body-${section}" class="preview-body"></div>
      </div>
    </div>
  `;

  const form = document.getElementById(`simplified-form-${section}`);
  const recordsList = document.getElementById('simplified-records-list');
  const statusEl = document.getElementById(`simplified-form-${section}-status`);

  if (!form) return;

  // Wire up slug auto-fill from title
  setupSimplifiedSlugAutoFill(`simplified-form-${section}`, simplifiedConfig.slugField, simplifiedConfig.color);
  const refreshSimplifiedPreview = setupSimplifiedPreviewModal(section, form, simplifiedConfig);

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      statusEl.textContent = 'Read-only access.';
      statusEl.style.color = '#d32f2f';
      return;
    }

    statusEl.textContent = 'Saving...';
    statusEl.style.color = '#1976d2';

    try {
      const formData = new FormData(form);
      const id = formData.get('id');
      const title = String(formData.get('title') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const field1 = String(formData.get('field1') || '').trim();
      const field2 = String(formData.get('field2') || '').trim();
      const field3 = String(formData.get('field3') || '').trim();
      const goDeeper = String(formData.get('goDeeper') || '').trim();
      const descriptionLabel = String(formData.get('description_label') || '').trim();
      const field1Label = String(formData.get('field1_label') || '').trim();
      const field2Label = String(formData.get('field2_label') || '').trim();
      const field3Label = String(formData.get('field3_label') || '').trim();
      const faqLabel = String(formData.get('faq_label') || '').trim();

      if (!title) {
        statusEl.textContent = 'Title is required.';
        statusEl.style.color = '#d32f2f';
        return;
      }

      const slugField = simplifiedConfig.slugField;
      const enteredSlug = String(formData.get(slugField) || '').trim();
      const baseSlug = enteredSlug || toSlug(title);
      let finalSlug = baseSlug;

      // Check for slug conflicts only when creating a new record
      if (!id) {
        let counter = 1;
        while (rows.some(r => String(r[slugField] || '').trim() === finalSlug)) {
          finalSlug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const payload = {
        title,
        [slugField]: finalSlug,
        is_active: 1
      };

      // Image/thumbnail field
      const imageVal = String(formData.get(simplifiedConfig.imageField) || '').trim();
      if (imageVal) payload[simplifiedConfig.imageField] = imageVal;

      // membership table uses 'description'; all others use 'subtitle'
      if (section === 'membership') {
        payload.description = description;
      } else {
        payload.subtitle = description;
      }

      // Save field values as features/target_audience/benefits for now
      if (field1) payload.features = normalizeListValueForStorage(field1);
      if (field2) payload.target_audience = normalizeListValueForStorage(field2);
      if (field3) payload.benefits = normalizeListValueForStorage(field3);

      // Pricing
      const rawPrice = formData.get('price_inr');
      if (rawPrice !== null && String(rawPrice).trim() !== '') payload.price_inr = parseFloat(rawPrice);

      // Payment / enrollment link
      const paymentLink = String(formData.get('payment_link') || '').trim();
      if (paymentLink) payload.payment_link = paymentLink;

      // Webinar-specific date fields
      if (section === 'webinars') {
        const startDate = String(formData.get('start_datetime_local') || '').trim();
        const endDate = String(formData.get('end_datetime_local') || '').trim();
        if (startDate) payload.start_datetime_local = startDate;
        if (endDate) payload.end_datetime_local = endDate;
      }

      const cfg = sectionConfigs[section];
      if (id) {
        await api(`${cfg.endpoint}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        statusEl.textContent = '✓ Updated successfully!';
        statusEl.style.color = '#388e3c';
      } else {
        await api(cfg.endpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        statusEl.textContent = '✓ Created successfully!';
        statusEl.style.color = '#388e3c';
      }

      invalidateCache(cfg.endpoint);
      
      // Auto-sync child records for courses, webinars, digital products
      const parentSlug = String(payload[slugField] || '').trim();
      if (parentSlug && ['courses', 'webinars', 'digital-products'].includes(section)) {
        const structuredValues = {
          description: description,
          whatLearn: field1,
          whoFor: field2,
          outcome: field3,
          goDeeper: goDeeper,
          descriptionLabel,
          field1Label,
          field2Label,
          field3Label,
          faqLabel
        };
        try {
          await syncSimpleStructuredContent(section, parentSlug, structuredValues);
        } catch (syncErr) {
          console.warn('Child record sync failed but parent saved:', syncErr);
        }
      }
      // Refresh the section after a short delay to show message
      setTimeout(() => renderSimplifiedCollectionSection(section), 800);
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`;
      statusEl.style.color = '#d32f2f';
    }
  });

  // Records list event handler
  recordsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || !canWrite()) return;

    const action = btn.dataset.act;
    const id = Number(btn.dataset.id);
    const record = rows.find(r => Number(r.id) === id);
    if (!record) return;

    if (action === 'edit') {
      const formData = new FormData(form);
      formData.set('id', String(id));
      formData.set('title', String(record.title || record.plan_id || ''));
      formData.set('description', String(record.subtitle || record.description || ''));
      
      // Auto-migrate: try to load from child records if available
      let field1Val = String(record.features || '');
      let field2Val = String(record.target_audience || '');
      let field3Val = String(record.benefits || '');
      let descriptionVal = String(record.subtitle || record.description || '');
      let goDeeperVal = '';
      let descriptionLabelVal = cleanSectionLabel(simplifiedConfig.labels.description);
      let field1LabelVal = cleanSectionLabel(simplifiedConfig.labels.field1);
      let field2LabelVal = cleanSectionLabel(simplifiedConfig.labels.field2);
      let field3LabelVal = cleanSectionLabel(simplifiedConfig.labels.field3);
      let faqLabelVal = cleanSectionLabel(simplifiedConfig.labels.faq || 'FAQ');
      
      // For courses, webinars, digital products: reverse hydrate from child records
      const slug = String(record.slug || '').trim();
      if (slug && ['courses', 'webinars', 'digital-products'].includes(section)) {
        try {
          let childData = null;
          if (section === 'courses') {
            childData = await reverseHydrateCoursesContent(slug);
          } else if (section === 'webinars') {
            childData = await reverseHydrateWebinarsContent(slug);
          } else if (section === 'digital-products') {
            childData = await reverseHydrateDigitalContent(slug);
          }
          
          if (childData) {
            descriptionVal = String(childData.description || descriptionVal);
            field1Val = String(childData.whatLearn || field1Val);
            field2Val = String(childData.whoFor || field2Val);
            field3Val = String(childData.outcome || field3Val);
            goDeeperVal = String(childData.goDeeper || '');
            descriptionLabelVal = String(childData.descriptionLabel || descriptionLabelVal);
            field1LabelVal = String(childData.field1Label || field1LabelVal);
            field2LabelVal = String(childData.field2Label || field2LabelVal);
            field3LabelVal = String(childData.field3Label || field3LabelVal);
            faqLabelVal = String(childData.faqLabel || faqLabelVal);
          }
        } catch (err) {
          // Fall back to parent fields if child read fails
          console.warn('Could not load child data for', slug, err);
        }
      }

      form.elements.id.value = String(id);
      form.elements.title.value = String(record.title || record.plan_id || '');
      form.elements.description.value = descriptionVal;
      form.elements.field1.value = field1Val;
      form.elements.field2.value = field2Val;
      form.elements.field3.value = field3Val;
      if (form.elements.goDeeper) form.elements.goDeeper.value = goDeeperVal;
      if (form.elements.description_label) form.elements.description_label.value = descriptionLabelVal;
      if (form.elements.field1_label) form.elements.field1_label.value = field1LabelVal;
      if (form.elements.field2_label) form.elements.field2_label.value = field2LabelVal;
      if (form.elements.field3_label) form.elements.field3_label.value = field3LabelVal;
      if (form.elements.faq_label) form.elements.faq_label.value = faqLabelVal;

      // Slug
      const slugEl = form.elements[simplifiedConfig.slugField];
      if (slugEl) slugEl.value = String(record[simplifiedConfig.slugField] || record.slug || '');

      // Image/thumbnail
      const imageEl = form.elements[simplifiedConfig.imageField];
      if (imageEl) imageEl.value = String(record[simplifiedConfig.imageField] || '');

      // Pricing & payment link
      if (form.elements.price_inr) form.elements.price_inr.value = String(record.price_inr ?? '');
      if (form.elements.payment_link) form.elements.payment_link.value = String(record.payment_link || '');

      // Webinar dates
      if (section === 'webinars') {
        if (form.elements.start_datetime_local) form.elements.start_datetime_local.value = String(record.start_datetime_local || '');
        if (form.elements.end_datetime_local) form.elements.end_datetime_local.value = String(record.end_datetime_local || '');
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = '💾 Update';
      statusEl.textContent = `Editing #${id}`;
      statusEl.style.color = '#666';
      refreshSimplifiedPreview();
      return;
    }

    if (action === 'toggle-active') {
      statusEl.textContent = 'Updating...';
      try {
        const cfg = sectionConfigs[section];
        await api(`${cfg.endpoint}/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: Number(record.is_active) === 1 ? 0 : 1 })
        });
        invalidateCache(cfg.endpoint);
        await renderSimplifiedCollectionSection(section);
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.style.color = '#d32f2f';
      }
      return;
    }

    if (action === 'delete') {
      if (!window.confirm(`Delete "${getCloneRowLabel(record)}"?`)) return;
      statusEl.textContent = 'Deleting...';
      try {
        const cfg = sectionConfigs[section];
        await api(`${cfg.endpoint}/${id}`, { method: 'DELETE' });
        invalidateCache(cfg.endpoint);
        await renderSimplifiedCollectionSection(section);
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.style.color = '#d32f2f';
      }
    }
  });
}

async function renderGalleryBulkSection(cfg) {
  setPanelBodyClickHandler(null);
  const [galleryRes, contactRes] = await Promise.all([
    apiGetCached(cfg.endpoint),
    apiGetCached('/api/admin/contact')
  ]);

  const rows = Array.isArray(galleryRes.data) ? galleryRes.data : [];
  const contact = contactRes && contactRes.data ? contactRes.data : {};
  const isEnabled = Number(contact.gallery_enabled ?? 1) === 1;
  const urlText = rows
    .map((r) => String(r.image_url || '').trim())
    .filter(Boolean)
    .join('\n');

  el.panelBody.innerHTML = `
    <div class="crud-form">
      <h3>Gallery Visibility</h3>
      <form id="galleryToggleForm">
        <label class="field checkbox-field">
          <input type="checkbox" id="galleryEnabledToggle" ${isEnabled ? 'checked' : ''} ${!canWrite() ? 'disabled' : ''}>
          Show complete gallery section on website
        </label>
        <div class="form-actions">
          <button type="submit" ${!canWrite() ? 'disabled' : ''}>Save Toggle</button>
          <p id="galleryToggleStatus" class="form-status"></p>
        </div>
      </form>
    </div>

    <form id="galleryBulkForm" class="crud-form">
      <h3>Update Gallery Images (Bulk)</h3>
      <label class="field">
        <span>Paste image links below (one URL per line)</span>
        <textarea id="galleryUrlsBox" rows="16" placeholder="https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg\nhttps://example.com/image-3.jpg" ${!canWrite() ? 'disabled' : ''}>${escapeHtml(urlText)}</textarea>
        <small>All existing gallery records will be replaced using this list. Empty lines and duplicate links are ignored.</small>
      </label>
      <div class="form-actions">
        <button type="submit" ${!canWrite() ? 'disabled' : ''}>Save All Links</button>
        <p id="galleryBulkStatus" class="form-status"></p>
      </div>
    </form>

    <h3>Current Gallery Records (${rows.length})</h3>
    ${renderRowsTable(rows, false, true)}
  `;

  const toggleForm = document.getElementById('galleryToggleForm');
  const toggleInput = document.getElementById('galleryEnabledToggle');
  const toggleStatus = document.getElementById('galleryToggleStatus');
  const bulkForm = document.getElementById('galleryBulkForm');
  const bulkBox = document.getElementById('galleryUrlsBox');
  const bulkStatus = document.getElementById('galleryBulkStatus');

  toggleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      toggleStatus.textContent = 'Read-only access for your role.';
      return;
    }

    toggleStatus.textContent = 'Saving toggle...';
    try {
      await api('/api/admin/contact', {
        method: 'PUT',
        body: JSON.stringify({ gallery_enabled: toggleInput.checked ? 1 : 0 })
      });
      invalidateCache('/api/admin/contact');
      toggleStatus.textContent = 'Gallery visibility updated.';
    } catch (error) {
      toggleStatus.textContent = error.message;
    }
  });

  bulkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      bulkStatus.textContent = 'Read-only access for your role.';
      return;
    }

    bulkStatus.textContent = 'Saving links...';
    try {
      const urls = parseMultilineUrls(bulkBox.value);

      // Replace-all behavior for simple gallery management.
      await Promise.all(rows.map((row) => api(`${cfg.endpoint}/${row.id}`, { method: 'DELETE' })));

      for (let i = 0; i < urls.length; i++) {
        await api(cfg.endpoint, {
          method: 'POST',
          body: JSON.stringify({
            image_url: urls[i],
            title: '',
            alt_text: '',
            is_active: 1,
            order: i + 1
          })
        });
      }

      invalidateCache(cfg.endpoint);
      bulkStatus.textContent = `Saved ${urls.length} gallery links.`;
      await renderGalleryBulkSection(cfg);
    } catch (error) {
      bulkStatus.textContent = error.message;
    }
  });
}

async function renderPollsSection() {
  const res = await apiGetCached('/api/polls-api?action=getAllPolls');
  const polls = Array.isArray(res.polls) ? res.polls : [];

  el.panelBody.innerHTML = `
    <form id="pollForm" class="crud-form">
      <input type="hidden" name="id" value="">
      <h3 id="pollFormTitle">Create Poll</h3>
      <div class="form-grid">
        <label class="field"><span>Poll ID</span><input name="poll_id" type="text" placeholder="Enter unique poll id (example: poll_20260324)" ${!canWrite() ? 'disabled' : ''}></label>
        <label class="field"><span>Status</span><input name="status" type="text" value="ACTIVE" placeholder="Enter status (example: ACTIVE)" ${!canWrite() ? 'disabled' : ''}></label>
        <label class="field" style="grid-column:1/-1"><span>Question</span><textarea name="question" placeholder="Write the poll question users will vote on" ${!canWrite() ? 'disabled' : ''}></textarea></label>
      </div>
      <div class="form-actions">
        <button type="submit" ${!canWrite() ? 'disabled' : ''}>Save Poll</button>
        <button type="button" id="pollResetBtn" class="ghost-btn" ${!canWrite() ? 'disabled' : ''}>Reset</button>
        <p id="pollStatus" class="form-status"></p>
      </div>
    </form>
    <h3>Polls</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Question</th><th>Status</th><th>Created</th>${canWrite() ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${polls.map(p => `<tr>
            <td>${escapeHtml(p.id)}</td>
            <td>${escapeHtml(p.question)}</td>
            <td>${escapeHtml(p.status)}</td>
            <td>${escapeHtml(p.created_at)}</td>
            ${canWrite() ? `<td><button class="mini-btn" data-act="edit-poll" data-id="${escapeHtml(p.id)}">Edit</button> <button class="mini-btn danger" data-act="delete-poll" data-id="${escapeHtml(p.id)}">Delete</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  const form = document.getElementById('pollForm');
  const status = document.getElementById('pollStatus');
  const resetBtn = document.getElementById('pollResetBtn');
  const formTitle = document.getElementById('pollFormTitle');

  function resetForm() {
    form.reset();
    form.elements.id.value = '';
    form.elements.status.value = 'ACTIVE';
    formTitle.textContent = 'Create Poll';
    status.textContent = '';
  }
  resetBtn.addEventListener('click', resetForm);
  resetForm();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canWrite()) {
      status.textContent = 'Read-only access for your role.';
      return;
    }

    const editId = form.elements.id.value;
    const pollId = (form.elements.poll_id.value || '').trim();
    const question = (form.elements.question.value || '').trim();
    const pStatus = (form.elements.status.value || 'ACTIVE').trim() || 'ACTIVE';
    if (!pollId || !question) {
      status.textContent = 'Poll ID and question are required.';
      return;
    }

    const existing = polls.find(p => String(p.id) === String(editId));
    const nextPolls = polls
      .filter(p => String(p.id) !== String(editId))
      .concat([{
        id: pollId,
        question,
        status: pStatus,
        created_at: existing ? existing.created_at : new Date().toISOString(),
        ends_at: existing ? existing.ends_at : '',
        require_name: existing ? !!existing.require_name : false,
        show_voters_publicly: existing ? !!existing.show_voters_publicly : false,
        options: existing && Array.isArray(existing.options) ? existing.options : [],
        voters: existing && Array.isArray(existing.voters) ? existing.voters : [],
        description: existing ? (existing.description || '') : ''
      }]);

    status.textContent = 'Saving poll...';
    try {
      await api('/api/polls-api', {
        method: 'POST',
        body: JSON.stringify({ action: 'saveAllPolls', polls: nextPolls })
      });
      await renderPollsSection();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  setPanelBodyClickHandler(async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn || !canWrite()) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const found = polls.find(p => String(p.id) === String(id));
    if (!found) return;

    if (act === 'edit-poll') {
      form.elements.id.value = found.id;
      form.elements.poll_id.value = found.id;
      form.elements.question.value = found.question || '';
      form.elements.status.value = found.status || 'ACTIVE';
      formTitle.textContent = `Edit Poll ${found.id}`;
      status.textContent = 'Editing poll.';
      return;
    }

    if (act === 'delete-poll') {
      if (!window.confirm(`Delete poll ${id}?`)) return;
      status.textContent = 'Deleting poll...';
      try {
        const nextPolls = polls.filter(p => String(p.id) !== String(id));
        await api('/api/polls-api', {
          method: 'POST',
          body: JSON.stringify({ action: 'saveAllPolls', polls: nextPolls })
        });
        invalidateCache('/api/polls-api?action=getAllPolls');
        invalidateCache('/api/polls-api?action=getAllPolls');
        await renderPollsSection();
      } catch (error) {
        status.textContent = error.message;
      }
    }
  });
}

async function renderAdminUsersSection() {
  if (!isOwner()) {
    el.panelBody.innerHTML = '<p>Only owners can manage admin users.</p>';
    return;
  }
  const res = await apiGetCached('/api/admin/users');
  const users = Array.isArray(res.data) ? res.data : [];

  el.panelBody.innerHTML = `
    <form id="userForm" class="crud-form">
      <input type="hidden" name="id" value="">
      <h3 id="userFormTitle">Create Admin User</h3>
      <div class="form-grid">
        <label class="field"><span>Email</span><input name="email" type="email" placeholder="Enter admin email (example@domain.com)" required></label>
        <label class="field"><span>Username</span><input name="username" type="text" placeholder="Enter login username"></label>
        <label class="field"><span>Password</span><input name="password" type="password" placeholder="Enter password (min 6 characters)"></label>
        <label class="field"><span>Role</span>
          <select name="role">
            <option value="viewer">Viewer</option>
            <option value="editor" selected>Editor</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label class="field checkbox-field"><input type="checkbox" name="is_active" checked> Active User</label>
      </div>
      <div class="form-actions">
        <button type="submit">Save User</button>
        <button type="button" id="userResetBtn" class="ghost-btn">Reset</button>
        <p id="userStatus" class="form-status"></p>
      </div>
    </form>
    <h3>Admin Users</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Email</th><th>Username</th><th>Role</th><th>Active</th><th>Last Login</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td>${escapeHtml(u.id)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.username || '')}</td>
            <td>${escapeHtml(u.role)}</td>
            <td>${Number(u.is_active) === 1 ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(u.last_login_at || '')}</td>
            <td><button class="mini-btn" data-act="edit-user" data-id="${u.id}">Edit</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  const form = document.getElementById('userForm');
  const status = document.getElementById('userStatus');
  const resetBtn = document.getElementById('userResetBtn');
  const title = document.getElementById('userFormTitle');

  function resetUserForm() {
    form.reset();
    form.elements.id.value = '';
    form.elements.role.value = 'editor';
    form.elements.is_active.checked = true;
    title.textContent = 'Create Admin User';
    status.textContent = '';
  }

  resetBtn.addEventListener('click', resetUserForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.elements.id.value;
    const payload = {
      email: form.elements.email.value.trim(),
      username: form.elements.username.value.trim(),
      role: form.elements.role.value,
      is_active: form.elements.is_active.checked ? 1 : 0
    };
    const password = form.elements.password.value;
    if (password) payload.password = password;

    status.textContent = 'Saving user...';
    try {
      if (id) {
        await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        if (!password) {
          status.textContent = 'Password is required when creating a user.';
          return;
        }
        await api('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      }
      invalidateCache('/api/admin/users');
      await renderAdminUsersSection();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  setPanelBodyClickHandler((e) => {
    const btn = e.target.closest('button[data-act="edit-user"]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const found = users.find(u => Number(u.id) === id);
    if (!found) return;
    form.elements.id.value = String(found.id);
    form.elements.email.value = found.email || '';
    form.elements.username.value = found.username || '';
    form.elements.role.value = found.role || 'editor';
    form.elements.password.value = '';
    form.elements.is_active.checked = Number(found.is_active) === 1;
    title.textContent = `Edit User #${found.id}`;
    status.textContent = 'Editing user. Leave password blank to keep it unchanged.';
  });
}

async function renderDataCleanupSection() {
  el.panelBody.innerHTML = '<div class="panel-loader"><div class="panel-loader-spinner"></div><p>Running data integrity audit...</p></div>';
  
  try {
    const auditStartTime = performance.now();
    const auditResult = await runFullOrphanAudit();
    const auditEndTime = performance.now();
    const auditLatency = Math.round(auditEndTime - auditStartTime);
    
    // Phase 5: Record audit metrics
    recordAuditMetric(auditLatency, auditResult.total);
    
    if (!auditResult.successful) {
      el.panelBody.innerHTML = '<p style="color:red;">Failed to run audit. Please check console.</p>';
      return;
    }
    
    const hasOrphans = auditResult.total > 0;
    const resultHtml = auditResult.results.map(r => {
      return `
        <div style="border-left: 4px solid ${r.orphanCount > 0 ? '#e74c3c' : '#27ae60'}; padding: 12px; margin-bottom: 12px; background: #f8f9fa;">
          <strong>${escapeHtml(r.type)}</strong>: <span style="font-weight:bold; color: ${r.orphanCount > 0 ? '#e74c3c' : '#27ae60'};">${r.orphanCount} orphan records</span>
          ${r.orphanCount > 0 ? `<button data-cleanup-action="delete-${r.type}" class="mini-btn danger" style="margin-left: 12px;">Delete All</button>` : ''}
        </div>
      `;
    }).join('');
    
    el.panelBody.innerHTML = `
      <div class="crud-form">
        <h3>Data Integrity Report</h3>
        <p>This report identifies child records without matching parent records (orphans).</p>
        <div style="margin: 20px 0; padding: 16px; background: ${hasOrphans ? '#fff3cd' : '#d4edda'}; border: 1px solid ${hasOrphans ? '#ffc107' : '#28a745'}; border-radius: 4px;">
          <strong>Total Orphan Records: ${auditResult.total}</strong>
          ${hasOrphans ? '<p style="margin-top:8px;">Click "Delete All" to remove orphan records from any table above.</p>' : '<p style="margin-top:8px; color:#155724;">✓ No orphans detected. Data is clean!</p>'}
        </div>
        <h4>Detailed Results:</h4>
        ${resultHtml}
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
          <strong>Note:</strong> Orphans occur when child records reference parent slugs that no longer exist. 
          This typically happens after manual parent deletions or data migration issues.
        </p>
      </div>
    `;
    
    setPanelBodyClickHandler((e) => {
      const btn = e.target.closest('[data-cleanup-action]');
      if (!btn) return;
      
      const action = btn.dataset.cleanupAction;
      const tableName = action.replace('delete-', '');
      
      if (!window.confirm(`Delete all ${auditResult.total} orphan records from "${tableName}"?\n\nThis cannot be undone.`)) {
        return;
      }
      
      deleteOrphansByType(tableName);
    });
    
  } catch (error) {
    el.panelBody.innerHTML = `<p style="color:red;">Error: ${escapeHtml(error.message)}</p>`;
  }
}

async function deleteOrphansByType(tableType) {
  const statusEl = document.querySelector('.form-status') || document.createElement('div');
  statusEl.textContent = 'Deleting orphans...';
  statusEl.style.color = 'orange';
  if (!statusEl.parentElement) el.panelBody.appendChild(statusEl);

  try {
    const orphanList = 
      tableType === 'course-page-blocks' ? (await detectOrphanBlocks()).orphans :
      tableType === 'webinar-page-blocks' ? (await detectOrphanWebinarBlocks()).orphans :
      tableType === 'webinar-key-points-cards' ? (await detectOrphanWebinarCards()).orphans :
      tableType === 'digital-product-details' ? (await detectOrphanDigitalDetails()).orphans :
      [];
    
    if (!orphanList.length) {
      statusEl.textContent = 'No orphans to delete.';
      statusEl.style.color = 'green';
      return;
    }
    
    const endpoint = tableType.includes('course') ? '/api/admin/course-page-blocks' :
                     tableType.includes('webinar-page-blocks') ? '/api/admin/webinar-page-blocks' :
                     tableType.includes('webinar-key') ? '/api/admin/webinar-key-points-cards' :
                     '/api/admin/digital-product-details';
    
    for (const orphan of orphanList) {
      try {
        await api(`${endpoint}/${orphan.id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn(`Failed to delete ${tableType} #${orphan.id}:`, err);
      }
    }
    
    statusEl.textContent = `✓ Deleted ${orphanList.length} orphan records from ${tableType}`;
    statusEl.style.color = 'green';
    
    setTimeout(() => renderDataCleanupSection(), 1500);
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.style.color = 'red';
  }
}

async function renderMonitoringSection() {
  const report = getMetricsReport();
  
  const adoptionHtml = Object.entries(report.editorAdoption).map(([section, adoption]) => {
    return `
      <tr>
        <td>${escapeHtml(section)}</td>
        <td><span style="color:#4CAF50;">${adoption.simple}%</span></td>
        <td><span style="color:#2196F3;">${adoption.advanced}%</span></td>
        <td>${adoption.totalSaves}</td>
      </tr>
    `;
  }).join('');
  
  el.panelBody.innerHTML = `
    <div class="crud-form">
      <h3>📈 Editor Performance & Usage Monitoring</h3>
      
      <h4>Overall Metrics</h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="padding: 16px; background: #f0f7ff; border-radius: 4px;">
          <div style="color: #666; font-size: 0.9em;">Total Saves</div>
          <div style="font-size: 1.8em; font-weight: bold; color: #2196F3;">${report.totalSaves}</div>
        </div>
        <div style="padding: 16px; background: #f0fff4; border-radius: 4px;">
          <div style="color: #666; font-size: 0.9em;">Success Rate</div>
          <div style="font-size: 1.8em; font-weight: bold; color: #4CAF50;">${report.successRate}%</div>
        </div>
        <div style="padding: 16px; background: #fff8f0; border-radius: 4px;">
          <div style="color: #666; font-size: 0.9em;">Avg Save Latency</div>
          <div style="font-size: 1.8em; font-weight: bold; color: #FF9800;">${report.avgSaveLatency}ms</div>
        </div>
        <div style="padding: 16px; background: #f5f5f5; border-radius: 4px;">
          <div style="color: #666; font-size: 0.9em;">Mode Switches</div>
          <div style="font-size: 1.8em; font-weight: bold; color: #9C27B0;">${report.modeSwaps}</div>
        </div>
      </div>
      
      <h4>Editor Adoption by Section (Simple vs Advanced)</h4>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Section</th><th>Simple Mode %</th><th>Advanced Mode %</th><th>Total Saves</th></tr></thead>
          <tbody>${adoptionHtml || '<tr><td colspan="4">No data yet</td></tr>'}</tbody>
        </table>
      </div>
      
      <h4>Data Integrity Audits</h4>
      <div style="padding: 12px; background: #f9f9f9; border-left: 4px solid #9C27B0;">
        <div><strong>Total Audits Run:</strong> ${report.totalAudits}</div>
        <div><strong>Avg Audit Latency:</strong> ${report.avgAuditLatency}ms</div>
      </div>
      
      <h4>Feature Flags</h4>
      <div style="padding: 12px; background: #f9f9f9; border-left: 4px solid #2196F3;">
        <div><strong>Simple Editor Enabled:</strong> <span style="color: #4CAF50;">${state.featureFlags.useSimpleEditor ? '✓ Yes' : '✗ No'}</span></div>
        <div><strong>Production Canary:</strong> <span style="color: ${state.featureFlags.productionCanary ? '#FF9800' : '#999'};">${state.featureFlags.productionCanary ? 'ℹ Active' : 'Disabled'}</span></div>
      </div>
      
      <p style="margin-top: 24px; font-size: 0.85em; color: #666;">
        <strong>Note:</strong> These metrics are stored locally in browser memory. For persistent monitoring, integrate with your backend analytics service.
      </p>
    </div>
  `;
}

async function renderSection() {
  try {
    if (state.section === 'dashboard') {
      await renderDashboard();
      return;
    }

    if (state.section === 'polls') {
      await renderPollsSection();
      return;
    }

    if (state.section === 'admin-users') {
      await renderAdminUsersSection();
      return;
    }

    if (state.section === 'data-cleanup') {
      await renderDataCleanupSection();
      return;
    }

    if (state.section === 'monitoring') {
      await renderMonitoringSection();
      return;
    }

    if (state.section === 'gallery-images') {
      await renderGalleryBulkSection(sectionConfigs['gallery-images']);
      return;
    }

    // Route 4 core sections to new simplified UI
    if (state.featureFlags.useSimplifiedUI && simplifiedSectionConfigs[state.section]) {
      await renderSimplifiedCollectionSection(state.section);
      return;
    }

    const cfg = sectionConfigs[state.section];
    if (!cfg) {
      el.panelBody.innerHTML = '<p>This section is not configured.</p>';
      return;
    }

    if (cfg.kind === 'singleton') {
      await renderSingletonSection(cfg);
      return;
    }

    await renderCollectionSection(cfg);
  } catch (error) {
    el.panelBody.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function showLogin() {
  document.body.classList.add('logged-out');
  el.loginOverlay.classList.remove('hidden');
}

function hideLogin() {
  document.body.classList.remove('logged-out');
  el.loginOverlay.classList.add('hidden');
}

function setLoginLoading(isLoading) {
  if (!el.loginSubmitBtn || !el.loginForm) return;
  const btnText = el.loginSubmitBtn.querySelector('.btn-text');
  el.loginSubmitBtn.disabled = !!isLoading;
  el.loginSubmitBtn.classList.toggle('is-loading', !!isLoading);
  if (btnText) {
    btnText.textContent = isLoading ? 'Signing In...' : 'Sign In';
  }

  const email = document.getElementById('email');
  const password = document.getElementById('password');
  if (email) email.disabled = !!isLoading;
  if (password) password.disabled = !!isLoading;
}

async function onLogin(e) {
  e.preventDefault();
  el.loginError.textContent = '';
  setLoginLoading(true);
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: {}
    });
    state.token = res.token;
    state.user = res.user || null;
    localStorage.setItem('findas_admin_token', state.token);
    hideLogin();
    applyRoleVisibility();
    updateCurrentUserBadge();
    await preloadAdminTabData().catch(() => {});
    await applyAcademyDataVisibility();
    await setSection('dashboard');
  } catch (error) {
    el.loginError.textContent = error.message;
  } finally {
    setLoginLoading(false);
  }
}

function logout() {
  state.token = '';
  state.user = null;
  clearDataCache();
  localStorage.removeItem('findas_admin_token');
  applyRoleVisibility();
  updateCurrentUserBadge();
  showLogin();
}

async function bootstrapSession() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    const me = await api('/api/auth/me');
    state.user = me.user || null;
    applyRoleVisibility();
    updateCurrentUserBadge();
    hideLogin();
    await preloadAdminTabData().catch(() => {});
    await applyAcademyDataVisibility();
    await setSection('dashboard');
  } catch (_e) {
    logout();
  }
}

el.menuList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-section]');
  if (!btn || btn.style.display === 'none') return;
  await setSection(btn.dataset.section);
});

el.loginForm.addEventListener('submit', onLogin);
el.logoutBtn.addEventListener('click', logout);

applyRoleVisibility();
updateCurrentUserBadge();
bootstrapSession();
