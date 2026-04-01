// admin/src/pages/PrintStoreQr.jsx

import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getStore } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { color, btn, palette } from "../theme";

const PRINT_STATE_KEY_PREFIX = "pv:store-qr-print:";

export default function PrintStoreQr() {
  const { storeId } = useParams();
  const location = useLocation();

  const [store, setStore] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [qrImageDataUrl, setQrImageDataUrl] = React.useState(location.state?.qrImageDataUrl || null);
  const [printMeta, setPrintMeta] = React.useState({
    storeName: location.state?.storeName || null,
    merchantName: location.state?.merchantName || null,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const s = await getStore(storeId);
        if (!cancelled) setStore(s);

        if (!location.state?.qrImageDataUrl) {
          try {
            const raw = sessionStorage.getItem(`${PRINT_STATE_KEY_PREFIX}${storeId}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (!cancelled) {
                setQrImageDataUrl(parsed?.qrImageDataUrl || null);
                setPrintMeta({
                  storeName: parsed?.storeName || null,
                  merchantName: parsed?.merchantName || null,
                });
              }
            }
          } catch {}
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storeId, location.state]);

  const addressLine = [
    store?.address1,
    [store?.city, store?.state].filter(Boolean).join(", "),
    store?.postal,
  ]
    .filter(Boolean)
    .join(" ");

  function onPrint() {
    window.print();
  }

  const resolvedStoreName = printMeta.storeName || store?.name || "Store";

  return (
    <PageContainer size="page">
      <style>{`
        .pv-sheet {
          background: ${color.cardBg};
          border: 1px solid ${color.border};
          border-radius: 16px;
          padding: 28px;
        }

        .pv-title {
          font-size: 28px;
          font-weight: 900;
          text-align: center;
        }

        .pv-qr-box {
          margin-top: 20px;
          display: grid;
          place-items: center;
          padding: 16px;
        }

        .pv-qr {
          width: 420px;
          height: 420px;
          image-rendering: pixelated;
        }

        .pv-instructions {
          margin-top: 18px;
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .pv-subtext {
          margin-top: 8px;
          text-align: center;
          font-size: 13px;
          color: ${color.textMuted};
        }

        .pv-btn {
          padding: 10px 16px;
          border-radius: 999px;
          border: none;
          background: ${color.primary};
          color: ${palette.white};
          font-weight: 900;
          cursor: pointer;
        }

        .pv-error {
          background: ${color.dangerSubtle};
          border: 1px solid ${color.dangerBorder};
          padding: 12px;
          border-radius: 12px;
          color: ${color.danger};
        }

        @media print {
          header, aside, nav { display: none !important; }
          main { padding: 0 !important; }

          .pv-btn { display: none !important; }

          .pv-sheet {
            border: none;
            padding: 0.5in;
          }

          @page { size: letter; margin: 0.25in; }

          .pv-qr {
            width: 5in;
            height: 5in;
          }
        }
      `}</style>

      <div style={{ marginBottom: 12 }}>
        <Link
          to={`/merchant/stores/${storeId}`}
          style={{ fontWeight: 800, color: color.primary, textDecoration: "none" }}
        >
          ← Back to Store
        </Link>
      </div>

      <PageHeader
        title="Print QR"
        subtitle={store ? resolvedStoreName : null}
        right={
          <button
            className="pv-btn"
            onClick={onPrint}
            disabled={loading || !!error || !qrImageDataUrl}
          >
            Print
          </button>
        }
      />

      {loading && <div>Loading…</div>}

      {error && <div className="pv-error">{error}</div>}

      {!loading && !error && qrImageDataUrl && (
        <div className="pv-sheet">
          <div className="pv-title">{resolvedStoreName}</div>

          <div className="pv-qr-box">
            <img className="pv-qr" src={qrImageDataUrl} alt="Store QR" />
          </div>

          <div className="pv-instructions">Scan to Check In</div>

          <div className="pv-subtext">
            Earn rewards and access offers
          </div>
        </div>
      )}
    </PageContainer>
  );
}