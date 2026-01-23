// src/pages/PrintStoreQr.jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { getStore, getStoreQrPngUrl } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

export default function PrintStoreQr() {
  const { storeId } = useParams();

  const [store, setStore] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const qrPngUrl = getStoreQrPngUrl(storeId);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const s = await getStore(storeId);
        if (!cancelled) setStore(s);
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
  }, [storeId]);

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

  const merchantLink = store?.merchantId ? `/merchants/${store.merchantId}` : "/merchants";

  return (
    <PageContainer size="page">
      <style>{`
        .pv-sheet {
          background: white;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 14px;
          padding: 24px;
        }

        .pv-title {
          font-size: 26px;
          font-weight: 900;
          margin: 0;
        }

        .pv-sub {
          margin-top: 8px;
          color: rgba(0,0,0,0.75);
          font-size: 14px;
          line-height: 1.4;
        }

        .pv-qr-box {
          margin-top: 18px;
          display: grid;
          place-items: center;
          padding: 18px;
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 14px;
        }

        .pv-qr {
          width: 420px;
          height: 420px;
          image-rendering: pixelated;
        }

        .pv-instructions {
          margin-top: 18px;
          font-size: 18px;
          font-weight: 800;
          text-align: center;
        }

        .pv-foot {
          margin-top: 12px;
          font-size: 12px;
          color: rgba(0,0,0,0.65);
          text-align: center;
        }

        .pv-actions-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .pv-link {
          textDecoration: none;
        }

        .pv-btn {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.2);
          background: white;
          cursor: pointer;
          font-weight: 800;
        }

        .pv-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pv-card {
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 14px;
          padding: 14px;
          background: white;
        }

        .pv-error {
          background: rgba(255,0,0,0.06);
          border: 1px solid rgba(255,0,0,0.15);
          padding: 12px;
          border-radius: 12px;
          color: crimson;
          white-space: pre-wrap;
        }

        @media print {
          header, aside, nav { display: none !important; }
          main { padding: 0 !important; }

          .pv-actions-row { display: none !important; }
          .pv-sheet {
            border: none;
            border-radius: 0;
            padding: 0.5in;
          }

          @page { size: letter; margin: 0.25in; }

          .pv-qr { width: 5.0in; height: 5.0in; }
        }
      `}</style>

      {/* Breadcrumbs / quick links */}
      <div className="pv-actions-row" style={{ marginBottom: 10 }}>
        <Link to={`/stores/${storeId}`} style={{ textDecoration: "none", fontWeight: 800 }}>
          ← Back to Store
        </Link>

        <span style={{ color: "rgba(0,0,0,0.35)" }}>•</span>

        <Link to={merchantLink} style={{ textDecoration: "none", fontWeight: 800 }}>
          ← Back to Merchant
        </Link>

        <span style={{ color: "rgba(0,0,0,0.35)" }}>•</span>

        <a href={qrPngUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>
          Open PNG
        </a>
      </div>

      <PageHeader
        title="Print Store QR"
        subtitle={
          store ? (
            <span style={{ color: "rgba(0,0,0,0.75)" }}>
              {store.name} • Store ID: <code>{storeId}</code>
            </span>
          ) : (
            <span style={{ color: "rgba(0,0,0,0.65)" }}>Printable QR sheet for in-store signage.</span>
          )
        }
        right={
          <button className="pv-btn" onClick={onPrint} disabled={loading || !!error}>
            Print
          </button>
        }
      />

      {loading ? (
        <div className="pv-card" style={{ color: "rgba(0,0,0,0.65)" }}>
          Loading…
        </div>
      ) : null}

      {error ? <div className="pv-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="pv-sheet">
          <h1 className="pv-title">{store?.name || "Store"}</h1>
          <div className="pv-sub">
            {addressLine || " "}
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Store ID: <code>{storeId}</code>
            </div>
          </div>

          <div className="pv-qr-box">
            <img className="pv-qr" src={qrPngUrl} alt="Store QR" />
          </div>

          <div className="pv-instructions">Scan to check in</div>
          <div className="pv-foot">
            If you have trouble scanning, increase screen brightness or move the camera closer.
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
