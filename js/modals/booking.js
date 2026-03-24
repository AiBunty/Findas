function renderBookingModal(data) {
  clearEl(D.mContent);
  D.mTitle.textContent = 'Book a Call';

  const card = el('div', 'booking-card');

  const embed = el('div', 'booking-embed');
  const iframe = document.createElement('iframe');
  iframe.src = 'https://admin.aibunty.com/u2/76687/-free-seminar-to-mint?isEmbeded=1';
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '600px';
  iframe.title = 'Book a Call';
  iframe.loading = 'lazy';
  embed.appendChild(iframe);
  card.appendChild(embed);

  const actions = el('div', 'booking-actions');
  const closeBtn = el('button', 'btn b2', 'Close');
  closeBtn.addEventListener('click', closeModal);
  actions.appendChild(closeBtn);
  card.appendChild(actions);

  D.mContent.appendChild(card);
}

function renderBookingForm(container, source, triggerBtn) {
  clearEl(container);
  const form = el('form', 'booking-form');

  const nameField = bookingField('Name', 'text');
  const emailField = bookingField('Email', 'email');
  const phoneField = bookingField('Phone', 'tel');
  const notesField = bookingField('Notes (optional)', 'textarea');

  form.appendChild(nameField.wrap);
  form.appendChild(emailField.wrap);
  form.appendChild(phoneField.wrap);
  form.appendChild(notesField.wrap);

  const errorBox = el('div', 'section-body');
  const submitBtn = el('button', 'btn b1', 'Confirm Booking');
  submitBtn.type = 'submit';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    submitBookingConfirmation({
      name: nameField.input.value,
      email: emailField.input.value,
      phone: phoneField.input.value,
      notes: notesField.input.value,
      source: source
    }, submitBtn, errorBox);
  });

  form.appendChild(submitBtn);
  form.appendChild(errorBox);
  container.appendChild(form);

  if (triggerBtn) {
    triggerBtn.disabled = true;
  }
}

function bookingField(label, type) {
  const wrap = el('div', 'booking-field');
  const lbl = el('label', '', label);
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 3;
  } else {
    input = document.createElement('input');
    input.type = type;
  }
  if (type !== 'textarea') input.required = label.indexOf('optional') === -1;
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return { wrap, input };
}

function setBookingSubmitLoading(btn, isLoading) {
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.prev = btn.textContent;
    btn.textContent = '';
    btn.appendChild(el('span', 'spinner'));
  } else {
    const prev = btn.dataset.prev || 'Confirm Booking';
    clearEl(btn);
    btn.textContent = prev;
  }
}

async function submitBookingConfirmation(payload, btn, errorBox) {
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || '').trim();
  if (!name || !email || !phone) {
    errorBox.textContent = 'Please fill out name, email, and phone.';
    return;
  }
  setBookingSubmitLoading(btn, true);
  try {
    await run('saveBookingConfirmation', payload);
    renderBookingSuccess();
  } catch (e) {
    errorBox.textContent = 'Unable to confirm booking. Please try again.';
  } finally {
    setBookingSubmitLoading(btn, false);
  }
}

function renderBookingSuccess() {
  clearEl(D.mContent);
  const wrap = el('div', 'booking-success');
  wrap.appendChild(el('div', 'success-icon', 'OK'));
  wrap.appendChild(el('h3', '', 'Booked Successfully!'));
  wrap.appendChild(el('p', 'section-body', 'We have received your booking confirmation. Our team will contact you shortly.'));
  const closeBtn = el('button', 'btn b1', 'Close');
  closeBtn.addEventListener('click', closeModal);
  wrap.appendChild(closeBtn);
  D.mContent.appendChild(wrap);
}

async function openBookingModal() {
  setBookingModalLoading();
  openModal();
  try {
    // Check if booking page was preloaded
    if (DETAILS_CACHE['booking_page']) {
      renderBookingModal(DETAILS_CACHE['booking_page']);
      return;
    }
    const data = await run('getBookingPage');
    if (data) {
      DETAILS_CACHE['booking_page'] = data;
    }
    renderBookingModal(data || {});
  } catch (e) {
    clearEl(D.mContent);
    D.mTitle.textContent = 'Book a Call';
    D.mContent.appendChild(el('p', 'section-body', 'Booking unavailable.'));
  }
}
