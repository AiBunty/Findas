function keep(item) {
  if (!S.q) return true;
  const h = [item.title, item.category, item.subtitle, item.language].map(x => String(x || '').toLowerCase()).join(' ');
  return h.includes(S.q);
}

function card(item, type) {
  const a = document.createElement('article');
  a.className = 'card';
  a.tabIndex = 0;
  a.setAttribute('role', 'button');
  a.dataset.type = type;
  a.dataset.id = item.id;

  const media = document.createElement('div');
  media.className = 'media' + (type === 'digital' ? ' digital' : '');
  if (item.img) {
    const img = document.createElement('img');
    img.src = item.img;
    img.alt = item.title || 'Card image';
    img.loading = 'lazy';
    media.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'fallback';
    fb.textContent = item.title || 'Item';
    media.appendChild(fb);
  }

  const body = document.createElement('div');
  body.className = 'body';
  const title = document.createElement('h3');
  title.className = 'title';
  title.textContent = item.title || 'Untitled';
  const sub = document.createElement('p');
  sub.className = 'sub';
  sub.textContent = item.subtitle || item.category || item.language || 'Explore details';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const badge = document.createElement('span');
  badge.className = 'badge bdef';
  badge.textContent = type.toUpperCase();
  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = money(item.price);

  if ((type === 'course' || type === 'digital') && item.badge) {
    badge.textContent = item.badge;
  }
  if (type === 'webinar') {
    const p = past(item);
    badge.className = 'badge ' + (p ? 'bpast' : 'bup');
    badge.textContent = p ? 'Event Ended' : 'Upcoming';
    price.textContent = item.isFree ? 'Free' : money(item.price);
    sub.textContent = item.subtitle || (item.startAt ? fmtDate(item.startAt, item.tz) : 'Live session');
  }
  if (type === 'membership') {
    badge.className = 'badge ' + (item.recommended ? 'bup' : 'bdef');
    badge.textContent = item.recommended ? 'Recommended' : 'Plan';
    sub.textContent = item.period || 'Membership access';
  }

  meta.appendChild(badge);
  meta.appendChild(price);
  body.appendChild(title);
  body.appendChild(sub);
  body.appendChild(meta);
  a.appendChild(media);
  a.appendChild(body);
  return a;
}

function render() {
  const c = S.courses.filter(keep), d = S.digital.filter(keep), p = S.plans.filter(keep), wf = S.webinars.filter(keep), up = wf.filter(x => !past(x)), pa = wf.filter(past), w = S.tab === 'past' ? pa : up;
  renderGrid(D.cGrid, c, 'course', 'No courses found.');
  renderGrid(D.dGrid, d, 'digital', 'No digital products found.');
  renderGrid(D.pGrid, p, 'membership', 'No membership plans found.');
  renderGrid(D.wGrid, w, 'webinar', 'No webinars in this tab.');
}

function renderGrid(target, items, type, emptyText) {
  clearEl(target);
  if (!items.length) {
    const p = el('p', 'empty', emptyText);
    target.appendChild(p);
    return;
  }
  items.forEach(item => target.appendChild(card(item, type)));
}

function by(type, id) {
  if (type === 'course') return S.courses.find(x => x.id === id) || null;
  if (type === 'digital') return S.digital.find(x => x.id === id) || null;
  if (type === 'webinar') return S.webinars.find(x => x.id === id) || null;
  if (type === 'membership') return S.plans.find(x => x.id === id) || null;
  return null;
}
