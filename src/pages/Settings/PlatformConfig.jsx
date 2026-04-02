// src/pages/Settings/PlatformConfig.jsx
// Route: /admin/platform/config
// PV Admin only — edit platform-wide settings (JWT TTL, OTP TTL, etc.)

import React from "react";
import { Link } from "react-router-dom";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import { color, btn } from "../../theme";
import { adminGetPlatformConfig, adminUpdatePlatformConfig } from "../../api/client";

const FIELD_ORDER = ["consumer_jwt_ttl_days", "consumer_otp_ttl_minutes"];

export default function PlatformConfig() {
  const [config, setConfig] = React.useState(null);
  const [meta, setMeta] = React.useState({});
  const [draft, setDraft] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    adminGetPlatformConfig()
      .then(data => {
        setConfig(data.config);
        setMeta(data.meta || {});
        setDraft({ ...data.config });
      })
      .catch(e => setError(e?.error?.message || e?.message || "Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  function isDirty() {
    if (!config) return false;
    return Object.keys(draft).some(k => draft[k] !== config[k]);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const data = await adminUpdatePlatformConfig(draft);
      setConfig(data.config);
      setDraft({ ...data.config });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e?.error?.message || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const keys = config
    ? [...FIELD_ORDER.filter(k => k in config), ...Object.keys(config).filter(k => !FIELD_ORDER.includes(k))]
    : [];

  return (
    <PageContainer>
      <PageHeader
        title="Platform Configuration"
        subtitle="System-wide settings for consumer authentication and session behavior."
      />

      <div style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/admin" style={{ textDecoration: "none", color: color.textMuted, fontSize: 13 }}>
            ← Admin Dashboard
          </Link>
        </div>

        {loading && <div style={{ color: color.textMuted, padding: "24px 0" }}>Loading…</div>}

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: "#fef2f2", border: "1px solid #fca5a5",
            color: "#b91c1c", fontSize: 14, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {saved && (
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: "#e0f2f1", border: "1px solid #B0C4C3",
            color: "#065f46", fontSize: 14, marginBottom: 16,
          }}>
            Settings saved.
          </div>
        )}

        {!loading && config && (
          <form onSubmit={handleSave}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: 12, overflow: "hidden",
            }}>
              {keys.map((key, i) => {
                const m = meta[key] || {};
                const label = m.label || key;
                return (
                  <div
                    key={key}
                    style={{
                      padding: "16px 20px",
                      borderBottom: i < keys.length - 1 ? "1px solid #f3f4f6" : "none",
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{label}</div>
                      <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
                        Key: <code style={{ fontSize: 11 }}>{key}</code>
                        {m.min != null && m.max != null && (
                          <> · range {m.min}–{m.max}</>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={m.min}
                      max={m.max}
                      value={draft[key] ?? ""}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      style={{
                        width: 80, padding: "6px 10px",
                        border: `1px solid ${draft[key] !== config[key] ? "#2F8F8B" : "#d1d5db"}`,
                        borderRadius: 6, fontSize: 15, fontWeight: 600,
                        textAlign: "right", outline: "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="submit"
                disabled={saving || !isDirty()}
                style={{
                  ...btn.primary,
                  padding: "10px 24px",
                  opacity: saving || !isDirty() ? 0.5 : 1,
                  cursor: saving || !isDirty() ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {isDirty() && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...config })}
                  style={{ ...btn.secondary, padding: "10px 16px", cursor: "pointer" }}
                >
                  Reset
                </button>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: color.textMuted, lineHeight: 1.5 }}>
              Changes take effect immediately for new logins. Existing consumer sessions
              are not affected until they expire naturally.
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
