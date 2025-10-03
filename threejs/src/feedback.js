document.addEventListener('DOMContentLoaded', () => {
  /* --------------------------------------------------------------
   *  DOM references – keep them together for easy maintenance
   * -------------------------------------------------------------- */
  const refs = {
    form: document.getElementById('feedback_form'),
    suggestion: document.getElementById('suggestion'),
    type: document.getElementById('type'),
    location: document.getElementById('location'),
    email: document.getElementById('email'),
    statusMsg: document.getElementById('status_message'),
    errorMsg: document.getElementById('error_message')
  };

  /* --------------------------------------------------------------
   *  Configuration
   * -------------------------------------------------------------- */
  const CONFIG = {
    // Change this when you move to production (or proxy via Nginx)
    endpoint: 'https://inclusivecampusmap.bk.tudelft.nl/api/feedback',
    // Timeout for auto‑hiding success messages (ms)
    successHideDelay: 6000
  };

  /* --------------------------------------------------------------
   *  UI helpers – tiny, pure‑function style
   * -------------------------------------------------------------- */
  const ui = {
    /** Enable/disable the submit button and toggle aria‑busy */
    setSubmitting(isSubmitting) {
      const btn = refs.form?.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.disabled = isSubmitting;
      btn.setAttribute('aria-busy', String(isSubmitting));
      if (isSubmitting) btn.dataset.orig = btn.innerHTML;
      else if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    },

    /** Show a transient status (green) or persistent error (red) */
    showMessage(msg, kind = 'success', autoHide = true) {
      const el = kind === 'error' ? refs.errorMsg : refs.statusMsg;
      if (!el) return;
      el.textContent = msg;
      el.className = kind === 'success' ? 'status-success' : 'status-error';

      // Auto‑hide only success messages (optional)
      if (autoHide && kind === 'success') {
        setTimeout(() => {
          el.textContent = '';
          el.className = '';
        }, CONFIG.successHideDelay);
      }
    },

    /** Clear both status and error containers */
    clearAll() {
      [refs.statusMsg, refs.errorMsg].forEach(el => {
        if (el) {
          el.textContent = '';
          el.className = '';
        }
      });
    }
  };

  /* --------------------------------------------------------------
   *  Validation helpers
   * -------------------------------------------------------------- */
  const validators = {
    /** Very small email regex – good enough for UI validation */
    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    },

    /** Gather and validate the form fields, returning either
     *  an object { ok: true, payload } or { ok: false, message }   */
    buildPayload() {
      const suggestion = refs.suggestion?.value?.trim() ?? '';
      const type = refs.type?.value ?? '';
      const location = refs.location?.value?.trim() ?? '';
      const email = refs.email?.value?.trim() ?? '';

      if (!suggestion) {
        return { ok: false, message: 'Please enter your suggestion.', focus: refs.suggestion };
      }
      if (!email) {
        return { ok: false, message: 'Please enter your email address.', focus: refs.email };
      }
      if (!validators.isValidEmail(email)) {
        return { ok: false, message: 'Please enter a valid email address.', focus: refs.email };
      }

      const payload = {
        suggestion,
        type: type || null,
        location: location || null,
        email: email || null,
        submittedAt: new Date().toISOString()
      };
      return { ok: true, payload };
    }
  };

  /* --------------------------------------------------------------
   *  Network layer – isolated so you can swap fetch for axios, etc.
   * -------------------------------------------------------------- */
  async function postFeedback(payload) {
    try {
      ui.setSubmitting(true);
      const response = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => response.statusText);
        throw new Error(txt || `Server responded ${response.status}`);
      }
      return true;
    } catch (err) {
      console.error('[Feedback] submit error:', err);
      return false;
    } finally {
      ui.setSubmitting(false);
    }
  }

  /* --------------------------------------------------------------
   *  Main submit handler – bound once to the form element
   * -------------------------------------------------------------- */
  async function handleSubmit(event) {
    event?.preventDefault();          // stop native navigation
    ui.clearAll();

    const validation = validators.buildPayload();
    if (!validation.ok) {
      ui.showMessage(validation.message, 'error', false);
      validation.focus?.focus();
      return;
    }

    ui.showMessage('Sending feedback…', 'success', false);
    const success = await postFeedback(validation.payload);

    if (success) {
      ui.showMessage(
        'Thank you! Our team will review your feedback shortly.',
        'success',
        true
      );
      refs.form.reset();
    } else {
      ui.showMessage('Failed to submit feedback. Please try again later.', 'error', false);
    }
  }

  if (refs.form) {
    refs.form.addEventListener('submit', handleSubmit);
  }
});