function loadCart() {
  try {
    const raw = localStorage.getItem(K);
    S.cart = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(S.cart)) S.cart = [];
  } catch (e) {
    S.cart = [];
  }
}

function saveCart() {
  localStorage.setItem(K, JSON.stringify(S.cart));
  renderCart();
}

function cnt() {
  return S.cart.reduce(function(sum, item) { return sum + n(item.qty); }, 0);
}

function total() {
  return S.cart.reduce(function(sum, item) { return sum + n(item.qty) * n(item.price); }, 0);
}

function addCart(item) {
  if (!item || !item.id) return;
  const existing = S.cart.find(function(x) { return x.id === item.id && x.type === item.type; });
  if (existing) existing.qty += 1;
  else S.cart.push({ id: item.id, type: item.type, title: item.title, price: item.price, img: item.img, link: item.link, qty: 1 });
  saveCart();
  openCart();
}

function adj(id, type, delta) {
  const item = S.cart.find(function(x) { return x.id === id && x.type === type; });
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    S.cart = S.cart.filter(function(x) { return !(x.id === id && x.type === type); });
  }
  saveCart();
}

function del(id, type) {
  S.cart = S.cart.filter(function(x) { return !(x.id === id && x.type === type); });
  saveCart();
}

function renderCart() {
  if (D.cartCount) D.cartCount.textContent = String(cnt());
  D.cartItems.innerHTML = S.cart.length
    ? S.cart.map(function(i) {
      return '<div class="item">'
        + (i.img
          ? '<img class="thumb" src="' + esc(i.img) + '" alt="' + esc(i.title) + '">'
          : '<div class="thumb fallback">' + esc(i.type.toUpperCase()) + '</div>')
        + '<div><h4>' + esc(i.title) + '</h4><div class="muted">' + esc(money(i.price)) + '</div><div class="qty"><button class="q" data-a="dec" data-id="' + esc(i.id) + '" data-type="' + esc(i.type) + '" aria-label="Decrease">-</button><span class="ql">' + esc(String(i.qty)) + '</span><button class="q" data-a="inc" data-id="' + esc(i.id) + '" data-type="' + esc(i.type) + '" aria-label="Increase">+</button><button class="btn bd" data-a="rm" data-id="' + esc(i.id) + '" data-type="' + esc(i.type) + '">Remove</button></div></div></div>';
    }).join('')
    : '<p class="empty">Your cart is empty.</p>';
  D.cartTotal.textContent = money(total());
  D.cartNote.textContent = S.cart.length > 1 ? 'Pay items one by one (demo). First item link will be opened.' : '';
}

function openCart() {
  if (D.nav && D.nav.classList.contains('open')) {
    D.nav.classList.remove('open');
    D.menu.classList.remove('active');
    D.menu.setAttribute('aria-expanded', 'false');
    D.navBackdrop.classList.remove('show');
  }
  D.drawer.classList.add('on');
  D.db.classList.add('on');
  D.drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no');
}

function closeCart() {
  D.drawer.classList.remove('on');
  D.db.classList.remove('on');
  D.drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no');
}

function checkout() {
  if (!S.cart.length) {
    alert('Your cart is empty.');
    return;
  }
  const payable = S.cart.filter(function(i) { return i.link; });
  if (!payable.length) {
    alert('No payment link available for cart items.');
    return;
  }
  if (payable.length > 1) alert('Pay items one by one (demo). Opening first item link.');
  window.open(payable[0].link, '_blank', 'noopener');
}
