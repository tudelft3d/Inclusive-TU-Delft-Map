document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('feedback_form');
  const suggestionEl = document.getElementById('suggestion');
  const typeEl = document.getElementById('type');
  const locationEl = document.getElementById('location');
  const emailEl = document.getElementById('email');
  const statusEl = document.getElementById('status_message');
  const errorEl = document.getElementById('error_message');

  const endpoint = 'https://webhook.site/7103eebf-d50b-4c3d-a95a-fa3f15fca084'; // needs to be change, not sure to what yet
  function setSubmitting(isSubmitting) {
    const btn = form?.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.setAttribute('aria-busy', String(isSubmitting));
    if (isSubmitting) btn.dataset.orig = btn.innerHTML;
    else if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
  }

  function showStatus(message, kind = 'success', autoHide = true) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = kind === 'success' ? 'status-success' : 'status-error';
    if (autoHide && kind === 'success') {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = '';
      }, 6000);
    }
  }

  function showError(message) {
    if (errorEl) {
      errorEl.textContent = message;
    } else {
      showStatus(message, 'error', false);
    }
  }

  function clearMessages() {
    if (statusEl) { statusEl.textContent = ''; statusEl.className = ''; }
    if (errorEl) { errorEl.textContent = ''; }
  }

  function isValidEmail(email) {
    // email is mandatory now: must be non-empty and match a simple email regex
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  async function postFeedback(payload) {
    // try sending to configured endpoint; caller handles UI
    try {
      setSubmitting(true);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `Server responded ${res.status}`);
      }
      return true;
    } catch (err) {
      // network or server error
      console.error('Feedback submit failed:', err);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // exported so onsubmit="return validate();" works
  window.validate = async function validate(event) {
    if (event instanceof Event) event.preventDefault();
    clearMessages();

    const suggestion = suggestionEl?.value?.trim() ?? '';
    const type = typeEl?.value ?? '';
    const location = locationEl?.value?.trim() ?? '';
    const email = emailEl?.value?.trim() ?? '';

    if (!suggestion) {
      showError('Please enter your suggestion.');
      suggestionEl?.focus();
      return false;
    }
    // require email
    if (!email) {
      showError('Please enter your email address.');
      emailEl?.focus();
      return false;
    }
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address.');
      emailEl?.focus();
      return false;
    }

    const payload = {
      suggestion,
      type: type || null,
      location: location || null,
      email: email || null,
      submittedAt: new Date().toISOString(),
    };

    // submit
    showStatus('Sending feedback...', 'success', false);

    const sent = await postFeedback(payload);
    if (sent) {
      showStatus('Thank you! Our team will review your feedback shortly.', 'success', true);
      form.reset();
    } else {
      showError('Failed to submit feedback. Please try again later.');
    }

    return false; // prevent default form submit
  };

  // attach event listener
  if (form) {
    form.addEventListener('submit', (e) => {
      // call the same validate function
      window.validate(e);
    });
  }
});