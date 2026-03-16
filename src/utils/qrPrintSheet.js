export function printQrSheet({ qrImage, storeName, merchantName }) {
  const safeStore = String(storeName || "Store QR");
  const safeMerchant = String(merchantName || "");
  const safeQr = String(qrImage || "");

  if (!safeQr) {
    throw new Error("Missing QR image for print");
  }

  const win = window.open("", "_blank");

  if (!win) {
    throw new Error("Popup blocked: unable to open print window");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeStore}</title>
        <style>
          @page {
            size: portrait;
            margin: 0.5in;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
          }

          body {
            padding: 24px;
          }

          .sheet {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .brand {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
          }

          .title {
            font-size: 28px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }

          .subtitle {
            font-size: 16px;
            color: #475569;
            margin: 0 0 24px 0;
          }

          .qr-wrap {
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            padding: 20px;
            background: #ffffff;
            display: inline-flex;
          }

          .qr-wrap img {
            width: 420px;
            height: 420px;
            object-fit: contain;
            display: block;
          }

          .instructions {
            margin-top: 24px;
            max-width: 520px;
            font-size: 14px;
            line-height: 1.5;
            color: #334155;
          }

          .footer {
            margin-top: 18px;
            font-size: 12px;
            color: #64748b;
          }

          @media print {
            .sheet {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="brand">PerkValet</div>
          <h1 class="title">${safeStore}</h1>
          ${safeMerchant ? `<p class="subtitle">${safeMerchant}</p>` : ""}
          <div class="qr-wrap">
            <img id="qrImage" src="${safeQr}" alt="Store QR code" />
          </div>
          <div class="instructions">
            Place this QR code near the POS or checkout area so customers can scan,
            check in, and access available rewards and offers.
          </div>
          <div class="footer">Store QR • Printed from PerkValet</div>
        </div>
        <script>
          (function () {
            var img = document.getElementById("qrImage");

            function doPrint() {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 150);
            }

            if (img && !img.complete) {
              img.onload = doPrint;
              img.onerror = doPrint;
            } else {
              doPrint();
            }
          })();
        </script>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}