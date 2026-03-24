function renderCourseDetails(payload) {
  const course = payload && payload.course ? payload.course : null;
  const blocks = payload && payload.blocks ? payload.blocks : [];
  const forYouCards = payload && payload.forYouCards ? payload.forYouCards : [];
  const featuredReviews = payload && payload.featuredReviews ? payload.featuredReviews : [];
  const shortReviews = payload && payload.shortReviews ? payload.shortReviews : [];
  if (!course) { showErr('Course details not found.'); return; }

  D.mTitle.textContent = course.title || 'Course';
  clearEl(D.mContent);

  const layout = el('div', 'mlay');
  const mediaWrap = el('div', 'mmedia');
  if (course.thumbnail_url) {
    const img = el('img');
    img.src = String(course.thumbnail_url);
    img.alt = course.title ? String(course.title) : 'Course image';
    img.loading = 'lazy';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.appendChild(el('div', 'fallback', course.title || 'Course'));
  }

  const content = el('div', 'mcontent');
  if (course.subtitle) content.appendChild(el('p', '', course.subtitle));
  if (course.badge) content.appendChild(el('div', 'section-body', 'Badge: ' + course.badge));
  if (course.language) content.appendChild(el('div', 'section-body', 'Language: ' + course.language));
  if (course.students) content.appendChild(el('div', 'section-body', 'Students: ' + course.students));
  if (course.price_inr !== undefined) content.appendChild(el('span', 'price', money(course.price_inr)));

  const headBtn = el('button', 'btn b1', 'Enroll Now');
  if (course.payment_link || course.redirect_url) {
    headBtn.addEventListener('click', () => handleCourseOrProductPurchase(course));
  } else {
    headBtn.disabled = true;
  }
  content.appendChild(headBtn);

  layout.appendChild(mediaWrap);
  layout.appendChild(content);
  D.mContent.appendChild(layout);

  const byType = (type) => blocks.filter(b => String(b.block_type || '').trim() === type);
  addBlockSection(D.mContent, 'ABOUT', byType('about'), 'text');
  addBlockSection(D.mContent, 'HIGHLIGHTS', byType('highlights'), 'bullets');
  addBlockSection(D.mContent, 'LEARN', byType('learn'), 'bullets');
  addForYouCards(D.mContent, forYouCards);
  addBlockSection(D.mContent, 'NOT FOR', byType('not_for'), 'bullets');
  addBlockSection(D.mContent, 'FAQ', byType('faq'), 'faq');

  if (featuredReviews.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'Featured Reviews'));
    const wrap = el('div');
    featuredReviews.forEach(r => {
      const card = el('div', 'featured-card');
      if (r.image_url) {
        const img = el('img');
        img.src = String(r.image_url);
        img.alt = String(r.title || 'Review');
        img.loading = 'lazy';
        card.appendChild(img);
      }
      const txt = el('div');
      if (r.title) txt.appendChild(el('h4', '', String(r.title)));
      if (r.review_text) txt.appendChild(el('p', 'section-body', String(r.review_text)));
      if (r.name) txt.appendChild(el('div', 'section-body', String(r.name)));
      card.appendChild(txt);
      wrap.appendChild(card);
    });
    section.appendChild(wrap);
    D.mContent.appendChild(section);
  }

  if (shortReviews.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'Short Reviews'));
    shortReviews.forEach(r => {
      const card = el('div', 'short-card');
      if (r.review_text) card.appendChild(el('div', 'section-body', String(r.review_text)));
      if (r.name) card.appendChild(el('div', 'section-body', String(r.name)));
      section.appendChild(card);
    });
    D.mContent.appendChild(section);
  }

  const ctaWrap = el('div', 'mcta');
  const btn = el('button', 'btn b1', 'Enroll Now');
  if (!course.payment_link && !course.redirect_url) {
    btn.disabled = true;
  } else {
    btn.addEventListener('click', () => handleCourseOrProductPurchase(course));
  }
  ctaWrap.appendChild(btn);
  D.mContent.appendChild(ctaWrap);
}

