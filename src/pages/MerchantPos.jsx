import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function MerchantPos() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const success = params.get("success"); // "visit" | "reward" | null

  const initialBanner = useMemo(() => {
    if (success === "visit") return { kind: "success", text: "Visit registered successfully." };
    if (success === "reward") return { kind: "success", text: "Reward granted successfully." };
    return null;
  }, [success]);

  const [banner, setBanner] = useState(initialBanner);

  return (
    <div style={{ maxWidth: 980 }}>
      <h2>POS Associate - Dashboard</h2>
      <div style={{ color: "rgba(0,0,0,0.65)" }}>
        Use this page to register visits and grant rewards at your store.
      </div>

      {banner && (
        <div style={banner.kind === "success" ? styles.bannerSuccess : styles.bannerInfo}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>{banner.text}</div>
            <button type="button" onClick={() => setBanner(null)} style={styles.bannerClose}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* POS Actions */}
      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/merchant/pos/visit" style={styles.primaryBtn}>
          Register Visit
        </Link>

        <Link to="/merchant/pos/reward" style={styles.primaryBtn}>
          Grant Reward
        </Link>
      </div>

      <div style={styles.footer}>
        <p>POS associate - limited to visit/reward actions only.</p>
      </div>
    </div>
  );
}

const styles = {
  primaryBtn: {
    padding: "12px 20px",
    borderRadius: 8,
    border: "1px solid #000",
    background: "#fff",
    textDecoration: "none",
    fontWeight: 600,
    color: "black",
    display: "inline-block",
  },
  footer: {
    marginTop: 30,
    color: "rgba(0, 0, 0, 0.5)",
    fontSize: 14,
  },
  bannerSuccess: {
    marginTop: 16,
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(0,0,0,0.04)",
  },
  bannerInfo: {
    marginTop: 16,
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(0,0,0,0.03)",
  },
  bannerClose: {
    border: "1px solid rgba(0,0,0,0.25)",
    background: "#fff",
    borderRadius: 8,
    padding: "4px 8px",
    cursor: "pointer",
    fontWeight: 700,
    lineHeight: 1,
  },
};
