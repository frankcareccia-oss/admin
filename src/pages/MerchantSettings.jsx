/**
 * MerchantSettings.jsx
 *
 * Merchant account settings hub.
 * Route: /merchant/settings
 *
 * Sections:
 *   - Profile (name, phone — editable)
 *   - Security (change password link)
 *   - Coming soon placeholders
 */

import React from "react";
import { Link } from "react-router-dom";
import { color, btn, inputStyle as themeInput } from "../theme";
import { me, merchantUpdateUserProfile } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

const inputStyle = {
  ...themeInput,
  width: "100%",
  boxSizing: "border-box",
};

const sectionCard = {
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: "20px 24px",
  background: color.cardBg,
  marginBottom: 20,
};

const labelStyle = {
  display: "block",
  fontWeight: 700,
  fontSize: 13,
  color: color.textMuted,
  marginBottom: 6,
};

const fieldRow = {
  marginBottom: 16,
};

export default function MerchantSettings() {
  const [loading, setLoading]   = React.useState(true);
  const [userId, setUserId]     = React.useState(null);
  const [merchantId, setMerchantId] = React.useState(null);
  const [err, setErr]           = React.useState(null);

  // Profile form
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName]   = React.useState("");
  const [phoneRaw, setPhoneRaw]   = React.useState("");
  const [email, setEmail]         = React.useState("");
  const [saving, setSaving]       = React.useState(false);
  const [saveMsg, setSaveMsg]     = React.useState("");
  const [saveErr, setSaveErr]     = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await me();
        if (cancelled) return;
        const u = profile?.user;
        const mid =
          u?.merchantUsers?.[0]?.merchantId ??
          u?.merchantUsers?.[0]?.merchant?.id ??
          null;
        setUserId(u?.id ?? null);
        setMerchantId(mid);
        setFirstName(u?.firstName ?? "");
        setLastName(u?.lastName ?? "");
        setPhoneRaw(u?.phoneRaw ?? "");
        setEmail(u?.email ?? "");
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaveErr("");
    setSaveMsg("");
    setSaving(true);
    pvUiHook("merchant.settings.profile.save", { userId, merchantId });
    try {
      await merchantUpdateUserProfile(userId, merchantId, {
        firstName: firstName.trim() || null,
        lastName:  lastName.trim()  || null,
        phoneRaw:  phoneRaw.trim()  || null,
      });
      setSaveMsg("Profile saved.");
    } catch (e) {
      setSaveErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.textMuted }}>Loading…</div>
      </PageContainer>
    );
  }

  if (err) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.danger }}>{err}</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      <div style={{ marginTop: 24, maxWidth: 560 }}>

        {/* ── Profile ── */}
        <div style={sectionCard}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16, color: color.text }}>
            Profile
          </div>
          <form onSubmit={handleProfileSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input
                  style={inputStyle}
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input
                  style={inputStyle}
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Email</label>
              <input
                style={{ ...inputStyle, background: "rgba(0,0,0,0.04)", color: color.textMuted }}
                value={email}
                disabled
                readOnly
              />
              <div style={{ fontSize: 11, color: color.textFaint, marginTop: 4 }}>
                Email cannot be changed here. Contact support if needed.
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Phone</label>
              <input
                style={inputStyle}
                value={phoneRaw}
                onChange={e => setPhoneRaw(e.target.value)}
                placeholder="e.g. 312-555-0100"
              />
            </div>
            {saveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{saveErr}</div>}
            {saveMsg && <div style={{ color: color.success || "green", fontSize: 13, marginBottom: 10 }}>{saveMsg}</div>}
            <button
              type="submit"
              disabled={saving}
              style={{ ...btn.primary, minWidth: 100 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        {/* ── Security ── */}
        <div style={sectionCard}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
            Security
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: color.text }}>Password</div>
              <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                Update your login password.
              </div>
            </div>
            <Link
              to="/account/change-password"
              style={{
                ...btn.secondary,
                textDecoration: "none",
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              Change Password
            </Link>
          </div>
        </div>

        {/* ── Coming soon ── */}
        <div style={{ ...sectionCard, opacity: 0.5 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: color.text }}>
            Notifications
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 700,
              background: "rgba(0,0,0,0.07)", borderRadius: 999,
              padding: "2px 8px", color: color.textFaint,
            }}>
              Coming soon
            </span>
          </div>
          <div style={{ fontSize: 13, color: color.textMuted }}>
            Configure email and SMS notification preferences.
          </div>
        </div>

      </div>
    </PageContainer>
  );
}
