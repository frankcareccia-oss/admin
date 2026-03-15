/**
 * Module: MerchantStoreQrPage
 * Description: React page responsible for generating and displaying
 * a QR code for a merchant store and providing print/open actions.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

const STORAGE_KEY_PREFIX = "merchant-store-qr:";

function findJwtInStorage() {
  const directKeys = [
    "token",
    "authToken",
    "accessToken",
    "jwt",
    "bearerToken",
    "perkvaletToken",
    "perkvaletAuthToken",
  ];

  for (const key of directKeys) {
    const localValue = localStorage.getItem(key);
    if (typeof localValue === "string" && localValue.trim()) return localValue.trim();

    const sessionValue = sessionStorage.getItem(key);
    if (typeof sessionValue === "string" && sessionValue.trim()) return sessionValue.trim();
  }

  const scanStorage = (storageObj) => {
    for (let i = 0; i < storageObj.length; i += 1) {
      const key = storageObj.key(i);
      const raw = storageObj.getItem(key);
      if (!raw || typeof raw !== "string") continue;

      if (raw.split(".").length === 3 && raw.length > 40) {
        return raw;
      }

      try {
        const parsed = JSON.parse(raw);
        const queue = [parsed];

        while (queue.length) {
          const cur = queue.shift();
          if (!cur || typeof cur !== "object") continue;

          for (const [k, v] of Object.entries(cur)) {
            if (
              typeof v === "string" &&
              /token|jwt|accessToken|authToken/i.test(k) &&
              v.trim()
            ) {
              return v.trim();
            }

            if (typeof v === "string" && v.split(".").length === 3 && v.length > 40) {
              return v;
            }

            if (v && typeof v === "object") {
              queue.push(v);
            }
          }
        }
      } catch {
        // ignore non-JSON values
      }
    }

    return "";
  };

  return scanStorage(localStorage) || scanStorage(sessionStorage) || "";
}

function getApiPath(path) {
  const base = (import.meta.env.VITE_API_BASE_URL || "").trim();

  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

export default function MerchantStoreQrPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasStartedRef = useRef(false);

  const merchantIdFromState = location.state?.merchantId ?? null;
  const merchantNameFromState = location.state?.merchantName ?? "";
  const storeNameFromState = location.state?.storeName ?? "";

  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}${storeId}`, [storeId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrPayload, setQrPayload] = useState(null);

  useEffect(() => {
    if (!storeId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const generateQr = async () => {
      setLoading(true);
      setError("");

      try {
        const token = findJwtInStorage();
        const response = await fetch(getApiPath(`/merchant/stores/${storeId}/qr/generate`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || data?.message || `QR generation failed (${response.status})`);
        }

        const normalized = {
          ...data,
          merchantId: data?.merchantId ?? merchantIdFromState ?? null,
          merchantName: data?.merchantName ?? merchantNameFromState ?? "",
          storeName: data?.storeName ?? storeNameFromState ?? "",
          storeId: Number(storeId),
        };

        setQrPayload(normalized);
        sessionStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch (err) {
        setError(err?.message || "Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    generateQr();
  }, [merchantIdFromState, merchantNameFromState, storageKey, storeId, storeNameFromState]);

  const resolvedMerchantId = qrPayload?.merchantId ?? merchantIdFromState ?? null;
  const backToStoreHref = `/merchant/stores/${storeId}`;
  const backToMerchantHref = resolvedMerchantId ? `/merchants/${resolvedMerchantId}` : null;
  const openPngHref = qrPayload?.qrImageDataUrl || qrPayload?.qrUrl || "";

  const handlePrint = () => {
    if (!qrPayload) return;

    navigate(`/stores/${storeId}/print-qr`, {
      state: {
        qrImageDataUrl: qrPayload.qrImageDataUrl,
        qrUrl: qrPayload.qrUrl,
        qrToken: qrPayload.qrToken,
        merchantId: qrPayload.merchantId ?? merchantIdFromState ?? null,
        merchantName: qrPayload.merchantName ?? merchantNameFromState ?? "",
        storeName: qrPayload.storeName ?? storeNameFromState ?? "",
        storeId: Number(storeId),
      },
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 text-sm mb-4 flex-wrap">
        <Link to={backToStoreHref} className="text-indigo-600 hover:underline">
          ← Back to Store
        </Link>

        {backToMerchantHref ? (
          <>
            <span className="text-gray-400">•</span>
            <Link to={backToMerchantHref} className="text-indigo-600 hover:underline">
              ← Back to Merchant
            </Link>
          </>
        ) : null}

        {openPngHref ? (
          <>
            <span className="text-gray-400">•</span>
            <a href={openPngHref} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              Open PNG
            </a>
          </>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Store QR Generator</h1>
          <p className="text-xl text-gray-700">
            Generate the active scan QR for <strong>this store</strong>.
          </p>
        </div>

        {!loading && !error && qrPayload ? (
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center rounded-xl border border-black px-5 py-3 text-lg font-semibold hover:bg-gray-50"
          >
            Print
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-700 font-medium">Generating QR…</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      ) : null}

      {!loading && !error && qrPayload ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">
              {qrPayload.storeName || storeNameFromState || `Store #${storeId}`}
            </h2>

            {qrPayload.merchantName || merchantNameFromState ? (
              <p className="text-gray-600 mt-1">{qrPayload.merchantName || merchantNameFromState}</p>
            ) : null}

            <p className="text-sm text-gray-500 mt-2">Store ID: {storeId}</p>
          </div>

          {qrPayload.qrImageDataUrl ? (
            <div className="rounded-2xl border border-gray-200 p-6 w-fit bg-white">
              <img
                src={qrPayload.qrImageDataUrl}
                alt="Store QR code"
                className="block max-w-full h-auto"
                style={{ width: 420, height: 420, objectFit: "contain" }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-amber-800">QR generated, but no image payload was returned.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
