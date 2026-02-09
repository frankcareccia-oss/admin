// admin/src/pages/AdminMerchantUsers.jsx
import React from "react";
import MerchantUsers from "./MerchantUsers";

/**
 * AdminMerchantUsers
 *
 * This keeps the /merchants/:merchantId/users route working
 * by reusing the already-built MerchantUsers (Team) UI.
 */
export default function AdminMerchantUsers() {
  return <MerchantUsers />;
}
