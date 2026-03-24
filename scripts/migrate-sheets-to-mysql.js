const fs = require('fs');
const path = require('path');

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function safeText(value) {
  return value === undefined || value === null ? '' : String(value);
}

async function main() {
  const contentApiUrl = process.env.FINDAS_CONTENT_API_URL || 'https://script.google.com/macros/s/AKfycbySQGmEoW1zwK048wxXCY4cBWSxd8U4sjXsDL6hPymg2Df5cCkBEwYkv8B65SK4-y6MkA/exec';
  const pollsApiUrl = process.env.FINDAS_POLLS_API_URL || 'https://script.google.com/macros/s/AKfycbzr52WyJVmS0UIBHRvrlVzXEqEFkFyuDE_sq625zq1utSPnfzwC0d4fNMq0VwNosRiz/exec';
  const pollsApiKey = process.env.FINDAS_POLLS_API_KEY || '851e995f-f691-4d8f-a630-5b3b83210eef';

  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (_e) {
    mysql = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mysql2', 'promise'));
  }

  let hostInput = process.env.FINDAS_DB_HOST || 'mysql.gb.stackcp.com:42704';
  let host = hostInput;
  let port = Number(process.env.FINDAS_DB_PORT || 3306);
  if (hostInput.includes(':')) {
    const parts = hostInput.split(':');
    host = parts[0];
    port = Number(parts[1]) || port;
  }

  const user = process.env.FINDAS_DB_USER || '';
  const password = process.env.FINDAS_DB_PASS || '';
  const database = process.env.FINDAS_DB_NAME || 'Findas-353131330571';

  if (!user || !password) {
    throw new Error('FINDAS_DB_USER and FINDAS_DB_PASS are required.');
  }

  async function fetchJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error('HTTP ' + resp.status + ' for ' + url);
    }
    return resp.json();
  }

  async function getContent(fnName, params = {}, options = {}) {
    const url = new URL(contentApiUrl);
    url.searchParams.set('api', '1');
    url.searchParams.set('fn', fnName);
    Object.keys(params).forEach((k) => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, String(params[k]));
      }
    });

    const json = await fetchJson(url.toString());
    if (!json || json.ok !== true) {
      const errMsg = json && json.error ? String(json.error) : 'unknown';
      const optionalPattern = options.optionalErrorPattern instanceof RegExp ? options.optionalErrorPattern : null;
      if (options.optional && (/unknown fn/i.test(errMsg) || (optionalPattern && optionalPattern.test(errMsg)))) {
        return options.defaultValue;
      }
      throw new Error('Content API failed for ' + fnName + ': ' + errMsg);
    }
    return json.data;
  }

  function dedupeRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const seen = new Set();
    const out = [];
    for (const row of list) {
      const key = JSON.stringify(row || {});
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  }

  async function getPolls(action) {
    const url = new URL(pollsApiUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('apiKey', pollsApiKey);
    const json = await fetchJson(url.toString());
    if (!json || json.success !== true) {
      throw new Error('Polls API failed for ' + action + ': ' + (json && json.error ? json.error : 'unknown'));
    }
    return json;
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  try {
    async function ensureColumn(table, column, definition) {
      try {
        await conn.query('ALTER TABLE `' + table + '` ADD COLUMN `' + column + '` ' + definition);
      } catch (err) {
        if (!(err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME'))) {
          throw err;
        }
      }
    }

    const schemaFile = path.join(__dirname, '..', 'backend', 'sql', 'serverbyt_mysql_schema.sql');
    let schemaSql = fs.readFileSync(schemaFile, 'utf8');
    schemaSql = schemaSql.replace(/USE\s+`?Findas-353131330571`?\s*;/i, 'USE `' + database + '`;');
    await conn.query(schemaSql);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS polls_snapshot (
        id VARCHAR(191) PRIMARY KEY,
        question TEXT,
        status VARCHAR(60),
        created_at_text VARCHAR(120),
        ends_at_text VARCHAR(120),
        require_name TINYINT(1) DEFAULT 0,
        show_voters_publicly TINYINT(1) DEFAULT 0,
        options_json LONGTEXT,
        voters_json LONGTEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS admin_credentials_snapshot (
        id INT PRIMARY KEY,
        username VARCHAR(191),
        password_hash TEXT,
        whatsapp_number VARCHAR(80),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS course_page_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_slug VARCHAR(160) NOT NULL,
        slug VARCHAR(160) NULL,
        block_type VARCHAR(120) NULL,
        title VARCHAR(255) NULL,
        subtitle TEXT NULL,
        body LONGTEXT NULL,
        bullets LONGTEXT NULL,
        image_url VARCHAR(500) NULL,
        bg_color VARCHAR(40) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_course_blocks_slug (course_slug),
        INDEX idx_course_blocks_slug_legacy (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS course_for_you_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_slug VARCHAR(160) NOT NULL,
        slug VARCHAR(160) NULL,
        card_title VARCHAR(255) NULL,
        card_body TEXT NULL,
        icon_url VARCHAR(500) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_course_foryou_slug (course_slug),
        INDEX idx_course_foryou_slug_legacy (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS digital_product_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_slug VARCHAR(160) NOT NULL,
        slug VARCHAR(160) NULL,
        section_type VARCHAR(120) NULL,
        heading VARCHAR(255) NULL,
        body LONGTEXT NULL,
        file_includes TEXT NULL,
        bullets LONGTEXT NULL,
        image_url VARCHAR(500) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_digital_details_slug (product_slug),
        INDEX idx_digital_details_slug_legacy (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS webinar_page_blocks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webinar_slug VARCHAR(160) NOT NULL,
        slug VARCHAR(160) NULL,
        block_type VARCHAR(120) NULL,
        title VARCHAR(255) NULL,
        subtitle TEXT NULL,
        body LONGTEXT NULL,
        bullets LONGTEXT NULL,
        image_url VARCHAR(500) NULL,
        bg_color VARCHAR(40) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_webinar_blocks_slug (webinar_slug),
        INDEX idx_webinar_blocks_slug_legacy (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS webinar_key_points_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webinar_slug VARCHAR(160) NOT NULL,
        slug VARCHAR(160) NULL,
        title VARCHAR(255) NULL,
        body TEXT NULL,
        icon_url VARCHAR(500) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_webinar_keypoints_slug (webinar_slug),
        INDEX idx_webinar_keypoints_slug_legacy (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS short_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(160) NULL,
        course_slug VARCHAR(160) NULL,
        webinar_slug VARCHAR(160) NULL,
        review_text TEXT NULL,
        name VARCHAR(160) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_short_reviews_slug (slug),
        INDEX idx_short_reviews_course (course_slug),
        INDEX idx_short_reviews_webinar (webinar_slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS featured_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(160) NULL,
        course_slug VARCHAR(160) NULL,
        webinar_slug VARCHAR(160) NULL,
        title VARCHAR(255) NULL,
        review_text TEXT NULL,
        name VARCHAR(160) NULL,
        image_url VARCHAR(500) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_featured_reviews_slug (slug),
        INDEX idx_featured_reviews_course (course_slug),
        INDEX idx_featured_reviews_webinar (webinar_slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS gallery_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(500) NULL,
        title VARCHAR(255) NULL,
        alt_text VARCHAR(255) NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS faq (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question TEXT NULL,
        answer TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS who_for (
        id INT AUTO_INCREMENT PRIMARY KEY,
        icon VARCHAR(64) NULL,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        is_active TINYINT(1) DEFAULT 1,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumn('courses', 'category', 'VARCHAR(120) NULL AFTER `subtitle`');
    await ensureColumn('courses', 'language', 'VARCHAR(120) NULL AFTER `category`');
    await ensureColumn('courses', 'badge', 'VARCHAR(120) NULL AFTER `language`');
    await ensureColumn('courses', 'students', 'VARCHAR(120) NULL AFTER `badge`');
    await ensureColumn('courses', 'payment_link', 'VARCHAR(500) NULL AFTER `students`');
    await ensureColumn('courses', 'redirect_url', 'VARCHAR(500) NULL AFTER `payment_link`');

    await ensureColumn('digital_products', 'category', 'VARCHAR(120) NULL AFTER `subtitle`');
    await ensureColumn('digital_products', 'language', 'VARCHAR(120) NULL AFTER `category`');
    await ensureColumn('digital_products', 'badge', 'VARCHAR(120) NULL AFTER `language`');
    await ensureColumn('digital_products', 'preview_url', 'VARCHAR(500) NULL AFTER `badge`');
    await ensureColumn('digital_products', 'payment_link', 'VARCHAR(500) NULL AFTER `preview_url`');
    await ensureColumn('digital_products', 'redirect_url', 'VARCHAR(500) NULL AFTER `payment_link`');

    await ensureColumn('webinars', 'host_image_url', 'VARCHAR(500) NULL AFTER `banner_url`');
    await ensureColumn('webinars', 'host_name', 'VARCHAR(160) NULL AFTER `host_image_url`');
    await ensureColumn('webinars', 'platform', 'VARCHAR(120) NULL AFTER `host_name`');
    await ensureColumn('webinars', 'timezone', 'VARCHAR(80) NULL AFTER `platform`');
    await ensureColumn('webinars', 'price_inr', 'DECIMAL(10,2) DEFAULT 0 AFTER `timezone`');
    await ensureColumn('webinars', 'is_free', 'TINYINT(1) DEFAULT 0 AFTER `price_inr`');
    await ensureColumn('webinars', 'payment_link', 'VARCHAR(500) NULL AFTER `is_free`');
    await ensureColumn('webinars', 'primary_cta_text', 'VARCHAR(160) NULL AFTER `payment_link`');

    await ensureColumn('membership_plans', 'plan_id', 'VARCHAR(120) NULL AFTER `id`');
    await ensureColumn('membership_plans', 'period', 'VARCHAR(120) NULL AFTER `price_inr`');
    await ensureColumn('membership_plans', 'recommended', 'TINYINT(1) DEFAULT 0 AFTER `period`');
    await ensureColumn('membership_plans', 'image_url', 'VARCHAR(500) NULL AFTER `recommended`');
    await ensureColumn('membership_plans', 'payment_link', 'VARCHAR(500) NULL AFTER `image_url`');

    const [
      globalSettings,
      siteConfig,
      courses,
      digitalProducts,
      webinars,
      membershipPlans,
      academySections,
      academyBefore,
      academyAfter,
      academyRoadmap,
      academyCommunityPosts,
      shortReviews,
      featuredReviews,
      galleryImages,
      faq,
      whoFor
    ] = await Promise.all([
      getContent('getGlobalSettings', {}, { optional: true, defaultValue: {} }),
      getContent('getSiteConfig', {}, { optional: true, defaultValue: {} }),
      getContent('getCourses', {}, { optional: true, defaultValue: [] }),
      getContent('getDigitalProducts', {}, { optional: true, defaultValue: [] }),
      getContent('getWebinars', {}, { optional: true, defaultValue: [] }),
      getContent('getMembershipPlans', {}, { optional: true, defaultValue: [] }),
      getContent('getAcademySections', {}, { optional: true, defaultValue: [] }),
      getContent('getAcademyBefore', {}, { optional: true, defaultValue: [] }),
      getContent('getAcademyAfter', {}, { optional: true, defaultValue: [] }),
      getContent('getAcademyRoadmap', {}, { optional: true, defaultValue: [] }),
      getContent('getAcademyCommunityPosts', {}, { optional: true, defaultValue: [] }),
      getContent('getShortReviews', {}, { optional: true, defaultValue: [] }),
      getContent('getFeaturedReviews', {}, { optional: true, defaultValue: [] }),
      getContent('getGalleryImages', {}, { optional: true, defaultValue: [] }),
      getContent('getFAQ', {}, { optional: true, defaultValue: [] }),
      getContent('getWhoFor', {}, { optional: true, defaultValue: [] })
    ]);

    const courseRows = Array.isArray(courses) ? courses : [];
    const productRows = Array.isArray(digitalProducts) ? digitalProducts : [];
    const webinarRows = Array.isArray(webinars) ? webinars : [];

    const detailPayloads = await Promise.all([
      ...courseRows.map((c) => {
        const slug = safeText(c && c.slug).trim();
        if (!slug) return Promise.resolve(null);
        return getContent('getCourseDetails', { slug }, { optional: true, defaultValue: null, optionalErrorPattern: /slug is required|not found/i });
      }),
      ...productRows.map((p) => {
        const slug = safeText(p && p.slug).trim();
        if (!slug) return Promise.resolve(null);
        return getContent('getDigitalProductDetails', { slug }, { optional: true, defaultValue: null, optionalErrorPattern: /slug is required|not found/i });
      }),
      ...webinarRows.map((w) => {
        const slug = safeText(w && w.slug).trim();
        if (!slug) return Promise.resolve(null);
        return getContent('getWebinarDetails', { slug }, { optional: true, defaultValue: null, optionalErrorPattern: /slug is required|not found/i });
      })
    ]);

    const coursePageBlocks = [];
    const courseForYouCards = [];
    const digitalProductDetails = [];
    const webinarPageBlocks = [];
    const webinarKeyPointsCards = [];
    const detailShortReviews = [];
    const detailFeaturedReviews = [];

    detailPayloads.forEach((d) => {
      if (!d || typeof d !== 'object') return;
      if (Array.isArray(d.blocks) && d.course) {
        d.blocks.forEach((row) => coursePageBlocks.push(row));
      }
      if (Array.isArray(d.forYouCards)) {
        d.forYouCards.forEach((row) => courseForYouCards.push(row));
      }
      if (Array.isArray(d.sections)) {
        d.sections.forEach((row) => digitalProductDetails.push(row));
      }
      if (Array.isArray(d.blocks) && d.webinar) {
        d.blocks.forEach((row) => webinarPageBlocks.push(row));
      }
      if (Array.isArray(d.keyPoints)) {
        d.keyPoints.forEach((row) => webinarKeyPointsCards.push(row));
      }
      if (Array.isArray(d.shortReviews)) {
        d.shortReviews.forEach((row) => detailShortReviews.push(row));
      }
      if (Array.isArray(d.featuredReviews)) {
        d.featuredReviews.forEach((row) => detailFeaturedReviews.push(row));
      }
    });

    const allShortReviews = dedupeRows([...(Array.isArray(shortReviews) ? shortReviews : []), ...detailShortReviews]);
    const allFeaturedReviews = dedupeRows([...(Array.isArray(featuredReviews) ? featuredReviews : []), ...detailFeaturedReviews]);

    const polls = await getPolls('getAllPolls').then((r) => r.polls || []);
    const creds = await getPolls('getCredentials').then((r) => r.credentials || {});
    const whatsapp = await getPolls('getWhatsAppNumber').then((r) => r.whatsappNumber || '');

    const heroTitle = safeText(siteConfig.hero_title || globalSettings.hero_title || 'Build Wealth.');
    const heroSubtitle = safeText(siteConfig.hero_subtitle || globalSettings.hero_subtitle || '');
    const heroBtn1 = safeText(siteConfig.hero_button_1_text || globalSettings.hero_button_1_text || 'Join Findas Academy');
    const heroBtn2 = safeText(siteConfig.hero_button_2_text || globalSettings.hero_button_2_text || 'Book Free Call');
    const heroVideo = safeText(siteConfig.hero_video_url || globalSettings.hero_video_url || '');

    await conn.execute(
      `INSERT INTO hero_section (id, title, subtitle, button_text_1, button_text_2, video_url)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       title = VALUES(title), subtitle = VALUES(subtitle), button_text_1 = VALUES(button_text_1), button_text_2 = VALUES(button_text_2), video_url = VALUES(video_url), updated_at = NOW()`,
      [heroTitle || 'Build Wealth.', heroSubtitle, heroBtn1, heroBtn2, heroVideo]
    );

    await conn.execute(
      `INSERT INTO about_section (id, founder_name, founder_title, paragraph_1, paragraph_2, paragraph_3, founder_image_url)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       founder_name = VALUES(founder_name), founder_title = VALUES(founder_title), paragraph_1 = VALUES(paragraph_1), paragraph_2 = VALUES(paragraph_2), paragraph_3 = VALUES(paragraph_3), founder_image_url = VALUES(founder_image_url), updated_at = NOW()`,
      [
        safeText(siteConfig.founder_name || globalSettings.founder_name || 'Samir Machawe'),
        safeText(siteConfig.founder_title || globalSettings.founder_title || 'Founder, Findas Academy'),
        safeText(siteConfig.founder_paragraph_1 || globalSettings.founder_paragraph_1 || ''),
        safeText(siteConfig.founder_paragraph_2 || globalSettings.founder_paragraph_2 || ''),
        safeText(siteConfig.founder_paragraph_3 || globalSettings.founder_paragraph_3 || ''),
        safeText(siteConfig.founder_image_url || globalSettings.founder_image_url || '')
      ]
    );

    await conn.execute(
      `INSERT INTO contact_section (id, phone, email, address)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       phone = VALUES(phone), email = VALUES(email), address = VALUES(address), updated_at = NOW()`,
      [
        safeText(globalSettings.contact_phone || siteConfig.footer_phone || ''),
        safeText(globalSettings.contact_email || siteConfig.footer_email || ''),
        safeText(globalSettings.contact_address || siteConfig.footer_address || '')
      ]
    );

    async function refreshTable(table, fields, rows, mapRow) {
      await conn.query('DELETE FROM `' + table + '`');
      if (!rows || rows.length === 0) return 0;
      const placeholders = '(' + fields.map(() => '?').join(',') + ')';
      const sql = 'INSERT INTO `' + table + '` (' + fields.map((f) => '`' + f + '`').join(',') + ') VALUES ' + rows.map(() => placeholders).join(',');
      const values = [];
      rows.forEach((row) => {
        const mapped = mapRow(row);
        fields.forEach((f) => values.push(mapped[f]));
      });
      await conn.execute(sql, values);
      return rows.length;
    }

    const counts = {};

    counts.courses = await refreshTable(
      'courses',
      ['title', 'subtitle', 'slug', 'category', 'language', 'badge', 'students', 'thumbnail_url', 'price_inr', 'payment_link', 'redirect_url', 'is_active', 'order'],
      Array.isArray(courses) ? courses : [],
      (r) => ({
        title: safeText(r.title),
        subtitle: safeText(r.subtitle),
        slug: safeText(r.slug),
        category: safeText(r.category),
        language: safeText(r.language),
        badge: safeText(r.badge),
        students: safeText(r.students),
        thumbnail_url: safeText(r.thumbnail_url || r.image_url || r.img || ''),
        price_inr: toNum(r.price_inr ?? r.price, 0),
        payment_link: safeText(r.payment_link || ''),
        redirect_url: safeText(r.redirect_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.digital_products = await refreshTable(
      'digital_products',
      ['title', 'subtitle', 'slug', 'category', 'language', 'badge', 'thumbnail_url', 'price_inr', 'preview_url', 'payment_link', 'redirect_url', 'is_active', 'order'],
      Array.isArray(digitalProducts) ? digitalProducts : [],
      (r) => ({
        title: safeText(r.title),
        subtitle: safeText(r.subtitle),
        slug: safeText(r.slug),
        category: safeText(r.category),
        language: safeText(r.language),
        badge: safeText(r.badge),
        thumbnail_url: safeText(r.thumbnail_url || r.image_url || r.img || ''),
        price_inr: toNum(r.price_inr ?? r.price, 0),
        preview_url: safeText(r.preview_url || ''),
        payment_link: safeText(r.payment_link || ''),
        redirect_url: safeText(r.redirect_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.webinars = await refreshTable(
      'webinars',
      ['title', 'subtitle', 'slug', 'banner_url', 'host_image_url', 'host_name', 'platform', 'timezone', 'start_datetime_local', 'end_datetime_local', 'price_inr', 'is_free', 'payment_link', 'primary_cta_text', 'is_active', 'order'],
      Array.isArray(webinars) ? webinars : [],
      (r) => ({
        title: safeText(r.title),
        subtitle: safeText(r.subtitle),
        slug: safeText(r.slug),
        banner_url: safeText(r.banner_url || r.image_url || r.img || ''),
        host_image_url: safeText(r.host_image_url || r.speaker_image_url || ''),
        host_name: safeText(r.host_name || r.speaker_name || ''),
        platform: safeText(r.platform || ''),
        timezone: safeText(r.timezone || ''),
        start_datetime_local: r.start_datetime_local || null,
        end_datetime_local: r.end_datetime_local || null,
        price_inr: toNum(r.price_inr ?? r.price, 0),
        is_free: toBool(r.is_free, false) ? 1 : 0,
        payment_link: safeText(r.payment_link || ''),
        primary_cta_text: safeText(r.primary_cta_text || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.membership_plans = await refreshTable(
      'membership_plans',
      ['plan_id', 'title', 'description', 'price_inr', 'period', 'recommended', 'image_url', 'payment_link', 'features', 'target_audience', 'benefits', 'is_active', 'order'],
      Array.isArray(membershipPlans) ? membershipPlans : [],
      (r) => ({
        plan_id: safeText(r.plan_id || r.id || ''),
        title: safeText(r.title),
        description: safeText(r.description),
        price_inr: toNum(r.price_inr ?? r.price, 0),
        period: safeText(r.period || r.duration || ''),
        recommended: toBool(r.recommended, false) ? 1 : 0,
        image_url: safeText(r.image_url || r.plan_image_url || ''),
        payment_link: safeText(r.payment_link || ''),
        features: safeText(r.features),
        target_audience: safeText(r.target_audience),
        benefits: safeText(r.benefits),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.academy_sections = await refreshTable(
      'academy_sections',
      ['title', 'description', 'icon_emoji', 'details', 'is_active', 'order'],
      Array.isArray(academySections) ? academySections : [],
      (r) => ({
        title: safeText(r.title),
        description: safeText(r.description),
        icon_emoji: safeText(r.icon_emoji || r.icon || r.emoji || ''),
        details: safeText(r.details || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.academy_before = await refreshTable(
      'academy_before',
      ['challenge', 'is_active', 'order'],
      Array.isArray(academyBefore) ? academyBefore : [],
      (r) => ({
        challenge: safeText(r.challenge || r.title || r.text || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.academy_after = await refreshTable(
      'academy_after',
      ['benefit', 'is_active', 'order'],
      Array.isArray(academyAfter) ? academyAfter : [],
      (r) => ({
        benefit: safeText(r.benefit || r.title || r.text || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.academy_roadmap = await refreshTable(
      'academy_roadmap',
      ['stage_num', 'stage_name', 'description', 'is_active', 'order'],
      Array.isArray(academyRoadmap) ? academyRoadmap : [],
      (r) => ({
        stage_num: toNum(r.stage_num ?? r.stage ?? r.step, 0),
        stage_name: safeText(r.stage_name || r.title || ''),
        description: safeText(r.description || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.academy_community_posts = await refreshTable(
      'academy_community_posts',
      ['post_type', 'content', 'author', 'is_active', 'order'],
      Array.isArray(academyCommunityPosts) ? academyCommunityPosts : [],
      (r) => ({
        post_type: safeText(r.post_type || r.type || ''),
        content: safeText(r.content || r.text || ''),
        author: safeText(r.author || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.course_page_blocks = await refreshTable(
      'course_page_blocks',
      ['course_slug', 'slug', 'block_type', 'title', 'subtitle', 'body', 'bullets', 'image_url', 'bg_color', 'is_active', 'order'],
      Array.isArray(coursePageBlocks) ? coursePageBlocks : [],
      (r) => ({
        course_slug: safeText(r.course_slug || r.slug || ''),
        slug: safeText(r.slug || r.course_slug || ''),
        block_type: safeText(r.block_type || r.type || ''),
        title: safeText(r.title || ''),
        subtitle: safeText(r.subtitle || ''),
        body: safeText(r.body || r.description || ''),
        bullets: safeText(r.bullets || ''),
        image_url: safeText(r.image_url || ''),
        bg_color: safeText(r.bg_color || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.course_for_you_cards = await refreshTable(
      'course_for_you_cards',
      ['course_slug', 'slug', 'card_title', 'card_body', 'icon_url', 'is_active', 'order'],
      Array.isArray(courseForYouCards) ? courseForYouCards : [],
      (r) => ({
        course_slug: safeText(r.course_slug || r.slug || ''),
        slug: safeText(r.slug || r.course_slug || ''),
        card_title: safeText(r.card_title || r.title || ''),
        card_body: safeText(r.card_body || r.body || r.description || ''),
        icon_url: safeText(r.icon_url || r.image_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.digital_product_details = await refreshTable(
      'digital_product_details',
      ['product_slug', 'slug', 'section_type', 'heading', 'body', 'file_includes', 'bullets', 'image_url', 'is_active', 'order'],
      Array.isArray(digitalProductDetails) ? digitalProductDetails : [],
      (r) => ({
        product_slug: safeText(r.product_slug || r.slug || ''),
        slug: safeText(r.slug || r.product_slug || ''),
        section_type: safeText(r.section_type || r.type || ''),
        heading: safeText(r.heading || r.title || ''),
        body: safeText(r.body || r.description || ''),
        file_includes: safeText(r.file_includes || ''),
        bullets: safeText(r.bullets || ''),
        image_url: safeText(r.image_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.webinar_page_blocks = await refreshTable(
      'webinar_page_blocks',
      ['webinar_slug', 'slug', 'block_type', 'title', 'subtitle', 'body', 'bullets', 'image_url', 'bg_color', 'is_active', 'order'],
      Array.isArray(webinarPageBlocks) ? webinarPageBlocks : [],
      (r) => ({
        webinar_slug: safeText(r.webinar_slug || r.slug || ''),
        slug: safeText(r.slug || r.webinar_slug || ''),
        block_type: safeText(r.block_type || r.type || ''),
        title: safeText(r.title || ''),
        subtitle: safeText(r.subtitle || ''),
        body: safeText(r.body || r.description || ''),
        bullets: safeText(r.bullets || ''),
        image_url: safeText(r.image_url || ''),
        bg_color: safeText(r.bg_color || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.webinar_key_points_cards = await refreshTable(
      'webinar_key_points_cards',
      ['webinar_slug', 'slug', 'title', 'body', 'icon_url', 'is_active', 'order'],
      Array.isArray(webinarKeyPointsCards) ? webinarKeyPointsCards : [],
      (r) => ({
        webinar_slug: safeText(r.webinar_slug || r.slug || ''),
        slug: safeText(r.slug || r.webinar_slug || ''),
        title: safeText(r.title || ''),
        body: safeText(r.body || r.description || ''),
        icon_url: safeText(r.icon_url || r.image_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.short_reviews = await refreshTable(
      'short_reviews',
      ['slug', 'course_slug', 'webinar_slug', 'review_text', 'name', 'is_active', 'order'],
      allShortReviews,
      (r) => ({
        slug: safeText(r.slug || ''),
        course_slug: safeText(r.course_slug || ''),
        webinar_slug: safeText(r.webinar_slug || ''),
        review_text: safeText(r.review_text || r.review || r.text || ''),
        name: safeText(r.name || r.author || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.featured_reviews = await refreshTable(
      'featured_reviews',
      ['slug', 'course_slug', 'webinar_slug', 'title', 'review_text', 'name', 'image_url', 'is_active', 'order'],
      allFeaturedReviews,
      (r) => ({
        slug: safeText(r.slug || ''),
        course_slug: safeText(r.course_slug || ''),
        webinar_slug: safeText(r.webinar_slug || ''),
        title: safeText(r.title || ''),
        review_text: safeText(r.review_text || r.review || r.text || ''),
        name: safeText(r.name || r.author || ''),
        image_url: safeText(r.image_url || r.author_image_url || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.gallery_images = await refreshTable(
      'gallery_images',
      ['image_url', 'title', 'alt_text', 'is_active', 'order'],
      Array.isArray(galleryImages) ? galleryImages : [],
      (r) => ({
        image_url: safeText(r.image_url || r.url || ''),
        title: safeText(r.title || ''),
        alt_text: safeText(r.alt_text || r.alt || r.title || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.faq = await refreshTable(
      'faq',
      ['question', 'answer', 'is_active', 'order'],
      Array.isArray(faq) ? faq : [],
      (r) => ({
        question: safeText(r.question || ''),
        answer: safeText(r.answer || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    counts.who_for = await refreshTable(
      'who_for',
      ['icon', 'title', 'description', 'is_active', 'order'],
      Array.isArray(whoFor) ? whoFor : [],
      (r) => ({
        icon: safeText(r.icon || ''),
        title: safeText(r.title || ''),
        description: safeText(r.description || ''),
        is_active: toBool(r.is_active, true) ? 1 : 0,
        order: toNum(r.order, 0)
      })
    );

    await conn.query('DELETE FROM `polls_snapshot`');
    if (Array.isArray(polls) && polls.length) {
      const pFields = ['id', 'question', 'status', 'created_at_text', 'ends_at_text', 'require_name', 'show_voters_publicly', 'options_json', 'voters_json', 'description'];
      const placeholders = '(' + pFields.map(() => '?').join(',') + ')';
      const sql = 'INSERT INTO `polls_snapshot` (`' + pFields.join('`,`') + '`) VALUES ' + polls.map(() => placeholders).join(',');
      const vals = [];
      polls.forEach((p) => {
        vals.push(
          safeText(p.id),
          safeText(p.question),
          safeText(p.status || 'ACTIVE'),
          safeText(p.created_at),
          safeText(p.ends_at),
          toBool(p.require_name, false) ? 1 : 0,
          toBool(p.show_voters_publicly, false) ? 1 : 0,
          JSON.stringify(Array.isArray(p.options) ? p.options : []),
          JSON.stringify(Array.isArray(p.voters) ? p.voters : []),
          safeText(p.description)
        );
      });
      await conn.execute(sql, vals);
    }
    counts.polls_snapshot = Array.isArray(polls) ? polls.length : 0;

    await conn.execute(
      `INSERT INTO admin_credentials_snapshot (id, username, password_hash, whatsapp_number)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), password_hash = VALUES(password_hash), whatsapp_number = VALUES(whatsapp_number), updated_at = NOW()`,
      [safeText(creds.username || ''), safeText(creds.passwordHash || ''), safeText(whatsapp || '')]
    );

    console.log('Migration complete. Row counts:');
    Object.keys(counts).forEach((k) => {
      console.log(' - ' + k + ': ' + counts[k]);
    });
    console.log(' - hero_section: 1');
    console.log(' - about_section: 1');
    console.log(' - contact_section: 1');
    console.log(' - admin_credentials_snapshot: 1');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err && err.message ? err.message : err);
  process.exit(1);
});
