// admin/src/pages/AdminStoreQrPage.jsx
// Route: /merchants/:merchantId/stores/:storeId/qr  (pv_admin)
// QR flow for pv_admin: display → print only.
// Generate and Replace are merchant admin functions — pv_admin must never create or invalidate QR codes.

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listStoreQrs, getStore, getAccessToken, API_BASE } from "../api/client";
import { printQrSheet } from "../utils/qrPrintSheet";
import { color, palette } from "../theme";

export default function AdminStoreQrPage() {
  const { merchantId, storeId } = useParams();

  const [store, setStore] = useState(null);
  const [hasActiveQr, setHasActiveQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch QR PNG as a data URL (auth header required — img tag can't send it)
  async function fetchQrDataUrl() {
    try {
      const resp = await fetch(`${API_BASE}/stores/${storeId}/qr.png`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function load() {
    if (!storeId) { setError("Missing storeId"); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [storeData, qrs] = await Promise.all([
        getStore(storeId),
        listStoreQrs(storeId),
      ]);
      setStore(storeData);
      const active = Array.isArray(qrs) && qrs.some(q => q.status === "active");
      setHasActiveQr(active);
      if (active) setQrDataUrl(await fetchQrDataUrl());
    } catch (err) {
      setError(err?.message || "Failed to load QR data");
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => { load(); }, [storeId]);

  const storeName = store?.name || `Store #${storeId}`;
  const merchantName = store?.merchant?.name || "";

  function handlePrint() {
    if (!qrDataUrl) return;
    printQrSheet({ qrImage: qrDataUrl, storeName, merchantName });
  }


  const pill = (variant = "secondary") => ({
    display: "inline-flex", alignItems: "center",
    minHeight: 44, padding: "10px 20px", borderRadius: 999,
    border: variant === "primary" ? "1px solid transparent" : `1px solid ${color.border}`,
    background: variant === "primary" ? color.primary : color.cardBg,
    cursor: "pointer", fontWeight: 800, fontSize: 14,
    color: variant === "primary" ? palette.white : color.text,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  });

  return (
    <div style={{ maxWidth: 980, paddingBottom: 120 }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          to={`/merchants/${merchantId}/stores/${storeId}`}
          style={{ fontWeight: 800, color: color.primary, textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Store
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 4, color: color.text }}>{storeName}</h2>
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>Scan to check in and access offers</p>
        {merchantName && <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: color.textMuted }}>{merchantName}</p>}
      </div>


      {/* Action buttons — print only if QR exists */}
      {!loading && !error && hasActiveQr && qrDataUrl && (
        <div style={{ marginBottom: 20 }}>
          <button type="button" onClick={handlePrint} style={pill("primary")}>
            Print QR
          </button>
        </div>
      )}


      {loading && (
        <div style={{ borderRadius: 14, border: `1px solid ${color.border}`, background: color.cardBg, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>Loading…</p>
        </div>
      )}

      {!loading && error && (
        <div style={{ borderRadius: 14, border: `1px solid ${color.dangerBorder}`, background: color.dangerSubtle, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>
        </div>
      )}

      {!loading && !error && hasActiveQr && qrDataUrl && (
        <div style={{ borderRadius: 14, border: `1px solid ${color.border}`, background: color.cardBg, padding: 24 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ borderRadius: 12, border: `1px solid ${color.border}`, background: color.cardBg, padding: 16 }}>
              <img
                src={qrDataUrl}
                alt={`QR code for ${storeName}`}
                style={{ display: "block", width: 420, height: 420, objectFit: "contain", maxWidth: "100%" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ borderRadius: 12, border: `1px solid ${color.border}`, background: color.pageBg, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  Placement Guidance
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: color.textMuted }}>
                  Place this printed QR near the register or checkout area where
                  it is easy to see and scan. Reprint this same code if signage
                  is damaged or additional copies are needed. Replace the QR
                  only when you intend to invalidate all previously printed
                  copies for this store.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !hasActiveQr && (
        <div style={{ borderRadius: 14, border: `1px solid ${color.border}`, background: color.cardBg, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: color.text, marginBottom: 8 }}>
            No active QR code for this store.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted, lineHeight: 1.6 }}>
            QR codes must be generated by the merchant. Please ask the merchant admin
            to sign in and generate one from their store management page, or log in
            as a merchant admin to do it yourself.
          </p>
        </div>
      )}
    </div>
  );
}