function renderDigitalDetails(payload) {
  const product = payload && payload.product ? payload.product : null;
  const sections = payload && payload.sections ? payload.sections : [];
  if (!product) { showErr('Product details not found.'); return; }

  D.mTitle.textContent = product.title || 'Digital Product';
  clearEl(D.mContent);

  const layout = el('div', 'mlay');
  const mediaWrap = el('div', 'mmedia digital');
  if (product.thumbnail_url) {
    const img = el('img');
    img.src = String(product.thumbnail_url);
    img.alt = product.title ? String(product.title) : 'Product image';
    img.loading = 'lazy';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.appendChild(el('div', 'fallback', product.title || 'Product'));
  }

  const content = el('div', 'mcontent');
  if (product.subtitle) content.appendChild(el('p', '', product.subtitle));
  if (product.badge) content.appendChild(el('div', 'section-body', 'Badge: ' + product.badge));
  if (product.language) content.appendChild(el('div', 'section-body', 'Language: ' + product.language));
  if (product.price_inr !== undefined) content.appendChild(el('span', 'price', money(product.price_inr)));

  const btnRow = el('div', 'acts');
  const buy = el('button', 'btn b1', 'Buy Now');
  if (product.payment_link || product.redirect_url) {
    buy.addEventListener('click', () => handleCourseOrProductPurchase(product));
  } else {
    buy.disabled = true;
  }
  btnRow.appendChild(buy);

  if (product.preview_url) {
    const preview = el('button', 'btn b2', 'Preview');
    preview.addEventListener('click', () => window.open(String(product.preview_url), '_blank', 'noopener'));
    btnRow.appendChild(preview);
  }
  content.appendChild(btnRow);

  layout.appendChild(mediaWrap);
  layout.appendChild(content);
  D.mContent.appendChild(layout);

  const byType = (type) => sections.filter(s => String(s.section_type || '').trim() === type);

  const overview = byType('overview');
  if (overview.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'Overview'));
    overview.forEach(s => {
      if (s.heading) section.appendChild(el('div', '', String(s.heading)));
      if (s.body) section.appendChild(el('p', 'section-body', String(s.body)));
      const chips = renderChips(s.file_includes);
      if (chips) section.appendChild(chips);
      if (s.image_url) {
        const img = el('img', 'section-media');
        img.src = String(s.image_url);
        img.alt = String(s.heading || 'Overview image');
        img.loading = 'lazy';
        section.appendChild(img);
      }
    });
    D.mContent.appendChild(section);
  }

  const outcomes = byType('outcomes');
  if (outcomes.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'Outcomes'));
    outcomes.forEach(s => {
      const list = renderBulletsList(s.bullets);
      if (list) section.appendChild(list);
    });
    D.mContent.appendChild(section);
  }

  const faq = byType('faq');
  if (faq.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'FAQ'));
    faq.forEach(s => {
      const acc = renderFaqAccordion(s.bullets);
      if (acc) section.appendChild(acc);
    });
    D.mContent.appendChild(section);
  }

  const ctaWrap = el('div', 'mcta');
  const btn = el('button', 'btn b1', 'Buy Now');
  if (!product.payment_link && !product.redirect_url) {
    btn.disabled = true;
  } else {
    btn.addEventListener('click', () => handleCourseOrProductPurchase(product));
  }
  ctaWrap.appendChild(btn);
  D.mContent.appendChild(ctaWrap);
}

function renderWebinarDetails(payload) {
  const webinar = payload && payload.webinar ? payload.webinar : null;
  const blocks = payload && payload.blocks ? payload.blocks : [];
  const keyPoints = payload && payload.keyPoints ? payload.keyPoints : [];
  if (!webinar) { showErr('Webinar details not found.'); return; }

  D.mTitle.textContent = webinar.title || 'Webinar';
  clearEl(D.mContent);

  const layout = el('div', 'mlay');
  const mediaWrap = el('div', 'mmedia');
  if (webinar.banner_url) {
    const img = el('img');
    img.src = String(webinar.banner_url);
    img.alt = webinar.title ? String(webinar.title) : 'Webinar banner';
    img.loading = 'lazy';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.appendChild(el('div', 'fallback', webinar.title || 'Webinar'));
  }

  const content = el('div', 'mcontent');
  if (webinar.subtitle) content.appendChild(el('p', '', webinar.subtitle));
  if (webinar.host_image_url) {
    const hostRow = el('div', 'host-row');
    const hostCircle = el('img', 'host-circle');
    hostCircle.src = String(webinar.host_image_url);
    hostCircle.alt = 'Host';
    hostCircle.loading = 'lazy';
    hostRow.appendChild(hostCircle);
    if (webinar.host_name) hostRow.appendChild(el('strong', '', webinar.host_name));
    content.appendChild(hostRow);
  }
  if (webinar.platform) content.appendChild(el('div', 'section-body', 'Platform: ' + webinar.platform));
  if (webinar.start_datetime_local) {
    const d = parseDate(webinar.start_datetime_local);
    if (d) content.appendChild(el('div', 'section-body', 'Starts: ' + fmtDate(d, webinar.timezone)));
  }
  if (webinar.end_datetime_local) {
    const d = parseDate(webinar.end_datetime_local);
    if (d) content.appendChild(el('div', 'section-body', 'Ends: ' + fmtDate(d, webinar.timezone)));
  }

  const cta = el('button', 'btn b1', webinar.primary_cta_text || 'Register');
  const endAt = parseDate(webinar.end_datetime_local);
  if (endAt && Date.now() > endAt.getTime()) {
    cta.textContent = 'Event Ended';
    cta.disabled = true;
  } else if (webinar.payment_link) {
    cta.addEventListener('click', () => openPaymentModal('Register', String(webinar.payment_link)));
  } else {
    cta.disabled = true;
  }
  content.appendChild(cta);

  const clock = el('div', 'countdown');
  content.appendChild(clock);
  startCountdown(endAt, clock);

  layout.appendChild(mediaWrap);
  layout.appendChild(content);
  D.mContent.appendChild(layout);

  const byType = (type) => blocks.filter(b => String(b.block_type || '').trim() === type);
  addBlockSection(D.mContent, 'OVERVIEW', byType('overview'), 'text');
  addBlockSection(D.mContent, 'WHO FOR', byType('who_for'), 'bullets');
  if (keyPoints.length) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'Key Points'));
    const grid = el('div', 'for-you-grid');
    keyPoints.forEach(card => {
      const c = el('div', 'for-you-card');
      if (card.title) c.appendChild(el('h4', '', String(card.title)));
      if (card.body) c.appendChild(el('p', 'section-body', String(card.body)));
      if (card.icon_url) {
        const img = el('img', 'section-media');
        img.src = String(card.icon_url);
        img.alt = String(card.title || 'Key point');
        img.loading = 'lazy';
        c.appendChild(img);
      }
      grid.appendChild(c);
    });
    section.appendChild(grid);
    D.mContent.appendChild(section);
  }
  addBlockSection(D.mContent, 'FAQ', byType('faq'), 'faq');
}

