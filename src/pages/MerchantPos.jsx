import React from "react";
import { Link } from "react-router-dom";

export default function MerchantPos() {
  return (
    <div style={{ maxWidth: 980 }}>
      <h2>POS Associate - Dashboard</h2>
      <div style={{ color: "rgba(0,0,0,0.65)" }}>
        Use this page to register visits and grant rewards at your store.
      </div>

      <div style={{ marginTop: 20 }}>
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
    marginRight: 15,
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
};
