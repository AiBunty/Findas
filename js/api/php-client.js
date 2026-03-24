function apiBaseJoin(path) {
  const p = String(path || '').trim();
  if (!p) return PHP_API_BASE;
  return PHP_API_BASE + (p.startsWith('/') ? p : '/' + p);
}

async function phpRequest(path, options) {
  const resp = await fetch(apiBaseJoin(path), Object.assign({
    method: 'GET',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
  }, options || {}));
  let payload = null;
  try {
    payload = await resp.json();
  } catch (e) {
    payload = null;
  }
  if (!resp.ok || !payload || payload.ok === false) {
    throw new Error((payload && payload.error) || ('HTTP ' + resp.status));
  }
  return payload.data;
}

async function phpList(resource) {
  const data = await phpRequest('/' + resource);
  return Array.isArray(data) ? data : [];
}

async function phpSingleton(resource) {
  const data = await phpRequest('/' + resource);
  return data && typeof data === 'object' ? data : {};
}

async function runPhpApi(name, params) {
  const slug = params && typeof params === 'object' ? String(params.slug || '').trim() : '';
  switch (name) {
    case 'getGlobalSettings': {
      const contact = await phpSingleton('contact');
      return {
        site_name: 'Findas Academy',
        contact_phone: contact.phone || '',
        contact_email: contact.email || '',
        contact_address: contact.address || ''
      };
    }
    case 'getSiteConfig': {
      const out = await Promise.all([
        phpSingleton('hero'),
        phpSingleton('about'),
        phpSingleton('contact'),
        phpSingleton('site-assets')
      ]);
      const hero = out[0] || {};
      const about = out[1] || {};
      const contact = out[2] || {};
      const assets = out[3] || {};
      return {
        hero_title: hero.title || '',
        hero_subtitle: hero.subtitle || '',
        hero_button_1_text: hero.button_text_1 || '',
        hero_button_2_text: hero.button_text_2 || '',
        hero_video_url: hero.video_url || '',
        founder_title: about.founder_title || '',
        founder_paragraph_1: about.paragraph_1 || '',
        founder_paragraph_2: about.paragraph_2 || '',
        founder_paragraph_3: about.paragraph_3 || '',
        founder_image_url: about.founder_image_url || '',
        navbar_logo_url: assets.navbar_logo_url || '',
        footer_logo_url: assets.footer_logo_url || '',
        loading_logo_url: assets.loading_logo_url || '',
        favicon_url: assets.favicon_url || '',
        gallery_enabled: contact.gallery_enabled,
        footer_phone: contact.phone || '',
        footer_address: contact.address || ''
      };
    }
    case 'getCourses':
      return phpList('courses');
    case 'getDigitalProducts':
      return phpList('digital-products');
    case 'getWebinars':
      return phpList('webinars');
    case 'getMembershipPlans':
      return phpList('membership');
    case 'getAcademySections':
      return phpList('academy-sections');
    case 'getAcademyBefore':
      return phpList('academy-before');
    case 'getAcademyAfter':
      return phpList('academy-after');
    case 'getAcademyRoadmap':
      return phpList('academy-roadmap');
    case 'getAcademyCommunityPosts':
      return phpList('academy-community');
    case 'getGalleryImages':
      return phpList('gallery-images');
    case 'getShortReviews':
      return phpList('short-reviews');
    case 'getFeaturedReviews':
      return phpList('featured-reviews');
    case 'getFAQ':
      return phpList('faq');
    case 'getWhoFor':
      return phpList('who-for');
    case 'getBookingPage':
      return {};
    case 'saveBookingConfirmation':
      return { saved: false, mode: 'client-only' };
    case 'getCourseDetails': {
      if (!slug) throw new Error('Course slug is required');
      return phpRequest('/course-details/' + encodeURIComponent(slug));
    }
    case 'getDigitalProductDetails': {
      if (!slug) throw new Error('Product slug is required');
      return phpRequest('/digital-product-details/' + encodeURIComponent(slug));
    }
    case 'getWebinarDetails': {
      if (!slug) throw new Error('Webinar slug is required');
      return phpRequest('/webinar-details/' + encodeURIComponent(slug));
    }
    default:
      throw new Error('Unsupported API method: ' + name);
  }
}
