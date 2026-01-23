// src/pages/StoreDetail.jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { getStore, listStoreQrs, mintStoreQr, getStoreQrPngUrl } from "../api/client";
import Toast from "../components/Toast";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

export default function StoreDetail() {
  const { storeId } = useParams();

  const [store, setStore] = React.useState(null);
  const [qrs, setQrs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hasLoaded, setHasLoaded] = React.useState(false);

  const [toast, setToast] = React.useState(null);

  // cache-bust for PNG after mint (and to defeat browser caching in general)
  const [imgBust, setImgBust] = React.useState(() => Date.now());
  const [imgFailed, setImgFailed] = React.useState(false);

  const activeQr = React.useMemo(() => {
    if (!Array.isArray(qrs)) return null;
    return qrs.find((q) => q.status === "active") || null;
  }, [qrs]);

  const pngSrc = React.useMemo(() => {
    return `${getStoreQrPngUrl(storeId)}?t=${encodeURIComponent(imgBust)}`;
  }, [storeId, imgBust]);

  async function load({ silent = false } = {}) {
    if (!silent) {
      setError("");
      setLoading(true);
      setHasLoaded(false);
    }

    try {
      const [s, qrList] = await Promise.all([getStore(storeId), listStoreQrs(storeId)]);
      setStore(s);
      setQrs(Array.isArray(qrList) ? qrList : []);
      if (!silent) setToast({ type: "success", message: "Refreshed" });
    } catch (e) {
      const msg = normalizeErr(e);
      setError(msg);
      setStore(null);
      setQrs([]);
      setToast({ type: "error", message: msg });
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  React.useEffect(() => {
    setImgFailed(false);
  }, [activeQr?.id, imgBust]);

  async function onRefresh() {
    await load();
  }

  async function onMint() {
    setBusy(true);
    setError("");
    try {
      await mintStoreQr(storeId);
      setImgBust(Date.now());
      await load({ silent: true });
      setToast({ type: "success", message: "QR minted" });
    } catch (e) {
      const msg = normalizeErr(e);
      setError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, label = "Copied") {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setToast({ type: "success", message: label });
    } catch {
      // ignore
    }
  }

  const showNoActiveQr = hasLoaded && !loading && !activeQr;

  const merchantLink = store?.merchantId ? `/merchants/${store.merchantId}` : "/merchants";
  const merchantName = store?.merchant?.name || `Merchant #${store?.merchantId || ""}`;

  if (loading && !hasLoaded) {
    return (
      <PageContainer size="page">
        <div style={{ padding: 16, color: "rgba(0,0,0,0.65)" }}>Loading store…</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="page">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      {/* Breadcrumbs / top links */}
      <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Link to={merchantLink} style={styles.backLink}>
          ← Back to Merchant
        </Link>
        <span style={{ color: "rgba(0,0,0,0.35)" }}>•</span>
        <Link to="/merchants" style={styles.backLink}>
          All Merchants
        </Link>

        <div style={{ flex: 1 }} />

        <Link to={`/stores/${storeId}/print`} style={styles.pillLink}>
          Print QR
        </Link>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
          {looksLikeAuthError(error) && (
            <div style={{ marginTop: 10 }}>
              Go to <Link to="/settings/admin-key">Admin Key</Link> and save your key.
            </div>
          )}
        </div>
      ) : null}

      {!store ? (
        <div style={styles.card}>
          <div style={{ fontWeight: 900 }}>Store not loaded</div>
          <div style={styles.hint}>Try Refresh.</div>
          <div style={{ marginTop: 12 }}>
            <button onClick={onRefresh} style={styles.button}>
              Refresh
            </button>
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            title={store.name}
            subtitle={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pillStyle(store.status)}>{store.status}</span>
                <span style={{ color: "rgba(0,0,0,0.65)" }}>
                  Merchant: <Link to={merchantLink}>{merchantName}</Link>
                </span>
              </div>
            }
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={onRefresh} style={styles.button} disabled={busy}>
                  Refresh
                </button>
                <button onClick={onMint} style={styles.buttonPrimary} disabled={busy}>
                  {busy ? "Minting…" : showNoActiveQr ? "Mint first QR" : "Mint new QR"}
                </button>
              </div>
            }
          />

          {showNoActiveQr ? (
            <div style={styles.warnBox}>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>No active QR for this store</div>
              <div>
                Click <b>Mint first QR</b> to generate one. (Minting always archives any previous active QR and creates a
                new one.)
              </div>
            </div>
          ) : null}

          {/* QR Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ fontWeight: 900 }}>QR (PNG)</div>

              {activeQr ? (
                <a href={pngSrc} target="_blank" rel="noreferrer" style={styles.link}>
                  Open PNG
                </a>
              ) : (
                <span style={styles.linkDisabled} title="No active QR to open yet">
                  Open PNG
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={styles.qrBox}>
                {activeQr && !imgFailed ? (
                  <img src={pngSrc} alt="Store QR" style={styles.qrImg} onError={() => setImgFailed(true)} />
                ) : (
                  <div style={styles.qrPlaceholder}>{showNoActiveQr ? "No active QR" : "QR not available"}</div>
                )}
              </div>

              <div style={{ minWidth: 280 }}>
                <div style={styles.hint}>
                  {activeQr ? (
                    <>
                      Active since: <b>{formatDate(activeQr.createdAt)}</b>
                    </>
                  ) : (
                    <>No active QR.</>
                  )}
                </div>

                <div style={styles.hintSmall}>Minting will archive any existing active QR and create a fresh one.</div>

                {activeQr ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={styles.miniBtn} onClick={() => copy(pngSrc, "PNG link copied")}>
                      Copy PNG link
                    </button>
                    <span style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                      Use this to share internally or paste into support notes.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* QR History */}
          <div style={{ marginTop: 18 }}>
            <h2 style={styles.h2}>QR history</h2>
            <div style={styles.card}>
              {Array.isArray(qrs) && qrs.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Created</th>
                        <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qrs.map((qr) => (
                        <tr key={qr.id}>
                          <td style={styles.td}>
                            <span style={pillStyle(qr.status)}>{qr.status}</span>
                          </td>
                          <td style={styles.td}>{formatDate(qr.createdAt)}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            {/* Intentionally no token/payload exposure. */}
                            <span style={{ color: "rgba(0,0,0,0.55)", fontSize: 12 }}>
                              Tokens hidden (internal only)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={styles.hint}>No QR history yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}

/* -----------------------------
   Local helpers
-------------------------------- */

function normalizeErr(e) {
  return e?.message || String(e || "Unknown error");
}

function looksLikeAuthError(msg) {
  return /unauthorized|api key|forbidden|missing or invalid/i.test(msg || "");
}

function formatDate(d) {
  try {
    const dt = d ? new Date(d) : null;
    if (!dt || Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString();
  } catch {
    return "";
  }
}

function pillStyle(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.04)",
    color: "#111",
    textTransform: "capitalize",
  };

  if (status === "active")
    return { ...base, background: "rgba(46, 204, 113, 0.15)", borderColor: "rgba(46,204,113,0.35)" };
  if (status === "suspended")
    return { ...base, background: "rgba(241, 196, 15, 0.18)", borderColor: "rgba(241,196,15,0.45)" };
  if (status === "archived")
    return { ...base, background: "rgba(231, 76, 60, 0.12)", borderColor: "rgba(231,76,60,0.30)" };
  return base;
}

/* -----------------------------
   Styles
-------------------------------- */

const styles = {
  backLink: { textDecoration: "none", color: "inherit", fontWeight: 800 },

  pillLink: {
    textDecoration: "none",
    color: "inherit",
    border: "1px solid rgba(0,0,0,0.18)",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 900,
    background: "white",
  },

  h2: { margin: "0 0 10px 0", fontSize: 18 },

  hint: { color: "rgba(0,0,0,0.65)" },
  hintSmall: { color: "rgba(0,0,0,0.55)", fontSize: 13, marginTop: 6 },

  button: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  buttonPrimary: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(0,0,0,0.06)",
    fontWeight: 900,
    cursor: "pointer",
  },

  card: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },

  link: { textDecoration: "none", fontWeight: 900 },
  linkDisabled: { fontWeight: 900, color: "rgba(0,0,0,0.35)", cursor: "not-allowed" },

  warnBox: {
    border: "1px solid rgba(231, 76, 60, 0.25)",
    background: "rgba(231, 76, 60, 0.10)",
    padding: "10px 12px",
    borderRadius: 12,
    margin: "10px 0 12px",
  },

  errorBox: {
    border: "1px solid rgba(231, 76, 60, 0.30)",
    background: "rgba(231, 76, 60, 0.10)",
    padding: "12px 14px",
    borderRadius: 12,
    marginBottom: 12,
  },

  qrBox: {
    width: 180,
    height: 180,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "#fff",
  },
  qrImg: { width: 170, height: 170, objectFit: "contain" },
  qrPlaceholder: {
    width: 170,
    height: 170,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    border: "1px dashed rgba(0,0,0,0.18)",
    color: "rgba(0,0,0,0.55)",
    fontWeight: 900,
    fontSize: 12,
    textAlign: "center",
    padding: 10,
  },

  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "rgba(0,0,0,0.65)",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  td: { padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", verticalAlign: "top" },

  miniBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#fff",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },
};
