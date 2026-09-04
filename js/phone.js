/**
 * phone.js
 * ─────────────────────────────────────────
 * GEDIC — Phone Number Validation Module
 * Indian 10-digit mobile numbers only.
 * ─────────────────────────────────────────
 */

const Phone = (() => {

  /**
   * Strip non-digits and normalise country code.
   */
  function clean(raw) {
    let d = (raw || "").replace(/\D/g, "");
    if (d.startsWith("91") && d.length === 12) d = d.slice(2);
    if (d.startsWith("0")  && d.length === 11) d = d.slice(1);
    return d;
  }

  /**
   * Validate a raw phone string.
   * Returns { ok, digits, msg }
   */
  function validate(raw) {
    if (!raw || !raw.trim())
      return { ok: false, digits: "", msg: "⚠️ Phone number is required." };

    const d = clean(raw);

    if (d.length < 10)
      return { ok: false, digits: d, msg: `❌ Too short — ${d.length} digit(s) entered. Need exactly 10.` };
    if (d.length > 10)
      return { ok: false, digits: d, msg: `❌ Too long — ${d.length} digit(s) entered. Need exactly 10.` };
    if (!/^[6-9]/.test(d))
      return { ok: false, digits: d, msg: "❌ Must start with 6, 7, 8 or 9 (Indian mobile number)." };

    return { ok: true, digits: d, msg: "✅ Valid number." };
  }

  /**
   * Attach live feedback to a phone input.
   * feedbackId: id of a <div> below the input.
   */
  function attach(inputId, feedbackId) {
    const inp = document.getElementById(inputId);
    const fb  = document.getElementById(feedbackId);
    if (!inp || !fb) return;

    inp.addEventListener("input", () => {
      const val = inp.value.trim();
      if (!val) { fb.style.display = "none"; inp.style.borderColor = ""; return; }

      const r = validate(val);
      fb.textContent   = r.msg;
      fb.style.display = "block";

      if (r.ok) {
        fb.className = "phone-fb phone-ok";
        inp.style.borderColor = "#059669";
      } else {
        fb.className = "phone-fb phone-err";
        inp.style.borderColor = "#dc2626";
      }
    });
  }

  /**
   * Format 10-digit number as +91 XXXXX XXXXX
   */
  function format(digits) {
    if (!digits || digits.length !== 10) return digits || "—";
    return `+91 ${digits.slice(0,5)} ${digits.slice(5)}`;
  }

  /**
   * Validate and show toast if invalid.
   * Returns clean 10-digit string or null.
   */
  function requireValid(raw, label) {
    if (!raw || !raw.trim()) return null; // optional field
    const r = validate(raw);
    if (!r.ok) { UI.toast(`${label}: ${r.msg}`, "err"); return null; }
    return r.digits;
  }

  return { validate, clean, attach, format, requireValid };
})();
