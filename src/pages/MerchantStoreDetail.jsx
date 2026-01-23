import React from "react";
import { Link, useParams } from "react-router-dom";
import { listMerchantStores, getStoreQrPngUrl } from "../api/client";

export default function MerchantStoreDetail() {
  const { storeId } = useParams();
  const [store, setStore] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const data = await listMerchantStores();
        const id = Number(storeId);
        const found = (data?.items || []).find((s) => s.id === id);

        if (!found) throw new Error("Store not found (not in your merchant scope).");
        if (!cancelled) setStore(found);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>;
  if (!store) return <div style={{ padding: 16 }}>Store not loaded</div>;

  const png = getStoreQrPngUrl(store.id);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/merchant">← Back to My Stores</Link>
      </div>

      <h2 style={{ marginTop: 0 }}>{store.name}</h2>
      <div style={{ color: "rgba(0,0,0,0.65)" }}>
        {[store.address1, store.city, store.state, store.postal].filter(Boolean).join(", ")}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>QR PNG</div>
          <img src={png} alt="Store QR" style={{ width: 180, height: 180 }} />
          <div style={{ marginTop: 8 }}>
            <a href={png} target="_blank" rel="noreferrer">Open PNG</a>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Print</div>
          <Link to={`/stores/${store.id}/print`}>Print-friendly page</Link>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", marginTop: 6 }}>
            (This uses the existing print page. We can make a merchant-only print route later.)
          </div>
        </div>
      </div>
    </div>
  );
}
