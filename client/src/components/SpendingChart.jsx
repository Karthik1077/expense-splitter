function formatMoney(amount) {
  const n = Number(amount);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function SpendingChart({ breakdown }) {
  if (!breakdown || breakdown.length === 0) return null;

  const max = Math.max(...breakdown.map((b) => b.total));

  return (
    <div className="chart-wrap">
      <div className="section-title">Spending by category</div>
      {breakdown.map((b) => (
        <div className="chart-bar-row" key={b.category}>
          <span className="chart-bar-label">{b.category}</span>
          <div className="chart-bar-track">
            <div
              className="chart-bar-fill"
              style={{ width: `${max > 0 ? (b.total / max) * 100 : 0}%` }}
            />
          </div>
          <span className="chart-bar-amount amount">{formatMoney(b.total)}</span>
        </div>
      ))}
    </div>
  );
}
