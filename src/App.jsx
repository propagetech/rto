import { useEffect, useMemo, useRef, useState } from "react";
import {
  AMOUNT_OPTIONS,
  buildPdfFileName,
  buildShareMessage,
  formatRegNumber,
  getUiLabels,
  INITIAL_FORM,
  REG_NUMBER_PLACEHOLDER,
  RELATION_OPTIONS,
  REQUIRED_FIELDS,
  UPPERCASE_FIELDS,
  VEHICLE_CLASS_OPTIONS,
  WHATSAPP_TARGET
} from "./labels.js";
import { generatePdfFromElement } from "./pdf/generatePdf.js";
import PdfTemplate from "./pdf/PdfTemplate.jsx";
import "./pdf/pdf-template.css";

function todayISODate() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isComplete(form) {
  return REQUIRED_FIELDS.every((key) => String(form[key] || "").trim().length > 0);
}

export default function App() {
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, date: todayISODate() }));
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("ui-lang") === "en" ? "en" : "kn";
    } catch {
      return "kn";
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("ui-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // ignore
    }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });
  const [fontScale, setFontScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem("ui-font-scale"));
      if (saved === 0.9 || saved === 1 || saved === 1.15) return saved;
    } catch {
      // ignore
    }
    return 1;
  });
  const ui = useMemo(() => getUiLabels(lang), [lang]);
  const [status, setStatus] = useState(ui.statusReady);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastBlobRef = useRef(null);
  const sigTouchedRef = useRef(false);
  const templateRef = useRef(null);

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "en" ? "kn" : "en";
      try {
        localStorage.setItem("ui-lang", next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("ui-theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "kn";
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  const changeFontScale = (next) => {
    setFontScale(next);
    try {
      localStorage.setItem("ui-font-scale", String(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const update = (key) => (e) => {
    let value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (typeof value === "string" && UPPERCASE_FIELDS.has(key)) {
      value = value.toUpperCase();
    }
    lastBlobRef.current = null;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "applicantName" && !sigTouchedRef.current) {
        next.signatureName = value;
      }
      return next;
    });
  };

  const handleSignatureChange = (e) => {
    sigTouchedRef.current = true;
    lastBlobRef.current = null;
    setForm((prev) => ({ ...prev, signatureName: e.target.value.toUpperCase() }));
  };

  const handleRegNumberChange = (e) => {
    const formatted = formatRegNumber(e.target.value);
    lastBlobRef.current = null;
    setForm((prev) => ({ ...prev, requestedRegNumber: formatted }));
  };

  const handleRegNumberFocus = () => {
    if (!form.requestedRegNumber) {
      setForm((prev) => ({ ...prev, requestedRegNumber: "KA-" }));
    }
  };

  const handleRegNumberBlur = () => {
    if (form.requestedRegNumber === "KA-" || form.requestedRegNumber === "KA") {
      setForm((prev) => ({ ...prev, requestedRegNumber: "" }));
    }
  };

  const canGenerate = useMemo(() => isComplete(form), [form]);

  const ensureBlob = async () => {
    if (lastBlobRef.current) return lastBlobRef.current;
    if (!isComplete(form)) {
      setStatus(ui.statusMissing);
      return null;
    }
    setBusy(true);
    setStatus(ui.statusGenerating);
    try {
      const blob = await generatePdfFromElement(templateRef.current);
      lastBlobRef.current = blob;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setStatus(ui.statusGenerated);
      return blob;
    } catch (err) {
      setStatus(String(err?.message || err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!isComplete(form)) {
      setStatus(ui.statusMissing);
      return;
    }
    lastBlobRef.current = null;
    await ensureBlob();
  };

  const downloadBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildPdfFileName(form);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    const blob = await ensureBlob();
    if (!blob) return;
    downloadBlob(blob);
  };

  const handleShareWhatsapp = async () => {
    const blob = await ensureBlob();
    if (!blob) return;

    const file = new File([blob], buildPdfFileName(form), { type: "application/pdf" });
    const message = buildShareMessage(form);
    const shareData = { files: [file], title: ui.shareTitle, text: message };

    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare(shareData)) {
      try {
        setStatus(ui.statusSharing);
        await navigator.share(shareData);
        setStatus(ui.statusGenerated);
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          setStatus(ui.statusGenerated);
          return;
        }
        // fall through to fallback
      }
    }

    downloadBlob(blob);
    const waUrl = `https://wa.me/${WHATSAPP_TARGET}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setStatus(ui.statusShareFallback);
  };

  return (
    <div className="page">
      <header className="header">
        <div className="header__controls" role="toolbar" aria-label="Display settings">
          <div className="font-toggle" role="group" aria-label="Text size">
            <button
              type="button"
              className="font-toggle__btn"
              onClick={() => changeFontScale(0.9)}
              aria-label="Decrease text size"
              aria-pressed={fontScale === 0.9}
            >
              A−
            </button>
            <button
              type="button"
              className="font-toggle__btn font-toggle__btn--mid"
              onClick={() => changeFontScale(1)}
              aria-label="Default text size"
              aria-pressed={fontScale === 1}
            >
              A
            </button>
            <button
              type="button"
              className="font-toggle__btn font-toggle__btn--big"
              onClick={() => changeFontScale(1.15)}
              aria-label="Increase text size"
              aria-pressed={fontScale === 1.15}
            >
              A+
            </button>
          </div>
          <button
            type="button"
            className="pill-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? ui.themeToggleAriaLight : ui.themeToggleAriaDark}
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? ui.themeToLight : ui.themeToDark}
          </button>
          <button
            type="button"
            className="pill-toggle"
            onClick={toggleLang}
            aria-label={ui.langToggleAria}
            aria-pressed={lang === "en"}
          >
            {ui.langToggle}
          </button>
        </div>
        <h1 className="scan-title">
          <span className="scan-title__line">{ui.headingLine1}</span>
          <span className="scan-title__line">{ui.headingLine2}</span>
        </h1>
      </header>

      <main className="content">
        <section className="card" aria-labelledby="addressed-label">
          <address className="addressed">
            <div className="addressed__label" id="addressed-label">{ui.addressedToLabel}</div>
            <div className="addressed__value">
              {ui.addressedToValue.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </address>
        </section>

        <section className="card intro" aria-label={ui.introSalutation}>
          <p className="intro__salutation">{ui.introSalutation}</p>
          <p className="intro__body">{ui.introBody}</p>
        </section>

        <form
          className="form"
          noValidate
          aria-label={`${ui.headingLine1} ${ui.headingLine2}`}
          aria-busy={busy}
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <section className="card" aria-labelledby="applicant-section-title">
            <h2 className="section-title" id="applicant-section-title">{ui.applicantSectionTitle}</h2>

            <div className="grid">
              <div className="field">
                <label htmlFor="applicantName">
                  {ui.applicantName} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="applicantName"
                  type="text"
                  autoComplete="name"
                  value={form.applicantName}
                  onChange={update("applicantName")}
                  required
                  aria-required="true"
                />
              </div>
              <div className="field field--split">
                <div>
                  <label htmlFor="relationType">{ui.relationType}</label>
                  <select id="relationType" value={form.relationType} onChange={update("relationType")}>
                    {RELATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="relationName">{ui.relationName}</label>
                  <input id="relationName" type="text" value={form.relationName} onChange={update("relationName")} />
                </div>
              </div>

              <div className="field field--full" role="group" aria-labelledby="address-label">
                <span className="field__legend" id="address-label">
                  {ui.address} <span className="req" aria-hidden="true">*</span>
                </span>
                <div className="stack">
                  <input
                    type="text"
                    placeholder={ui.addressLine1Placeholder}
                    aria-label={ui.addressLine1Placeholder}
                    autoComplete="address-line1"
                    value={form.addressLine1}
                    onChange={update("addressLine1")}
                    required
                    aria-required="true"
                  />
                  <input
                    type="text"
                    placeholder={ui.addressLine2Placeholder}
                    aria-label={ui.addressLine2Placeholder}
                    autoComplete="address-line2"
                    value={form.addressLine2}
                    onChange={update("addressLine2")}
                  />
                  <input
                    type="text"
                    placeholder={ui.addressLine3Placeholder}
                    aria-label={ui.addressLine3Placeholder}
                    autoComplete="address-line3"
                    value={form.addressLine3}
                    onChange={update("addressLine3")}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="phone">
                  {ui.phone} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  required
                  aria-required="true"
                />
              </div>

              <div className="field">
                <label htmlFor="email">{ui.email}</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update("email")}
                />
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="request-section-title">
            <h2 className="section-title" id="request-section-title">{ui.requestSectionTitle}</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="requestedRegNumber">
                  {ui.requestedRegNumber} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="requestedRegNumber"
                  type="text"
                  placeholder={REG_NUMBER_PLACEHOLDER}
                  value={form.requestedRegNumber}
                  onChange={handleRegNumberChange}
                  onFocus={handleRegNumberFocus}
                  onBlur={handleRegNumberBlur}
                  required
                  aria-required="true"
                  aria-describedby="requestedRegNumber-hint"
                />
                <span id="requestedRegNumber-hint" className="sr-only">
                  Format: KA followed by two digits, two letters, four digits. Example: KA 51 AA 1111.
                </span>
              </div>

              <div className="field">
                <label htmlFor="rtoOfficeName">
                  {ui.rtoOfficeName} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="rtoOfficeName"
                  type="text"
                  value={form.rtoOfficeName}
                  onChange={update("rtoOfficeName")}
                  required
                  aria-required="true"
                />
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="documents-title">
            <h2 className="section-title" id="documents-title">{ui.documentsTitle}</h2>
            <div className="checks" role="group" aria-labelledby="documents-title">
              <label className="check">
                <input type="checkbox" checked={form.docForm21} onChange={update("docForm21")} />
                <span>{ui.docForm21}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.docForm23} onChange={update("docForm23")} />
                <span>{ui.docForm23}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.docRcOther} onChange={update("docRcOther")} />
                <span>{ui.docRcOther}</span>
              </label>
            </div>
          </section>

          <section className="card" aria-labelledby="payment-title">
            <h2 className="section-title" id="payment-title">{ui.paymentTitle}</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="vehicleNumber">{ui.vehicleNumber}</label>
                <input id="vehicleNumber" type="text" value={form.vehicleNumber} onChange={update("vehicleNumber")} />
              </div>
              <div className="field">
                <label htmlFor="vehicleClass">{ui.vehicleClass}</label>
                <select id="vehicleClass" value={form.vehicleClass} onChange={update("vehicleClass")}>
                  {VEHICLE_CLASS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.vehicleClass === "OTH" ? (
                <div className="field">
                  <label htmlFor="vehicleClassOther">{ui.vehicleClassOther}</label>
                  <input
                    id="vehicleClassOther"
                    type="text"
                    placeholder={ui.vehicleClassOtherPlaceholder}
                    value={form.vehicleClassOther}
                    onChange={update("vehicleClassOther")}
                    autoFocus
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="amount">{ui.amount}</label>
                <select id="amount" value={form.amount} onChange={update("amount")}>
                  {AMOUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ddNumber">{ui.ddNumber}</label>
                <input id="ddNumber" type="text" value={form.ddNumber} onChange={update("ddNumber")} />
              </div>
              <div className="field">
                <label htmlFor="bankName">{ui.bankName}</label>
                <input id="bankName" type="text" value={form.bankName} onChange={update("bankName")} />
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="declaration-title">
            <h2 className="section-title" id="declaration-title">{ui.declarationTitle}</h2>
            <p className="declaration">{ui.declarationText}</p>

            <div className="grid">
              <div className="field">
                <label htmlFor="place">
                  {ui.place} <span className="req" aria-hidden="true">*</span>
                </label>
                <input id="place" type="text" value={form.place} onChange={update("place")} required aria-required="true" />
              </div>

              <div className="field">
                <label htmlFor="date">
                  {ui.date} <span className="req" aria-hidden="true">*</span>
                </label>
                <input id="date" type="date" value={form.date} onChange={update("date")} required aria-required="true" />
              </div>

              <div className="field">
                <label htmlFor="signatureName">
                  {ui.signatureName} <span className="req" aria-hidden="true">*</span>
                </label>
                <input
                  id="signatureName"
                  type="text"
                  value={form.signatureName}
                  onChange={handleSignatureChange}
                  required
                  aria-required="true"
                />
              </div>
            </div>
          </section>

          <section className="card actions" aria-label="Form actions">
            <div className="actions__row" role="group" aria-label="Form actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || !canGenerate}
                title={canGenerate ? "" : ui.statusMissing}
              >
                {ui.generatePdf}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDownload}
                disabled={busy || (!lastBlobRef.current && !canGenerate)}
              >
                {ui.downloadPdf}
              </button>
              <button
                type="button"
                className="btn btn--whatsapp"
                onClick={handleShareWhatsapp}
                disabled={busy || (!lastBlobRef.current && !canGenerate)}
              >
                {ui.sendWhatsapp}
              </button>
            </div>
            <div className="status" role="status" aria-live="polite">
              {status}
            </div>
          </section>
        </form>

        {pdfUrl ? (
          <section className="card preview">
            <h2 className="section-title">{ui.previewTitle}</h2>
            <iframe className="preview__frame" title="PDF Preview" src={pdfUrl} />
          </section>
        ) : null}
      </main>

      <div className="pdf-offscreen" aria-hidden="true">
        <PdfTemplate ref={templateRef} form={form} />
      </div>
    </div>
  );
}
