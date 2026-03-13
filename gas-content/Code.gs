/*
README - Findas Academy CMS (Google Sheets)

1) Set spreadsheet ID:
   - Replace SPREADSHEET_ID below with the ID from your Google Sheet URL:
     https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit

2) Deploy as Apps Script Web App:
   - Open Apps Script project.
   - Deploy > New deployment > Web app.
   - Execute as: Me
   - Who has access: Anyone (or Anyone with link)
   - Deploy and copy web app URL.
*/

const SPREADSHEET_ID = '1a8PI6ppFLT2VbR8ArSpfDE4--3FGXiESBWFdQWCrNaU';
const ADMIN_EMAIL = 'admin@example.com';
const CACHE_TTL_SECONDS = 300;

/**
 * DISABLED: This function is no longer active to prevent accidental data loss.
 * The site_config sheet must be maintained manually in Google Sheets.
 * 
 * To add new fields:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1a8PI6ppFLT2VbR8ArSpfDE4--3FGXiESBWFdQWCrNaU/
 * 2. Go to 'site_config' tab
 * 3. Add new row with key name and value
 * 4. Changes take effect after ~5 minutes (cache refresh)
 */
function initializeSiteConfig() {
  return {
    success: false,
    message: 'initializeSiteConfig() is DISABLED to protect existing sheet data. Manually edit the site_config sheet instead.',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1a8PI6ppFLT2VbR8ArSpfDE4--3FGXiESBWFdQWCrNaU/'
  };
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  if (params.api === '1' || params.fn) {
    return handleApiRequest_(params);
  }

  return HtmlService.createHtmlOutput(
    '<h2>Findas API Endpoint</h2>' +
    '<p>Use query params like <code>?api=1&fn=getCourses</code>.</p>'
  )
    .setTitle('Findas Academy')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getGlobalSettings() {
  const rows = getSheetData_('global_settings');
  if (!rows.length) return {};

  if (rows[0].key !== undefined && rows[0].value !== undefined) {
    const map = {};
    rows.forEach(function (row) {
      const key = String(row.key || '').trim();
      if (!key) return;
      map[key] = row.value;
    });
    return map;
  }

  return rows[0];
}

function getCourses() {
  return sortByOrder_(filterActive_(getSheetData_('courses')));
}

function getDigitalProducts() {
  return sortByOrder_(filterActive_(getSheetData_('digital_products')));
}

function getWebinars() {
  return sortByOrder_(filterActive_(getSheetData_('webinars')));
}

function getMembershipPlans() {
  return normalizeMembershipPlans_(sortByOrder_(filterActive_(getSheetData_('membership_plans'))));
}

function normalizeMembershipPlans_(rows) {
  return (rows || []).map(function (row) {
    if (!row) return row;
    const copy = Object.assign({}, row);
    if (copy.description === undefined || copy.description === '') {
      copy.description = pickFirst_(copy, ['description', 'Description', 'plan_description']);
    }
    if (copy.image_url === undefined || copy.image_url === '') {
      copy.image_url = pickFirst_(copy, ['image_url', 'Image_url', 'image', 'Image', 'plan_image_url']);
    }
    if (copy.features === undefined || copy.features === '') {
      copy.features = pickFirst_(copy, ['features', 'Features', 'what_you_get', 'What_You_Get']);
    }
    if (copy.target_audience === undefined || copy.target_audience === '') {
      copy.target_audience = pickFirst_(copy, ['target_audience', 'Target_Audience', 'who_is_this_for', 'Who_Is_This_For']);
    }
    if (copy.benefits === undefined || copy.benefits === '') {
      copy.benefits = pickFirst_(copy, ['benefits', 'Benefits', 'key_benefits', 'Key_Benefits']);
    }
    return copy;
  });
}

function getGalleryImages() {
  return sortByOrder_(filterActive_(getSheetData_('gallery_images')));
}

function getBookingPage() {
  const rows = filterActive_(sheetToObjects_('booking_page'));
  return rows.length ? rows[0] : {};
}

function saveBookingConfirmation(payload) {
  const data = payload || {};
  const name = sanitizeText_(data.name);
  const email = sanitizeText_(data.email);
  const phone = sanitizeText_(data.phone);
  const source = sanitizeText_(data.source || 'manual');
  const notes = sanitizeText_(data.notes || '');

  if (!name) throw new Error('Name is required.');
  if (!email || !isValidEmail_(email)) throw new Error('Valid email is required.');
  if (!phone || phone.length < 7) throw new Error('Valid phone is required.');

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('booking_confirmations');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('booking_confirmations');
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'name', 'email', 'phone', 'source', 'notes']);
  }

  const timestamp = new Date();
  sheet.appendRow([timestamp, name, email, phone, source, notes]);

  const userBody = 'Hi ' + name + ',\n\nYour booking confirmation has been received. Our team will contact you shortly.\n\nThank you,\nFindas Academy';
  GmailApp.sendEmail(email, 'Booking Confirmation – FINDAS', userBody);

  const adminBody = 'New booking confirmed:\n\nName: ' + name + '\nEmail: ' + email + '\nPhone: ' + phone + '\nSource: ' + source + '\nNotes: ' + notes + '\nTimestamp: ' + timestamp;
  GmailApp.sendEmail(ADMIN_EMAIL, 'New Booking Confirmed – ' + name, adminBody);

  return { success: true };
}