function renderMembershipBenefitSection(title, bulletText) {
  if (!bulletText || !String(bulletText).trim()) return null;
  const section = el('div', 'section-card');
  section.appendChild(el('h4', 'section-title', title));
  const items = parseBullets(bulletText);
  if (items.length) {
    const ul = el('ul', 'list');
    items.forEach(t => ul.appendChild(el('li', '', t)));
    section.appendChild(ul);
  }
  return section;
}

function renderMembershipDetails(plan) {
  D.mTitle.textContent = plan.title || 'Membership';
  clearEl(D.mContent);
  const layout = el('div', 'mlay');
  const mediaWrap = el('div', 'mmedia');
  if (plan.img) {
    const img = el('img');
    img.src = String(plan.img);
    img.alt = plan.title ? String(plan.title) : 'Membership image';
    img.loading = 'lazy';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.appendChild(el('div', 'fallback', plan.title || 'Membership'));
  }
  const content = el('div', 'mcontent');
  if (plan.period) content.appendChild(el('p', '', plan.period));
  content.appendChild(el('span', 'price', money(plan.price)));
  const btn = el('button', 'btn b1', 'Buy Now');
  if (plan.link) {
    btn.addEventListener('click', () => openPaymentModal('Join Now', String(plan.link)));
  } else {
    btn.disabled = true;
  }
  content.appendChild(btn);
  layout.appendChild(mediaWrap);
  layout.appendChild(content);
  D.mContent.appendChild(layout);
  if (plan.features) {
    const sec = renderMembershipBenefitSection('What You Get Inside', plan.features);
    if (sec) D.mContent.appendChild(sec);
  }
  if (plan.target_audience) {
    const sec = renderMembershipBenefitSection('Who Is This For', plan.target_audience);
    if (sec) D.mContent.appendChild(sec);
  }
  if (plan.benefits) {
    const sec = renderMembershipBenefitSection('Key Benefits', plan.benefits);
    if (sec) D.mContent.appendChild(sec);
  }
  if (plan.description && !plan.features && !plan.benefits) {
    const section = el('div', 'section-card');
    section.appendChild(el('h4', 'section-title', 'About This Plan'));
    section.appendChild(el('p', 'section-body', plan.description));
    D.mContent.appendChild(section);
  }
}

async function openCourseDetails(slug) {
  mc = { type: 'course', id: slug };
  setModalLoading();
  openModal();
  try {
    const cacheKey = 'course_' + slug;
    if (DETAILS_CACHE[cacheKey]) {
      renderCourseDetails(DETAILS_CACHE[cacheKey]);
      return;
    }
    const details = await run('getCourseDetails', { slug });
    DETAILS_CACHE[cacheKey] = details;
    renderCourseDetails(details);
  } catch (e) {
    showErr('Unable to load course details: ' + errText(e));
  }
}

async function openDigitalDetails(slug) {
  mc = { type: 'digital', id: slug };
  setModalLoading();
  openModal();
  try {
    const cacheKey = 'digital_' + slug;
    if (DETAILS_CACHE[cacheKey]) {
      renderDigitalDetails(DETAILS_CACHE[cacheKey]);
      return;
    }
    const details = await run('getDigitalProductDetails', { slug });
    DETAILS_CACHE[cacheKey] = details;
    renderDigitalDetails(details);
  } catch (e) {
    showErr('Unable to load product details: ' + errText(e));
  }
}

async function openWebinarDetails(slug) {
  mc = { type: 'webinar', id: slug };
  setModalLoading();
  openModal();
  try {
    const cacheKey = 'webinar_' + slug;
    if (DETAILS_CACHE[cacheKey]) {
      renderWebinarDetails(DETAILS_CACHE[cacheKey]);
      return;
    }
    const details = await run('getWebinarDetails', { slug });
    DETAILS_CACHE[cacheKey] = details;
    renderWebinarDetails(details);
  } catch (e) {
    showErr('Unable to load webinar details: ' + errText(e));
  }
}
