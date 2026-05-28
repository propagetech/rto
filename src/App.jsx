import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildShareMessage,
  INITIAL_FORM,
  LABELS,
  RELATION_OPTIONS,
  REQUIRED_FIELDS,
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
  const [status, setStatus] = useState(LABELS.statusReady);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastBlobRef = useRef(null);
  const sigTouchedRef = useRef(false);
  const templateRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const update = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
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
    setForm((prev) => ({ ...prev, signatureName: e.target.value }));
  };

  const canGenerate = useMemo(() => isComplete(form), [form]);

  const ensureBlob = async () => {
    if (lastBlobRef.current) return lastBlobRef.current;
    if (!isComplete(form)) {
      setStatus(LABELS.statusMissing);
      return null;
    }
    setBusy(true);
    setStatus(LABELS.statusGenerating);
    try {
      const blob = await generatePdfFromElement(templateRef.current);
      lastBlobRef.current = blob;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
      setStatus(LABELS.statusGenerated);
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
      setStatus(LABELS.statusMissing);
      return;
    }
    lastBlobRef.current = null;
    await ensureBlob();
  };

  const downloadBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = LABELS.pdfFileName;
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

    const file = new File([blob], LABELS.pdfFileName, { type: "application/pdf" });
    const message = buildShareMessage(form);
    const shareData = { files: [file], title: LABELS.shareTitle, text: message };

    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare(shareData)) {
      try {
        setStatus(LABELS.statusSharing);
        await navigator.share(shareData);
        setStatus(LABELS.statusGenerated);
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          setStatus(LABELS.statusGenerated);
          return;
        }
        // fall through to fallback
      }
    }

    downloadBlob(blob);
    const waUrl = `https://wa.me/${WHATSAPP_TARGET}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setStatus(LABELS.statusShareFallback);
  };

  return (
    <div className="page">
      <header className="header">
        <h1 className="scan-title">
          <span className="scan-title__line">{LABELS.headingLine1}</span>
          <span className="scan-title__line">{LABELS.headingLine2}</span>
        </h1>
      </header>

      <main className="content">
        <section className="card">
          <div className="addressed">
            <div className="addressed__label">{LABELS.addressedToLabel}</div>
            <div className="addressed__value">
              {LABELS.addressedToValue.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="card intro">
          <p className="intro__salutation">{LABELS.introSalutation}</p>
          <p className="intro__body">{LABELS.introBody}</p>
        </section>

        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <section className="card">
            <h2 className="section-title">{LABELS.applicantSectionTitle}</h2>

            <div className="grid">
              <div className="field">
                <label htmlFor="applicantName">
                  {LABELS.applicantName} <span className="req">*</span>
                </label>
                <input
                  id="applicantName"
                  type="text"
                  autoComplete="name"
                  value={form.applicantName}
                  onChange={update("applicantName")}
                  required
                />
              </div>
              <div className="field field--split">
                <div>
                  <label htmlFor="relationType">{LABELS.relationType}</label>
                  <select id="relationType" value={form.relationType} onChange={update("relationType")}>
                    {RELATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="relationName">{LABELS.relationName}</label>
                  <input id="relationName" type="text" value={form.relationName} onChange={update("relationName")} />
                </div>
              </div>

              <div className="field field--full">
                <label>
                  {LABELS.address} <span className="req">*</span>
                </label>
                <div className="stack">
                  <input
                    type="text"
                    placeholder={LABELS.addressLine1Placeholder}
                    value={form.addressLine1}
                    onChange={update("addressLine1")}
                    required
                  />
                  <input
                    type="text"
                    placeholder={LABELS.addressLine2Placeholder}
                    value={form.addressLine2}
                    onChange={update("addressLine2")}
                  />
                  <input
                    type="text"
                    placeholder={LABELS.addressLine3Placeholder}
                    value={form.addressLine3}
                    onChange={update("addressLine3")}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="phone">
                  {LABELS.phone} <span className="req">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="email">{LABELS.email}</label>
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

          <section className="card">
            <h2 className="section-title">{LABELS.requestSectionTitle}</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="requestedRegNumber">
                  {LABELS.requestedRegNumber} <span className="req">*</span>
                </label>
                <input
                  id="requestedRegNumber"
                  type="text"
                  value={form.requestedRegNumber}
                  onChange={update("requestedRegNumber")}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="rtoOfficeName">
                  {LABELS.rtoOfficeName} <span className="req">*</span>
                </label>
                <input
                  id="rtoOfficeName"
                  type="text"
                  value={form.rtoOfficeName}
                  onChange={update("rtoOfficeName")}
                  required
                />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">{LABELS.documentsTitle}</h2>
            <div className="checks">
              <label className="check">
                <input type="checkbox" checked={form.docForm21} onChange={update("docForm21")} />
                <span>{LABELS.docForm21}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.docForm23} onChange={update("docForm23")} />
                <span>{LABELS.docForm23}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.docRcOther} onChange={update("docRcOther")} />
                <span>{LABELS.docRcOther}</span>
              </label>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">{LABELS.paymentTitle}</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="vehicleNumber">{LABELS.vehicleNumber}</label>
                <input id="vehicleNumber" type="text" value={form.vehicleNumber} onChange={update("vehicleNumber")} />
              </div>
              <div className="field">
                <label htmlFor="vehicleClass">{LABELS.vehicleClass}</label>
                <input id="vehicleClass" type="text" value={form.vehicleClass} onChange={update("vehicleClass")} />
              </div>
              <div className="field">
                <label htmlFor="amount">{LABELS.amount}</label>
                <input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={update("amount")}
                />
              </div>
              <div className="field">
                <label htmlFor="ddNumber">{LABELS.ddNumber}</label>
                <input id="ddNumber" type="text" value={form.ddNumber} onChange={update("ddNumber")} />
              </div>
              <div className="field">
                <label htmlFor="bankName">{LABELS.bankName}</label>
                <input id="bankName" type="text" value={form.bankName} onChange={update("bankName")} />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">{LABELS.declarationTitle}</h2>
            <p className="declaration">{LABELS.declarationText}</p>

            <div className="grid">
              <div className="field">
                <label htmlFor="place">
                  {LABELS.place} <span className="req">*</span>
                </label>
                <input id="place" type="text" value={form.place} onChange={update("place")} required />
              </div>

              <div className="field">
                <label htmlFor="date">
                  {LABELS.date} <span className="req">*</span>
                </label>
                <input id="date" type="date" value={form.date} onChange={update("date")} required />
              </div>

              <div className="field">
                <label htmlFor="signatureName">
                  {LABELS.signatureName} <span className="req">*</span>
                </label>
                <input
                  id="signatureName"
                  type="text"
                  value={form.signatureName}
                  onChange={handleSignatureChange}
                  required
                />
              </div>
            </div>
          </section>

          <section className="card actions">
            <div className="actions__row">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || !canGenerate}
                title={canGenerate ? "" : LABELS.statusMissing}
              >
                {LABELS.generatePdf}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDownload}
                disabled={busy || (!lastBlobRef.current && !canGenerate)}
              >
                {LABELS.downloadPdf}
              </button>
              <button
                type="button"
                className="btn btn--whatsapp"
                onClick={handleShareWhatsapp}
                disabled={busy || (!lastBlobRef.current && !canGenerate)}
              >
                {LABELS.sendWhatsapp}
              </button>
            </div>
            <div className="status" role="status" aria-live="polite">
              {status}
            </div>
          </section>
        </form>

        {pdfUrl ? (
          <section className="card preview">
            <h2 className="section-title">{LABELS.previewTitle}</h2>
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
