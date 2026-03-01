// admin/src/components/SupportInfo.jsx
import React from ""react"";

export default function SupportInfo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      style={{
        position: ""fixed"",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        fontSize: 12,
      }}
    >
      {!open ? (
        <div
          style={{
            textAlign: ""center"",
            padding: ""6px 0"",
            background: ""#f5f5f5"",
            borderTop: ""1px solid rgba(0,0,0,0.1)"",
            cursor: ""pointer"",
          }}
          onClick={() => setOpen(true)}
        >
          Support ▲
        </div>
      ) : (
        <div
          style={{
            background: ""#ffffff"",
            borderTop: ""1px solid rgba(0,0,0,0.15)"",
            padding: 12,
          }}
        >
          <div style={{ display: ""flex"", justifyContent: ""space-between"" }}>
            <strong>Support Info</strong>
            <button
              style={{
                background: ""transparent"",
                border: ""none"",
                cursor: ""pointer"",
                fontSize: 12,
              }}
              onClick={() => setOpen(false)}
            >
              Close ▼
            </button>
          </div>

          <div style={{ marginTop: 8, color: ""rgba(0,0,0,0.7)"" }}>
            Diagnostics placeholder (we will wire real data next).
          </div>
        </div>
      )}
    </div>
  );
}