function getCourseDetails(slug) {
  const id = String(slug || '').trim();
  if (!id) throw new Error('Course slug is required.');

  const course = findBySlug_(getSheetData_('courses'), id, ['slug']);
  if (!course || !isActive_(course)) {
    throw new Error('Course not found for slug: ' + id);
  }

  return {
    course: course,
    blocks: sortByOrder_(filterBySlugActive_(getSheetData_('course_page_blocks'), id, ['slug', 'course_slug'])),
    forYouCards: sortByOrder_(filterBySlugActive_(getSheetData_('course_for_you_cards'), id, ['slug', 'course_slug'])),
    shortReviews: limit_(sortByOrder_(filterBySlugOptional_(getSheetData_('short_reviews'), id, ['course_slug', 'slug'])), 10),
    featuredReviews: sortByOrder_(filterBySlugOptional_(getSheetData_('featured_reviews'), id, ['course_slug', 'slug']))
  };
}

function getDigitalProductDetails(slug) {
  const id = String(slug || '').trim();
  if (!id) throw new Error('Product slug is required.');

  const product = findBySlug_(getSheetData_('digital_products'), id, ['slug']);
  if (!product || !isActive_(product)) {
    throw new Error('Product not found for slug: ' + id);
  }

  return {
    product: product,
    sections: sortByOrder_(filterBySlugActive_(getSheetData_('digital_product_details'), id, ['slug', 'product_slug']))
  };
}

function getWebinarDetails(slug) {
  const id = String(slug || '').trim();
  if (!id) throw new Error('Webinar slug is required.');

  const webinar = findBySlug_(getSheetData_('webinars'), id, ['slug']);
  if (!webinar || !isActive_(webinar)) {
    throw new Error('Webinar not found for slug: ' + id);
  }

  return {
    webinar: webinar,
    blocks: sortByOrder_(filterBySlugActive_(getSheetData_('webinar_page_blocks'), id, ['slug', 'webinar_slug'])),
    keyPoints: sortByOrder_(filterBySlugActive_(getSheetData_('webinar_key_points_cards'), id, ['slug', 'webinar_slug'])),
    featuredReviews: sortByOrder_(filterBySlugOptional_(getSheetData_('featured_reviews'), id, ['webinar_slug', 'slug']))
  };
}

function getShortReviews() {
  return limit_(sortByOrder_(filterActive_(getSheetData_('short_reviews'))), 10);
}

function getFeaturedReviews() {
  return sortByOrder_(filterActive_(getSheetData_('featured_reviews')));
}

function getFAQ() {
  try {
    return sortByOrder_(filterActive_(getSheetData_('faq')));
  } catch (error) {
    // Return empty array if sheet doesn't exist - frontend will use defaults
    return [];
  }
}

function getWhoFor() {
  try {
    return sortByOrder_(filterActive_(getSheetData_('who_for')));
  } catch (error) {
    // Return empty array if sheet doesn't exist - frontend will use defaults
    return [];
  }
}

