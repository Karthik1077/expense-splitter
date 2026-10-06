export function SkeletonLine({ width = "100%", height = "1rem" }) {
  return <div className="skeleton-line" style={{ width, height }} />;
}

export function SkeletonGroupList() {
  return (
    <div className="group-list">
      {[1, 2, 3].map((i) => (
        <div className="group-row skeleton-row" key={i}>
          <SkeletonLine width="40%" height="1.1rem" />
          <SkeletonLine width="20%" height="0.85rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonExpenseList() {
  return (
    <div>
      {[1, 2, 3].map((i) => (
        <div className="expense-row" key={i}>
          <div style={{ flex: 1 }}>
            <SkeletonLine width="50%" height="1rem" />
            <div style={{ marginTop: "0.4rem" }}>
              <SkeletonLine width="30%" height="0.8rem" />
            </div>
          </div>
          <SkeletonLine width="70px" height="1.1rem" />
        </div>
      ))}
    </div>
  );
}
