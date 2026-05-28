import { forwardRef } from "react";
import { LABELS, placeForPdf, regNumberForPdf } from "../labels.js";

function valueOrBlank(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : " ";
}

const PdfTemplate = forwardRef(function PdfTemplate({ form }, ref) {
  const vehicleClassDisplay =
    form.vehicleClass === "OTH" && form.vehicleClassOther
      ? form.vehicleClassOther
      : form.vehicleClass;

  const requestedRegNumberDisplay = regNumberForPdf(form.requestedRegNumber);

  return (
    <div ref={ref} className="pdf-doc">
      <div className="pdf-title">
        <div className="pdf-title__line">{LABELS.headingLine1}</div>
        <div className="pdf-title__line">{LABELS.headingLine2}</div>
      </div>

      <div className="pdf-addr">
        {LABELS.addressedToValue.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div className="pdf-sep" />

      <div className="pdf-intro">
        <div className="pdf-intro__sal">{LABELS.introSalutation}</div>
        <div className="pdf-intro__body">{LABELS.introBody}</div>
      </div>

      <div className="pdf-fields">
        <FieldRow no="1" label={LABELS.applicantName} value={form.applicantName} />
        <RelationRow selected={form.relationType} name={form.relationName} />

        <FieldRow no="2" label={LABELS.address} value={valueOrBlank(form.addressLine1)} />
        <FieldRow value={valueOrBlank(form.addressLine2)} indent blank />
        <FieldRow value={valueOrBlank(form.addressLine3)} indent blank />

        <FieldRow no="3" label={LABELS.phone} value={form.phone} />
        <FieldRow no="4" label={LABELS.email} value={form.email} />
        <FieldRow no="5" label={LABELS.requestedRegNumber} value={requestedRegNumberDisplay} bigValue />
        <FieldRow no="6" label={LABELS.rtoOfficeName} value={form.rtoOfficeName} />

        <div className="pdf-doc-row">
          <div className="pdf-doc-row__no">7.</div>
          <div className="pdf-doc-row__body">
            <div className="pdf-doc-row__title">{LABELS.documentsTitle}</div>
            <div className="pdf-check">
              <span className="pdf-check__box">{form.docForm21 ? "☒" : "☐"}</span>
              <span>{LABELS.docForm21}</span>
            </div>
            <div className="pdf-check">
              <span className="pdf-check__box">{form.docForm23 ? "☒" : "☐"}</span>
              <span>{LABELS.docForm23}</span>
            </div>
            <div className="pdf-check">
              <span className="pdf-check__box">{form.docRcOther ? "☒" : "☐"}</span>
              <span>{LABELS.docRcOther}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pdf-payment">
        <div className="pdf-payment__title">{LABELS.paymentTitle}</div>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>{LABELS.vehicleNumber}</th>
              <th>{LABELS.vehicleClass}</th>
              <th>{LABELS.amount}</th>
              <th>{LABELS.ddNumber}</th>
              <th>{LABELS.bankName}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{valueOrBlank(form.vehicleNumber)}</td>
              <td>{valueOrBlank(vehicleClassDisplay)}</td>
              <td>{valueOrBlank(form.amount)}</td>
              <td>{valueOrBlank(form.ddNumber)}</td>
              <td>{valueOrBlank(form.bankName)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pdf-declaration">
        <div className="pdf-declaration__title">{LABELS.declarationTitle}</div>
        <div className="pdf-declaration__body">{LABELS.declarationText}</div>
      </div>

      <div className="pdf-footer">
        <div className="pdf-footer__row">
          <span className="pdf-footer__label">{LABELS.place} :</span>
          <span className="pdf-footer__value">{placeForPdf(form.place)}</span>
        </div>
        <div className="pdf-footer__row">
          <span className="pdf-footer__label">{LABELS.date} :</span>
          <span className="pdf-footer__value">{form.date}</span>
        </div>
        <div className="pdf-footer__sig">
          <div className="pdf-footer__sigName" />
          <div className="pdf-footer__sigCap">{LABELS.signatureCaption}</div>
        </div>
      </div>
    </div>
  );
});

function RelationRow({ selected, name }) {
  const opts = ["S/o", "W/o", "D/o"];
  return (
    <div className="pdf-field-row pdf-field-row--indent">
      <div className="pdf-field-row__no" />
      <div className="pdf-field-row__label pdf-relation">
        {opts.map((opt, i) => (
          <span key={opt}>
            <span className={selected && opt === selected ? "pdf-relation__picked" : selected ? "pdf-relation__struck" : ""}>
              {opt}
            </span>
            {i < opts.length - 1 ? <span className="pdf-relation__sep"> / </span> : null}
          </span>
        ))}
      </div>
      <div className="pdf-field-row__colon">:</div>
      <div className="pdf-field-row__value">
        <span className="pdf-field-row__valueText">{valueOrBlank(name)}</span>
      </div>
    </div>
  );
}

function FieldRow({ no, label, value, indent, blank, bigValue }) {
  return (
    <div className={`pdf-field-row ${indent ? "pdf-field-row--indent" : ""}`}>
      <div className="pdf-field-row__no">{no || ""}</div>
      <div className="pdf-field-row__label">{blank ? "" : label}</div>
      <div className="pdf-field-row__colon">{blank ? "" : ":"}</div>
      <div className="pdf-field-row__value">
        <span className={`pdf-field-row__valueText ${bigValue ? "pdf-field-row__valueText--big" : ""}`}>
          {valueOrBlank(value)}
        </span>
      </div>
    </div>
  );
}

export default PdfTemplate;
