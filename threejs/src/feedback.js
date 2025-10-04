document.addEventListener('DOMContentLoaded', () => {
  // DOM elements used by the script
  const refs = {
    form: document.getElementById('feedback_form'),
    suggestion: document.getElementById('suggestion'),
    type: document.getElementById('type'),
    location: document.getElementById('location'),
    email: document.getElementById('email'),
    statusMsg: document.getElementById('status_message'),
    errorMsg: document.getElementById('error_message')
  };

  // Configuration values - need to adjust the endpoint!!!!!
  const CONFIG = {
    endpoint: 'http://127.0.0.1:5173/feedback.html',
    successHideDelay: 6000
  };

  // UI helper methods for button state and messaging
  const ui = {
    setSubmitting(isSubmitting) {
      const btn = refs.form?.querySelector('button[type="submit"]');
      if (!btn) return;
      // disable button and mark busy for assistive tech
      btn.disabled = isSubmitting;
      btn.setAttribute('aria-busy', String(isSubmitting));
      if (isSubmitting) btn.dataset.orig = btn.innerHTML;
      else if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    },

    showMessage(msg, kind = 'success', autoHide = true) {
      const btn = refs.form?.querySelector('button[type="submit"]');
      let el = null;

      // prefer an inline status element inserted next to the button
      if (btn) {
        el = document.getElementById('status_message_inline') || null;
        if (!el) {
          el = document.createElement('div');
          el.id = 'status_message_inline';
          el.style.marginTop = '12px';
          btn.insertAdjacentElement('afterend', el);
        }
        refs._inlineStatus = el;
      }

      // fallback to global status or error containers
      if (!el) el = kind === 'error' ? refs.errorMsg : refs.statusMsg;
      if (!el) return;
      el.textContent = msg;
      el.className = kind === 'success' ? 'status-success' : 'status-error';

      // auto-hide success messages after configured delay
      if (autoHide && kind === 'success') {
        setTimeout(() => {
          el.textContent = '';
          el.className = '';
        }, CONFIG.successHideDelay);
      }
    },

    // clear all visible messages
    clearAll() {
      [refs.statusMsg, refs.errorMsg, refs._inlineStatus].forEach(el => {
        if (el) {
          el.textContent = '';
          el.className = '';
        }
      });
    }
  };

  // Validation helpers and payload builder
  const validators = {
    // basic email validation (not exhaustive)
    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    },

    // collect values, validate required fields and return payload
    buildPayload() {
      const suggestion = refs.suggestion?.value?.trim() ?? '';
      const type = refs.type?.value ?? '';
      const location = refs.location?.value?.trim() ?? '';
      const email = refs.email?.value?.trim() ?? '';

      if (!suggestion) {
        return { ok: false, message: 'Please enter your suggestion.', focus: refs.suggestion };
      }
      if (!location) {
        return { ok: false, message: 'Please enter the location.', focus: refs.location };
      }
      if (!email) {
        return { ok: false, message: 'Please enter your email address.', focus: refs.email };
      }
      if (!validators.isValidEmail(email)) {
        return { ok: false, message: 'Please enter a valid email address.', focus: refs.email };
      }

      return {
        ok: true,
        payload: {
          message: suggestion,
          type: type || null,
          location: location || null,
          email: email || null,
          submittedAt: new Date().toISOString()
        }
      };
    }
  };

  // send feedback to configured endpoint
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

  // form submit handler: validate, post and show result
  async function handleSubmit(event) {
    event?.preventDefault();
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
      ui.showMessage('Thank you! Our team will review your feedback shortly.', 'success', true);
      refs.form.reset();
    } else {
      ui.showMessage('Failed to submit feedback. Please try again later.', 'error', false);
    }
  }

  // attach submit listener if form exists
  if (refs.form) refs.form.addEventListener('submit', handleSubmit);
});