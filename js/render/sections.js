function getFeaturedReviewImageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const keys = ['image_url', 'image', 'img', 'photo_url', 'photo', 'review_image_url', 'review_image', 'thumbnail_url', 'thumbnail', 'banner_url'];
  for (let i = 0; i < keys.length; i++) {
    const url = String(item[keys[i]] || '').trim();
    if (url) return url;
  }
  return '';
}

function createFeaturedReviewCard(item) {
  const card = el('div', 'featured-card');
  const media = el('div', 'featured-media');
  const fallback = el('div', 'fallback', String(item.title || item.name || 'Review'));
  const imageUrl = getFeaturedReviewImageUrl(item);

  if (imageUrl) {
    const img = el('img');
    img.alt = String(item.title || item.name || 'Review image');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      clearEl(media);
      media.appendChild(fallback);
    });
    img.src = imageUrl;
    media.appendChild(img);
  } else {
    media.appendChild(fallback);
  }

  card.appendChild(media);
  const txt = el('div', 'featured-copy');
  if (item.title) txt.appendChild(el('h4', '', String(item.title)));
  if (item.review_text) txt.appendChild(el('p', 'section-body', String(item.review_text)));
  if (item.name) txt.appendChild(el('div', 'section-body reviewer', String(item.name)));
  if (!txt.children.length) {
    txt.appendChild(el('p', 'section-body', 'Review details coming soon.'));
  }
  card.appendChild(txt);
  return card;
}

function preloadFeaturedImages(list) {
  (list || []).forEach(item => {
    const url = getFeaturedReviewImageUrl(item);
    if (!url) return;
    const img = new Image();
    img.src = url;
  });
}

function renderFeaturedReviews(list, target, atIndex) {
  clearEl(target);
  if (!list || !list.length) {
    target.appendChild(el('p', 'section-body', 'No featured reviews yet.'));
    return;
  }
  const total = list.length;
  const baseIndex = Number.isFinite(atIndex) ? atIndex : featuredIdx;
  const idx = ((baseIndex % total) + total) % total;
  target.appendChild(createFeaturedReviewCard(list[idx]));
  target.dataset.featuredIndex = String(idx);
}

function animateFeaturedRight(target, list, nextIdx) {
  // Keep API stable, but render a single review card (no dual-card slide track).
  renderFeaturedReviews(list, target, nextIdx);
}

function startFeaturedRotation() {
  if (featuredTimer) clearInterval(featuredTimer);
  featuredTimer = setInterval(() => {
    if (!S.featuredReviews.length) return;
    const total = S.featuredReviews.length;
    featuredIdx = (featuredIdx + 1) % total;
    animateFeaturedRight(D.featured, S.featuredReviews, featuredIdx);
    if (galleryFeaturedSlot) {
      animateFeaturedRight(galleryFeaturedSlot, S.featuredReviews, featuredIdx);
    }
  }, 3000);
}

function renderShortReviews(list) {
  clearEl(D.shortReviews);
  const items = list && list.length ? list : [];
  if (items.length === 0) return;

  items.forEach((item, idx) => {
    const card = el('div', 'short-card');
    if (idx === 0) card.classList.add('active');

    const reviewText = el('p');
    if (item.review_text) reviewText.textContent = '"' + cleanDisplayText(item.review_text) + '"';
    card.appendChild(reviewText);

    if (item.name) {
      const name = el('strong');
      name.textContent = '- ' + cleanDisplayText(item.name);
      card.appendChild(name);
    }

    D.shortReviews.appendChild(card);
  });

  // Cycle through reviews with smooth slide-up animation
  let currentIdx = 0;
  setInterval(() => {
    const cards = D.shortReviews.querySelectorAll('.short-card');
    if (cards.length === 0) return;

    // Add exit animation to current active card
    cards[currentIdx].classList.add('exit');
    cards[currentIdx].classList.remove('active');

    // After animation completes, move to next review
    setTimeout(() => {
      cards[currentIdx].classList.remove('exit');
      currentIdx = (currentIdx + 1) % cards.length;

      // Add active class to next card (triggers slideUpIn animation)
      cards[currentIdx].classList.add('active');
    }, 600); // Match animation duration
  }, 5000);
}

const galleryCards = [];
const galleryIntervals = [];

function renderGallery(images) {
  clearEl(D.gGrid);
  galleryCards.length = 0;
  galleryIntervals.forEach(interval => clearInterval(interval));
  galleryIntervals.length = 0;

  if (!images || images.length === 0) {
    return;
  }
  const isMobileGallery = window.matchMedia('(max-width:600px)').matches;
  const slotCount = isMobileGallery ? 4 : 6;
  galleryIsMobile = isMobileGallery;

  // Helper function to get next unique image index not currently displayed
  function getNextUniqueImage(currentIndex, cardIdx) {
    const usedIndices = galleryCards
      .map((c, i) => i !== cardIdx ? c.currentIndex : -1)
      .filter(i => i !== -1);

    let nextIndex = (currentIndex + 1) % images.length;
    let attempts = 0;
    const maxAttempts = images.length;

    // Find next index not in use
    while (usedIndices.includes(nextIndex) && attempts < maxAttempts) {
      nextIndex = (nextIndex + 1) % images.length;
      attempts++;
    }

    return nextIndex;
  }

  // Create gallery cards with unique initial indices
  for (let i = 0; i < slotCount; i++) {
    const item = el('div', 'gallery-item');
    const image = el('img');
    image.alt = 'Gallery image';
    image.loading = i < 3 ? 'eager' : 'lazy';
    item.appendChild(image);
    D.gGrid.appendChild(item);
    // Ensure unique initial indices - only use modulo if not enough images
    const initialIndex = i < images.length ? i : i % images.length;
    galleryCards.push({ item, image, currentIndex: initialIndex });
  }

  // Initialize images
  galleryCards.forEach(card => {
    const imgData = images[card.currentIndex];
    const url = String(imgData?.image_url || imgData?.url || '').trim();
    if (url) card.image.src = url;
  });

  // Rotate images every 4 seconds (staggered start)
  galleryCards.forEach((card, idx) => {
    const interval = setInterval(() => {
      // Get next unique image index
      card.currentIndex = getNextUniqueImage(card.currentIndex, idx);
      const imgData = images[card.currentIndex];
      const url = String(imgData?.image_url || imgData?.url || '').trim();
      if (url) {
        card.image.classList.add('fade');
        setTimeout(() => {
          card.image.src = url;
          card.image.classList.remove('fade');
        }, 250);
      }
    }, 4000 + (idx * 600));
    galleryIntervals.push(interval);
  });
}

