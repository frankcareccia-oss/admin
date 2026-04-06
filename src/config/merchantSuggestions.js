/**
 * merchantSuggestions.js
 *
 * Static 2-option suggestion sets per merchant type, per entity type.
 * Used by SuggestionBanner to pre-fill create forms for merchant owners/admins.
 *
 * Products  → pre-fills: name, description
 * Promotions → pre-fills: name, threshold, rewardType, rewardNote, timeframeDays, scope
 * Bundles   → pre-fills: name, price
 */

export const MERCHANT_SUGGESTIONS = {
  coffee_shop: {
    products: [
      { name: "Drip Coffee",    description: "12 oz house-brewed drip coffee" },
      { name: "Espresso Drink", description: "Espresso-based beverage — double shot" },
    ],
    promotions: [
      { name: "10th Coffee Free", threshold: 10, rewardType: "custom", rewardNote: "Free drip coffee of your choice",   timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Treat",    threshold: 5,  rewardType: "custom", rewardNote: "Free pastry or snack",              timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Coffee 10-Pack",   price: "45.00" },
      { name: "Morning Bundle 5", price: "22.00" },
    ],
  },

  restaurant: {
    products: [
      { name: "Entrée",     description: "Main course item" },
      { name: "Appetizer",  description: "Starter or small plate" },
    ],
    promotions: [
      { name: "10th Entrée Free",  threshold: 10, rewardType: "custom", rewardNote: "Free entrée of equal or lesser value", timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Dessert",   threshold: 5,  rewardType: "custom", rewardNote: "Free dessert",                          timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Lunch Pack 10",  price: "120.00" },
      { name: "Dinner Bundle 5", price: "75.00" },
    ],
  },

  fitness: {
    products: [
      { name: "Drop-In Class",              description: "Single session / drop-in visit" },
      { name: "Personal Training Session",  description: "1-on-1 session with a trainer" },
    ],
    promotions: [
      { name: "10th Class Free", threshold: 10, rewardType: "custom", rewardNote: "Free drop-in class",          timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Perk",    threshold: 5,  rewardType: "custom", rewardNote: "Free smoothie or protein bar", timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Class Pack 10", price: "120.00" },
      { name: "Class Pack 5",  price: "65.00" },
    ],
  },

  salon_spa: {
    products: [
      { name: "Haircut", description: "Standard cut and style" },
      { name: "Blowout", description: "Wash and blowout styling" },
    ],
    promotions: [
      { name: "6th Visit Free",    threshold: 6, rewardType: "custom", rewardNote: "Free blowout or equivalent service",  timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Upgrade",   threshold: 5, rewardType: "custom", rewardNote: "Free deep conditioning treatment",    timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Haircut Pack 5",  price: "175.00" },
      { name: "Style Bundle 3",  price: "105.00" },
    ],
  },

  retail: {
    products: [
      { name: "General Merchandise", description: "In-store retail item" },
      { name: "Gift Item",            description: "Gift or specialty retail item" },
    ],
    promotions: [
      { name: "10-Purchase Reward", threshold: 10, rewardType: "custom", rewardNote: "10% off next purchase",             timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Discount",   threshold: 5,  rewardType: "custom", rewardNote: "Free tote bag or gift with purchase", timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Shopping Credit $100", price: "90.00" },
      { name: "Shopping Credit $50",  price: "45.00" },
    ],
  },

  grocery: {
    products: [
      { name: "Grocery Purchase", description: "General grocery or market purchase" },
      { name: "Prepared Item",    description: "Ready-to-eat item or prepared food" },
    ],
    promotions: [
      { name: "10th Visit Reward", threshold: 10, rewardType: "custom", rewardNote: "Free reusable bag or small item",   timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Discount",  threshold: 5,  rewardType: "custom", rewardNote: "$5 off next purchase over $30",     timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Market Credit $100", price: "90.00" },
      { name: "Market Credit $50",  price: "45.00" },
    ],
  },

  pet_services: {
    products: [
      { name: "Grooming Session", description: "Full groom — bath, cut, and style" },
      { name: "Boarding Night",   description: "One night of pet boarding" },
    ],
    promotions: [
      { name: "6th Groom Free",  threshold: 6, rewardType: "custom", rewardNote: "Free standard groom",    timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Treat",   threshold: 5, rewardType: "custom", rewardNote: "Free bag of treats",     timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Groom Pack 5", price: "200.00" },
      { name: "Groom Pack 3", price: "120.00" },
    ],
  },

  automotive: {
    products: [
      { name: "Oil Change", description: "Standard oil and filter change" },
      { name: "Car Wash",   description: "Full-service exterior and interior wash" },
    ],
    promotions: [
      { name: "5th Oil Change Free", threshold: 5, rewardType: "custom", rewardNote: "Free standard oil change", timeframeDays: 730, scope: "merchant" },
      { name: "4-Visit Discount",    threshold: 4, rewardType: "custom", rewardNote: "$20 off next service",      timeframeDays: 365, scope: "merchant" },
    ],
    bundles: [
      { name: "Oil Change Pack 5",  price: "120.00" },
      { name: "Car Wash Pack 10",   price: "85.00" },
    ],
  },

  specialty_food: {
    products: [
      { name: "Specialty Item", description: "Artisan or specialty food product" },
      { name: "Prepared Food",  description: "Ready-made meal or specialty dish" },
    ],
    promotions: [
      { name: "10th Item Free",    threshold: 10, rewardType: "custom", rewardNote: "Free item of equal or lesser value",  timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Reward",    threshold: 5,  rewardType: "custom", rewardNote: "Free sample pack or small item",      timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Tasting Credit $75",  price: "68.00"  },
      { name: "Food Credit $150",    price: "135.00" },
    ],
  },

  education_kids: {
    products: [
      { name: "Class Session", description: "Single class or activity session" },
      { name: "Workshop",      description: "Specialty workshop or enrichment event" },
    ],
    promotions: [
      { name: "10th Session Free", threshold: 10, rewardType: "custom", rewardNote: "Free class session",            timeframeDays: 365, scope: "merchant" },
      { name: "5-Visit Reward",    threshold: 5,  rewardType: "custom", rewardNote: "Free materials kit or book",    timeframeDays: 180, scope: "merchant" },
    ],
    bundles: [
      { name: "Class Pack 10", price: "150.00" },
      { name: "Class Pack 5",  price: "80.00"  },
    ],
  },
};

/** Returns [suggestion, suggestion] for the given type+entity, or null if not defined. */
export function getSuggestions(merchantType, entityType) {
  return MERCHANT_SUGGESTIONS[merchantType]?.[entityType] || null;
}
