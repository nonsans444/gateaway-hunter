export interface UserProfile {
  uid: string;
  email: string;
  tier: "free" | "pro";
  trialEnd: string; // ISO String
  stripeCustomerId?: string;
  createdAt: string; // ISO String
}

export interface Offer {
  offerId: string;
  partnerName: string;
  rewardDescription: string;
  requiredAction: string;
  partner_url_base: string;
  isProOnly: boolean;
  rewardPool: string; // Unlocked only upon claim completion
  value: string; // Estimated monetary value
  category: "Gaming" | "Streaming" | "SaaS" | "Music" | "Finance";
}

export interface Claim {
  claimId: string;
  offerId: string;
  status: "pending" | "completed" | "failed";
  token: string;
  createdAt: string; // ISO String
  completedAt?: string; // ISO String
  reward?: string;
}