function renderFAQ(faqItems) {
  if (!D.faqGrid) return;
  clearEl(D.faqGrid);
  if (!faqItems || !faqItems.length) {
    D.faqGrid.appendChild(el('p', 'empty', 'No FAQs available yet.'));
    return;
  }
  faqItems.forEach(item => {
    const details = el('details', 'faq-item');
    const summary = el('summary', '', cleanDisplayText(item.question || 'Question'));
    const answer = el('div', 'faq-answer', cleanDisplayText(item.answer || ''));
    details.appendChild(summary);
    details.appendChild(answer);
    D.faqGrid.appendChild(details);
  });
}

function whoIconSvg(index) {
  const icons = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m5 10.5 7 3.5 7-3.5"/><path d="M8 14v3.5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5V14"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 21h8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12v12H4z"/><path d="m10 12 3-3"/><path d="m10 9h3v3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19c.8-2.2 2.7-3.5 5-3.5s4.2 1.3 5 3.5"/><path d="M11 19c.6-1.8 2.1-2.8 4-2.8s3.4 1 4 2.8"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 4 7v4a4 4 0 1 1-8 0v-4l4-7Z"/><path d="M12 21v-3"/></svg>'
  ];
  return icons[index % icons.length];
}

function renderWhoFor(whoItems) {
  if (!D.whoGrid) return;
  clearEl(D.whoGrid);
  if (!whoItems || !whoItems.length) {
    D.whoGrid.appendChild(el('p', 'empty', 'Information coming soon.'));
    return;
  }
  whoItems.forEach((item, idx) => {
    const card = el('div', 'who-card');
    const inner = el('div', 'who-card-inner');

    // Front side - shows icon and title
    const front = el('div', 'who-card-front');
    const iconDiv = el('div', 'who-card-icon');
    iconDiv.innerHTML = whoIconSvg(idx);
    front.appendChild(iconDiv);
    const title = el('h4', 'who-card-title', cleanDisplayText(item.title || 'Category'));
    front.appendChild(title);

    // Back side - shows description
    const back = el('div', 'who-card-back');
    const backTitle = el('h4', 'who-card-title', cleanDisplayText(item.title || 'Category'));
    back.appendChild(backTitle);
    const desc = el('p', 'who-card-desc', cleanDisplayText(item.description || ''));
    desc.style.display = 'block';
    back.appendChild(desc);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    D.whoGrid.appendChild(card);
  });
}

function renderAcademyBeforeAfter(beforeItems, afterItems) {
  if (!D.academyBeforeList || !D.academyAfterList) return;
  clearEl(D.academyBeforeList);
  clearEl(D.academyAfterList);

  (beforeItems || []).forEach(item => {
    const text = cleanDisplayText(item.challenge || item.title || item.text || '');
    if (!text) return;
    D.academyBeforeList.appendChild(el('li', '', text));
  });

  (afterItems || []).forEach(item => {
    const text = cleanDisplayText(item.benefit || item.title || item.text || '');
    if (!text) return;
    D.academyAfterList.appendChild(el('li', '', text));
  });
}

function renderAcademyFeatures(items) {
  if (!D.academyFeaturesGrid) return;
  clearEl(D.academyFeaturesGrid);

  (items || []).forEach((item, idx) => {
    const card = el('article', 'academy-feature-card');
    card.appendChild(el('div', 'academy-feature-icon', String(item.icon_emoji || (idx + 1))));
    card.appendChild(el('h3', '', cleanDisplayText(item.title || 'Feature')));
    card.appendChild(el('p', 'section-body', cleanDisplayText(item.description || item.details || '')));
    D.academyFeaturesGrid.appendChild(card);
  });
}

function renderAcademyRoadmap(items) {
  if (!D.academyRoadmapGrid) return;
  clearEl(D.academyRoadmapGrid);

  (items || []).forEach((item, idx) => {
    const card = el('article', 'academy-feature-card');
    card.appendChild(el('div', 'academy-feature-icon', String(item.stage_num || (idx + 1))));
    card.appendChild(el('h3', '', cleanDisplayText(item.stage_name || item.title || 'Stage')));
    card.appendChild(el('p', 'section-body', cleanDisplayText(item.description || '')));
    D.academyRoadmapGrid.appendChild(card);
  });
}

function renderAcademyCommunity(items) {
  if (!D.academyCommunityGrid) return;
  clearEl(D.academyCommunityGrid);

  (items || []).forEach(item => {
    const card = el('article', 'academy-feature-card');
    card.appendChild(el('span', 'badge bdef', cleanDisplayText(item.post_type || 'Community')));
    card.appendChild(el('p', 'section-body', cleanDisplayText(item.content || '')));
    card.appendChild(el('strong', '', cleanDisplayText(item.author || 'Findas Community')));
    D.academyCommunityGrid.appendChild(card);
  });
}
