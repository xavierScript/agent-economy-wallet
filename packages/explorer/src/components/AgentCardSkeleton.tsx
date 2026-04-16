export default function AgentCardSkeleton() {
  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="skeleton skeleton-avatar" />
        <div style={{ flex: 1, minWidth: 0, paddingRight: "16px" }}>
          <div className="skeleton skeleton-title" style={{ width: "60%" }} />
          <div className="skeleton skeleton-text" style={{ width: "80%" }} />
        </div>
      </div>

      <div className="agent-card-body" style={{ marginTop: "16px" }}>
        <div className="agent-services" style={{ gap: "8px" }}>
          <div
            className="skeleton"
            style={{ width: "60px", height: "24px", borderRadius: "12px" }}
          />
          <div
            className="skeleton"
            style={{ width: "80px", height: "24px", borderRadius: "12px" }}
          />
          <div
            className="skeleton"
            style={{ width: "50px", height: "24px", borderRadius: "12px" }}
          />
        </div>
      </div>

      <div
        className="agent-card-footer"
        style={{
          marginTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="skeleton skeleton-text" style={{ width: "120px" }} />
        <div className="skeleton skeleton-text" style={{ width: "40px" }} />
      </div>
    </div>
  );
}
