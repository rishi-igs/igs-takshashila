"use client";

export default function PrintCertificateButton() {
  return (
    <button className="no-print" onClick={() => window.print()}>
      Download / print certificate
    </button>
  );
}
