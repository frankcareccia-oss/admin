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
import { me, merchantUpdateUserProfile, merchantUpdateType } from "../api/client";
import { MERCHANT_TYPE_OPTIONS, MERCHANT_TYPE_LABELS } from "../config/merchantTypes";
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

  // Business type
  const [merchantType, setMerchantType]   = React.useState(null);
  const [editingType, setEditingType]     = React.useState(false);
  const [typeVal, setTypeVal]             = React.useState("");
  const [typeSaving, setTypeSaving]       = React.useState(false);
  const [typeSaveErr, setTypeSaveErr]     = React.useState("");

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
        const mt = u?.merchantUsers?.[0]?.merchant?.merchantType ?? null;
        setMerchantType(mt);
        setTypeVal(mt || "");
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

  async function handleTypeSave() {
    setTypeSaving(true);
    setTypeSaveErr("");
    pvUiHook("merchant.settings.type.save", { merchantId, typeVal });
    try {
      await merchantUpdateType(typeVal || null);
      setMerchantType(typeVal || null);
      setEditingType(false);
    } catch (e) {
      setTypeSaveErr(e?.message || "Save failed.");
    } finally {
      setTypeSaving(false);
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

        {/* ── Business Type ── */}
        <div style={sectionCard}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: color.text }}>
            Business type
          </div>
          {editingType ? (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: 14 }}>
                {MERCHANT_TYPE_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: typeSaving ? "not-allowed" : "pointer", fontSize: 13 }}>
                    <input
                      type="radio"
                      name="settingsMerchantType"
                      value={opt.value}
                      checked={typeVal === opt.value}
                      onChange={() => setTypeVal(opt.value)}
                      disabled={typeSaving}
                    />
                    {opt.label}
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: typeSaving ? "not-allowed" : "pointer", fontSize: 13, color: color.textFaint }}>
                  <input
                    type="radio"
                    name="settingsMerchantType"
                    value=""
                    checked={typeVal === ""}
                    onChange={() => setTypeVal("")}
                    disabled={typeSaving}
                  />
                  Not specified
                </label>
              </div>
              {typeSaveErr && <div style={{ color: color.danger, fontSize: 13, marginBottom: 10 }}>{typeSaveErr}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleTypeSave} disabled={typeSaving} style={{ ...btn.primary, minWidth: 80 }}>
                  {typeSaving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditingType(false); setTypeVal(merchantType || ""); setTypeSaveErr(""); }}
                  disabled={typeSaving}
                  style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 700, fontSize: 14 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: merchantType ? color.text : color.textFaint }}>
                  {merchantType ? MERCHANT_TYPE_LABELS[merchantType] || merchantType : "Not set"}
                </div>
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                  Helps PerkValet tailor suggestions to your business.
                </div>
              </div>
              <button
                onClick={() => { setTypeVal(merchantType || ""); setEditingType(true); }}
                style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}
              >
                {merchantType ? "Change" : "Set type"}
              </button>
            </div>
          )}
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
                padding: "10px 20px",
                fontSize: 14,
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
