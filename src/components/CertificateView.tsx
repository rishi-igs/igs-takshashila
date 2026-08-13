export default function CertificateView({
  learnerName,
  designationName,
  score,
  totalQuestions,
  certificateNumber,
  issuedAt,
}: {
  learnerName: string;
  designationName: string;
  score: number;
  totalQuestions: number;
  certificateNumber: string;
  issuedAt: Date | string;
}) {
  const formattedDate = new Date(issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="certificate">
      <div className="certificate-border">
        <div className="certificate-seal" aria-hidden="true">
          ✓
        </div>
        <img src="/igs-logo.png" alt="IGS" className="certificate-logo" />
        <p className="certificate-kicker">IGS Takshashila Academy</p>
        <h1 className="certificate-title">Certificate of Completion</h1>
        <p className="certificate-lead">This certifies that</p>
        <p className="certificate-name">{learnerName}</p>
        <p className="certificate-lead">
          has successfully completed the role-based curriculum and assessment for
        </p>
        <p className="certificate-designation">{designationName}</p>

        <div className="certificate-meta">
          <div>
            <div className="certificate-meta-value">
              {score} / {totalQuestions}
            </div>
            <div className="certificate-meta-label">Assessment score</div>
          </div>
          <div>
            <div className="certificate-meta-value">{formattedDate}</div>
            <div className="certificate-meta-label">Date issued</div>
          </div>
          <div>
            <div className="certificate-meta-value">{certificateNumber}</div>
            <div className="certificate-meta-label">Certificate No.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
