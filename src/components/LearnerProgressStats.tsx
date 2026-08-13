export default function LearnerProgressStats({
  pct,
  done,
  total,
  inProgress,
  doneHours,
  totalHours,
}: {
  pct: number;
  done: number;
  total: number;
  inProgress: number;
  doneHours: number;
  totalHours: number;
}) {
  return (
    <>
      <div className="stats-row">
        <div className="stat">
          <div className="value">{pct}%</div>
          <div className="label">Modules complete</div>
        </div>
        <div className="stat">
          <div className="value">
            {done} / {total}
          </div>
          <div className="label">Done / total modules</div>
        </div>
        <div className="stat">
          <div className="value">{inProgress}</div>
          <div className="label">In progress</div>
        </div>
        <div className="stat">
          <div className="value">
            {doneHours} / {totalHours}
          </div>
          <div className="label">Hours completed</div>
        </div>
      </div>
      <div className="progress-bar" style={{ marginBottom: "1.5rem" }}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}
