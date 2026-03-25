import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { generateMerchantStoreQr } from "../api/client";
import ReplaceQrCard from "../components/qr/ReplaceQrCard";
import { printQrSheet } from "../utils/qrPrintSheet";

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

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-8 pb-32">
      <div className="mb-4">
        <Link
          to={`/merchant/stores/${storeId}`}
          className="inline-flex items-center text-sm font-bold text-teal-700 hover:text-teal-800 hover:underline"
        >
          ← Back to Store
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">
          {storeLabel}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Scan to check in and access offers
        </p>
        {merchantLabel ? (
          <p className="mt-3 text-lg leading-7 text-slate-600">{merchantLabel}</p>
        ) : null}
      </div>

      {successMessage ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
        </div>
      ) : null}

      {helperMessage ? (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-sky-900">{helperMessage}</p>
        </div>
      ) : null}

      {!loading && !error && qrPayload ? (
        justReplaced ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex min-h-[48px] items-center rounded-full border border-slate-800 bg-white px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Print New QR
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className={`inline-flex min-h-[48px] items-center rounded-full px-5 py-2.5 text-base font-semibold shadow-sm transition ${
                highlightPrint
                  ? "border border-slate-900 bg-white text-slate-900 ring-2 ring-teal-200"
                  : "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              Print QR
            </button>

            <button
              type="button"
              onClick={handleOpenReplaceCard}
              className="inline-flex min-h-[48px] items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              Replace
            </button>
          </div>
        )
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Generating QR...</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      ) : null}

      {!loading && !error && qrPayload && !showReplaceCard ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              {qrImageSrc ? (
                <img
                  src={qrImageSrc}
                  alt={`QR code for ${storeLabel}`}
                  className="block h-auto max-w-full"
                  style={{ width: 420, height: 420, objectFit: "contain" }}
                />
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-800">
                    QR generated, but no image payload was returned.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Placement Guidance
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
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