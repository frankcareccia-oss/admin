/**
 * Merchant type constants — shared across create form, detail edit, and settings.
 * ENUM values must match backend VALID_MERCHANT_TYPES in merchant.routes.js.
 */

export const MERCHANT_TYPE_OPTIONS = [
  { value: "coffee_shop",    label: "Coffee shop / café" },
  { value: "restaurant",     label: "Restaurant" },
  { value: "fitness",        label: "Fitness / gym" },
  { value: "salon_spa",      label: "Salon / spa" },
  { value: "retail",         label: "Retail store" },
  { value: "grocery",        label: "Grocery / market" },
  { value: "pet_services",   label: "Pet services" },
  { value: "automotive",     label: "Automotive services" },
  { value: "specialty_food", label: "Specialty food" },
  { value: "education_kids", label: "Kids / education" },
];

export const MERCHANT_TYPE_LABELS = Object.fromEntries(
  MERCHANT_TYPE_OPTIONS.map(o => [o.value, o.label])
);

/** Detect likely merchant type from the merchant name. Returns a value or null. */
export function detectMerchantType(name) {
  const n = String(name || "").toLowerCase();
  if (/coffee|brew|café|cafe|espresso|roast|bean/.test(n))        return "coffee_shop";
  if (/fit|gym|sport|perf|wellness|yoga|crossfit|train/.test(n))  return "fitness";
  if (/restaurant|bistro|grill|kitchen|eatery|diner|pizza|taco|burger/.test(n)) return "restaurant";
  if (/salon|spa|hair|nail|beauty|skin/.test(n))                   return "salon_spa";
  if (/grocer|supermarket|food market/.test(n))                    return "grocery";
  if (/pet|paw|animal|vet/.test(n))                               return "pet_services";
  if (/auto|car |tire|motor|mechanic/.test(n))                    return "automotive";
  if (/bakery|deli|cheese|wine|specialty food/.test(n))           return "specialty_food";
  if (/kid|child|tutor|school|educat|learn/.test(n))              return "education_kids";
  if (/shop|store|boutique|market|retail/.test(n))                return "retail";
  return null;
}
