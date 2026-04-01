// admin/src/pages/MerchantStoreQrPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { generateMerchantStoreQr } from "../api/client";
import ReplaceQrCard from "../components/qr/ReplaceQrCard";
import { printQrSheet } from "../utils/qrPrintSheet";
import { color, btn, palette } from "../theme";

export default function MerchantStoreQrPage() {
  const { storeId } = useParams();

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [qrPayload, setQrPayload] = useState(null);

  const [showReplaceCard, setShowReplaceCard] = useState(false);
  const [replaceReason, setReplaceReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [justReplaced, setJustReplaced] = useState(false);
  const [highlightPrint, setHighlightPrint] = useState(false);
  const [helperMessage, setHelperMessage] = useState("");

  async function loadQr({ regen = false } = {}) {
    if (!storeId) {
      setError("Missing storeId");
      setLoading(false);
      setRegenerating(false);
      return;
    }

    if (regen) setRegenerating(true);
    else setLoading(true);

    setError("");

    try {
      const data = await generateMerchantStoreQr(storeId);
      setQrPayload(data);

      try {
        console.log(
          JSON.stringify({
            pvUiHook: regen
              ? "merchant.store.qr.regenerated.ui"
              : "merchant.store.qr.loaded.ui",
            ts: new Date().toISOString(),
            stable: regen
              ? "merchant:store:qr:regenerated"
              : "merchant:store:qr:loaded",
            storeId: Number(storeId),
            ok: Boolean(data?.ok),
          })
        );
      } catch {
        // ignore
      }
    } catch (err) {
      const msg = err?.message || "QR generation failed";
      setError(msg);

      try {
        console.log(
          JSON.stringify({
            pvUiHook: regen
              ? "merchant.store.qr.regenerate_failed.ui"
              : "merchant.store.qr.load_failed.ui",
            ts: new Date().toISOString(),
            stable: regen
              ? "merchant:store:qr:regenerate_failed"
              : "merchant:store:qr:load_failed",
            storeId: Number(storeId),
            error: msg,
          })
        );
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  useEffect(() => {
    try {
      console.log(
        JSON.stringify({
          pvUiHook: "merchant.store.qr.page_loaded.ui",
          ts: new Date().toISOString(),
          stable: "merchant:store:qr:page_loaded",
          storeId: Number(storeId),
        })
      );
    } catch {
      // ignore
    }

    loadQr({ regen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const storeLabel = useMemo(
    () => qrPayload?.storeName || (storeId ? `Store #${storeId}` : "Store"),
    [qrPayload, storeId]
  );

  const merchantLabel = qrPayload?.merchantName || "";
  const qrImageSrc = qrPayload?.qrImageDataUrl || "";

  const handlePrint = () => {
    try {
      console.log(
        JSON.stringify({
          pvUiHook: justReplaced
            ? "merchant.store.qr.print_new_clicked.ui"
            : "merchant.store.qr.print_clicked.ui",
          ts: new Date().toISOString(),
          stable: justReplaced
            ? "merchant:store:qr:print_new_clicked"
            : "merchant:store:qr:print_clicked",
          storeId: Number(storeId),
          hasQr: Boolean(qrImageSrc),
        })
      );
    } catch {
      // ignore
    }

    if (!qrImageSrc) return;

    printQrSheet({
      qrImage: qrImageSrc,
      storeName: storeLabel,
      merchantName: merchantLabel,
    });
  };

  const handleOpenReplaceCard = () => {
    setShowReplaceCard(true);
    setReplaceReason("");
    setSuccessMessage("");
    setJustReplaced(false);
    setHighlightPrint(false);
    setHelperMessage("");

    try {
      console.log(
        JSON.stringify({
          pvUiHook: "merchant.store.qr.replace_card_opened.ui",
          ts: new Date().toISOString(),
          stable: "merchant:store:qr:replace_card_opened",
          storeId: Number(storeId),
        })
      );
    } catch {
      // ignore
    }
  };

  const handleCancelReplace = () => {
    setShowReplaceCard(false);
    setReplaceReason("");

    try {
      console.log(
        JSON.stringify({
          pvUiHook: "merchant.store.qr.replace_card_cancelled.ui",
          ts: new Date().toISOString(),
          stable: "merchant:store:qr:replace_card_cancelled",
          storeId: Number(storeId),
        })
      );
    } catch {
      // ignore
    }
  };

  const handleReplaceDecision = async () => {
    try {
      console.log(
        JSON.stringify({
          pvUiHook: "merchant.store.qr.replace_reason_selected.ui",
          ts: new Date().toISOString(),
          stable: "merchant:store:qr:replace_reason_selected",
          storeId: Number(storeId),
          reason: replaceReason || null,
        })
      );
    } catch {
      // ignore
    }

    if (!replaceReason) return;

    if (replaceReason === "damaged_prints") {
      setShowReplaceCard(false);
      setReplaceReason("");
      setHighlightPrint(true);
      setHelperMessage(
        "Use Print QR to create another copy of the current active store QR."
      );

      try {
        console.log(
          JSON.stringify({
            pvUiHook: "merchant.store.qr.print_guidance_shown.ui",
            ts: new Date().toISOString(),
            stable: "merchant:store:qr:print_guidance_shown",
            storeId: Number(storeId),
          })
        );
      } catch {
        // ignore
      }

      return;
    }

    try {
      console.log(
        JSON.stringify({
          pvUiHook: "merchant.store.qr.replace_confirmed.ui",
          ts: new Date().toISOString(),
          stable: "merchant:store:qr:replace_confirmed",
          storeId: Number(storeId),
          reason: replaceReason || null,
        })
      );
    } catch {
      // ignore
    }

    setShowReplaceCard(false);
    setReplaceReason("");
    setHighlightPrint(false);
    setHelperMessage("");

    await loadQr({ regen: true });

    setSuccessMessage(
      "A new store QR is now active. Replace all previously printed QR copies at this store."
    );
    setJustReplaced(true);
  };

  const pill = (variant = "secondary") => ({
    display: "inline-flex",
    alignItems: "center",
    minHeight: 44,
    padding: "10px 20px",
    borderRadius: 999,
    border: variant === "primary" ? "1px solid transparent" : `1px solid ${color.border}`,
    background: variant === "primary" ? color.primary : color.cardBg,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    color: variant === "primary" ? palette.white : color.text,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  });

  return (
    <div style={{ maxWidth: 980, paddingBottom: 120 }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          to={`/merchant/stores/${storeId}`}
          style={{ fontWeight: 800, color: color.primary, textDecoration: "none", fontSize: 14 }}
        >
          ← Back to Store
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, marginBottom: 4, color: color.text }}>{storeLabel}</h2>
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          Scan to check in and access offers
        </p>
        {merchantLabel ? (
          <p style={{ margin: 0, marginTop: 6, fontSize: 14, color: color.textMuted }}>{merchantLabel}</p>
        ) : null}
      </div>

      {successMessage ? (
        <div style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${color.primaryBorder}`, background: color.primarySubtle, padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: color.text }}>{successMessage}</p>
        </div>
      ) : null}

      {helperMessage ? (
        <div style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${color.border}`, background: color.primarySubtle, padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: color.text }}>{helperMessage}</p>
        </div>
      ) : null}

      {!loading && !error && qrPayload ? (
        <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {justReplaced ? (
            <button type="button" onClick={handlePrint} style={pill("primary")}>
              Print New QR
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePrint}
                style={highlightPrint ? { ...pill("primary"), background: "#277D79" } : pill("primary")}
              >
                Print QR
              </button>
              <button type="button" onClick={handleOpenReplaceCard} style={pill("secondary")}>
                Replace
              </button>
            </>
          )}
        </div>
      ) : null}

      {showReplaceCard ? (
        <ReplaceQrCard
          replaceReason={replaceReason}
          setReplaceReason={setReplaceReason}
          onCancel={handleCancelReplace}
          onContinue={handleReplaceDecision}
          regenerating={regenerating}
        />
      ) : null}

      {loading ? (
        <div style={{ borderRadius: 14, border: `1px solid ${color.border}`, background: color.cardBg, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>Generating QR…</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div style={{ borderRadius: 14, border: `1px solid ${color.dangerBorder}`, background: color.dangerSubtle, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>
        </div>
      ) : null}

      {!loading && !error && qrPayload && !showReplaceCard ? (
        <div style={{ borderRadius: 14, border: `1px solid ${color.border}`, background: color.cardBg, padding: 24 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ borderRadius: 12, border: `1px solid ${color.border}`, background: color.cardBg, padding: 16 }}>
              {qrImageSrc ? (
                <img
                  src={qrImageSrc}
                  alt={`QR code for ${storeLabel}`}
                  style={{ display: "block", width: 420, height: 420, objectFit: "contain", maxWidth: "100%" }}
                />
              ) : (
                <div style={{ borderRadius: 10, border: "1px solid rgba(200,150,0,0.20)", background: "rgba(255,200,0,0.06)", padding: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(120,80,0,0.85)" }}>
                    QR generated, but no image payload was returned.
                  </p>
                </div>
              )}
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
      ) : null}
    </div>
  );
}