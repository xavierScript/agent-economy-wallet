import AgentCardSkeleton from "@/components/AgentCardSkeleton";

export default function Loading() {
  return (
    <>
      <section className="hero">
        <span className="hero-eyebrow">
          <span className="live-dot" /> Loading... · Solana
        </span>
        <h1>
          <span className="hero-gradient-text">Yanga Market</span>
          <br /> Explorer
        </h1>
      </section>

      <section className="container">
        <div className="stats-grid stats-grid-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card">
              <div
                className="skeleton"
                style={{ height: "12px", width: "80px", marginBottom: "8px" }}
              />
              <div
                className="skeleton"
                style={{ height: "32px", width: "120px" }}
              />
              <div
                className="skeleton"
                style={{ height: "10px", width: "60px", marginTop: "8px" }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <div className="agent-grid">
              {[...Array(6)].map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <aside className="dashboard-sidebar">
            <div className="activity-feed">
              <div className="activity-feed-header">
                <div
                  className="skeleton"
                  style={{ height: "16px", width: "100px" }}
                />
              </div>
              <div
                className="activity-feed-list"
                style={{
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{
                      height: "40px",
                      width: "100%",
                      borderRadius: "8px",
                    }}
                  />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