function getSiteConfig() {
  try {
    const rows = getSheetData_('site_config');
    if (!rows || !rows.length) return {};

    // If the sheet has key-value pairs in columns
    if (rows[0].key !== undefined && rows[0].value !== undefined) {
      const config = {};
      rows.forEach(function (row) {
        const key = String(row.key || '').trim();
        if (!key) return;
        config[key] = row.value || '';
      });
      return config;
    }

    // Otherwise return first row as object
    return rows[0] || {};
  } catch (error) {
    // Return empty object if sheet doesn't exist - frontend will use defaults
    return {};
  }
}

function handleApiRequest_(params) {
  const callback = sanitizeCallback_(params.callback || '');

  try {
    const fn = String(params.fn || '').trim();
    let data;

    if (fn === 'getGlobalSettings') {
      data = getGlobalSettings();
    } else if (fn === 'getCourses') {
      data = getCourses();
    } else if (fn === 'getCourseDetails') {
      data = getCourseDetails(params.slug || '');
    } else if (fn === 'getDigitalProducts') {
      data = getDigitalProducts();
    } else if (fn === 'getDigitalProductDetails') {
      data = getDigitalProductDetails(params.slug || '');
    } else if (fn === 'getWebinars') {
      data = getWebinars();
    } else if (fn === 'getWebinarDetails') {
      data = getWebinarDetails(params.slug || '');
    } else if (fn === 'getMembershipPlans') {
      data = getMembershipPlans();
    } else if (fn === 'getGalleryImages') {
      data = getGalleryImages();
    } else if (fn === 'getBookingPage') {
      data = getBookingPage();
    } else if (fn === 'saveBookingConfirmation') {
      data = saveBookingConfirmation(params);
    } else if (fn === 'getShortReviews') {
      data = getShortReviews();
    } else if (fn === 'getFeaturedReviews') {
      data = getFeaturedReviews();
    } else if (fn === 'getFAQ') {
      data = getFAQ();
    } else if (fn === 'getWhoFor') {
      data = getWhoFor();
    } else if (fn === 'getSiteConfig') {
      data = getSiteConfig();
    } else {
      return createApiOutput_(
        { ok: false, error: 'Unknown fn.' },
        callback
      );
    }

    return createApiOutput_({ ok: true, data: data }, callback);
  } catch (error) {
    return createApiOutput_({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function createApiOutput_(payload, callback) {
  const json = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(value) {
  return String(value || '').replace(/[^\w$.]/g, '');
}

function pickFirst_(row, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function sheetToObjects_(tabName) {
  return getSheetData_(tabName);
}

function getSheetData_(tabName) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('SPREADSHEET_ID is not set. Update Code.gs with your real Google Sheet ID.');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'sheet_json_' + tabName;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Ignore broken cache and refresh.
    }
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    throw new Error('Sheet tab not found: ' + tabName);
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];

  const headers = values[0].map(function (header) {
    return String(header || '').trim();
  });

  const rows = [];
  for (var r = 1; r < values.length; r++) {
    const row = values[r];
    let hasData = false;
    const obj = {};

    for (var c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const cell = row[c];
      obj[key] = cell;

      if (cell !== '' && cell !== null && cell !== undefined) {
        hasData = true;
      }
    }

    if (hasData) {
      rows.push(obj);
    }
  }

  cache.put(cacheKey, JSON.stringify(rows), CACHE_TTL_SECONDS);
  return rows;
}

function isActive_(item) {
  if (!item || item.is_active === undefined || item.is_active === '') {
    return true;
  }
  const value = String(item.is_active).toLowerCase().trim();
  return value === 'true' || value === '1' || value === 'yes' || value === 'y';
}

function filterActive_(items) {
  return (items || []).filter(isActive_);
}

function sortByOrder_(items) {
  return (items || []).slice().sort(function (a, b) {
    const av = Number(a && a.order !== undefined ? a.order : 0) || 0;
    const bv = Number(b && b.order !== undefined ? b.order : 0) || 0;
    return av - bv;
  });
}

function filterBySlugActive_(items, slug, keys) {
  const id = String(slug || '').trim();
  const cols = Array.isArray(keys) ? keys : [keys || 'slug'];
  return filterActive_(items).filter(function (item) {
    return cols.some(function (col) {
      return String(item[col] || '').trim() === id;
    });
  });
}

function filterBySlugOptional_(items, slug, keys) {
  const cols = Array.isArray(keys) ? keys : [keys || 'slug'];
  const active = filterActive_(items);
  const hasKey = active.some(function (item) {
    return cols.some(function (col) {
      return item[col] !== undefined && item[col] !== '';
    });
  });
  if (!hasKey) return active;
  return filterBySlugActive_(active, slug, cols);
}

function findBySlug_(items, slug, keys) {
  const cols = Array.isArray(keys) ? keys : [keys || 'slug'];
  const id = String(slug || '').trim();
  return (items || []).find(function (item) {
    return cols.some(function (col) {
      return String(item[col] || '').trim() === id;
    });
  }) || null;
}

function limit_(items, count) {
  const max = Number(count || 0) || 0;
  if (!max) return items || [];
  return (items || []).slice(0, max);
}

function sanitizeText_(value) {
  return String(value || '').trim();
}

function isValidEmail_(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim());
}

function createMissingSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Create FAQ sheet if it doesn't exist
  if (!spreadsheet.getSheetByName('faq')) {
    const faqSheet = spreadsheet.insertSheet('faq');
    faqSheet.appendRow(['order', 'is_active', 'question', 'answer']);
    faqSheet.appendRow([1, 'true', 'What is the refund policy?', 'We offer a full refund within 14 days of purchase if you are not satisfied with the course or product. No questions asked. Simply reach out to our support team.']);
    faqSheet.appendRow([2, 'true', 'Are courses self-paced?', 'Yes! All courses are completely self-paced with lifetime access. You can learn at your own speed, anytime, anywhere.']);
    faqSheet.appendRow([3, 'true', 'Is there any live interaction?', 'Most courses include access to live group Q&A sessions where you can ask questions and get feedback from our instructors.']);
    faqSheet.appendRow([4, 'true', 'Do I need any prior experience?', 'Most of our courses are designed for everyone, regardless of prior experience. Just get started and learn at your own pace.']);
    faqSheet.appendRow([5, 'true', 'Can I take multiple courses?', 'Absolutely! There are no limits. We encourage you to explore and take any courses that interest you.']);
    faqSheet.appendRow([6, 'true', 'Is there a community?', 'Yes, premium members get access to our exclusive community where you can connect with fellow learners and network.']);
    faqSheet.setColumnWidth(1, 60);
    faqSheet.setColumnWidth(2, 80);
    faqSheet.setColumnWidth(3, 300);
    faqSheet.setColumnWidth(4, 500);
  }
  
  // Create Who Is For sheet if it doesn't exist
  if (!spreadsheet.getSheetByName('who_for')) {
    const whoSheet = spreadsheet.insertSheet('who_for');
    whoSheet.appendRow(['order', 'is_active', 'icon', 'title', 'description']);
    whoSheet.appendRow([1, 'true', '🎓', 'Students', 'Learn concepts that are not covered in traditional schooling.']);
    whoSheet.appendRow([2, 'true', '💼', 'Working Professionals', 'Develop essential skills to enhance their career and boost productivity.']);
    whoSheet.appendRow([3, 'true', '💻', 'Freelancers', 'Discover ways to grow, manage, and streamline your freelance business.']);
    whoSheet.appendRow([4, 'true', '🔄', 'Career Shifters', 'Get the guidance needed to pivot confidently into a new field.']);
    whoSheet.appendRow([5, 'true', '👨‍👩‍👧‍👦', 'Parents', 'Manage time and personal growth while balancing family needs.']);
    whoSheet.appendRow([6, 'true', '✨', 'Dreamers', 'Gain insights and strategies to create their own journey.']);
    whoSheet.setColumnWidth(1, 60);
    whoSheet.setColumnWidth(2, 80);
    whoSheet.setColumnWidth(3, 80);
    whoSheet.setColumnWidth(4, 200);
    whoSheet.setColumnWidth(5, 450);
  }
}

function runSetup() {
  createMissingSheets_();
  SpreadsheetApp.getUi().alert('✅ FAQ and Who Is For sheets created successfully!\n\nYour website will now display these sections with default content.\n\nYou can edit the data directly in Google Sheets anytime.');
}
