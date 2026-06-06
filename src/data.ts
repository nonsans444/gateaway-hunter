import { Offer } from "./types";

export const INITIAL_OFFERS: Offer[] = [
  {
    offerId: "discord-nitro-1m",
    partnerName: "Discord",
    rewardDescription: "1-Month Nitro Gaming Membership",
    requiredAction: "Download and launch Epic Games Launcher & claim the partner collab coupon inside the banner",
    partner_url_base: "https://discord.com/billing/promotions/epic-collab",
    isProOnly: false,
    rewardPool: "DISCORD-NITRO-EPIC-8D1F7B9C3402",
    value: "$9.99",
    category: "Gaming"
  },
  {
    offerId: "spotify-premium-3m",
    partnerName: "Spotify",
    rewardDescription: "3 Months of Premium Music Streaming",
    requiredAction: "Register a free PayPal account and activate the PayPal Rewards partner checkout voucher",
    partner_url_base: "https://www.spotify.com/us/claim/paypal-rewards",
    isProOnly: false,
    rewardPool: "SPOTIFY-PREM-3M-PP-47A119B2",
    value: "$35.97",
    category: "Music"
  },
  {
    offerId: "canva-pro-12m",
    partnerName: "Canva",
    rewardDescription: "12-Month Canva Pro Graphic Suite",
    requiredAction: "Sign up at Github Student Developer Deck using an authorized .edu credentials card",
    partner_url_base: "https://www.canva.com/education/students",
    isProOnly: false,
    rewardPool: "CANVA-PRO-EDU-STU-332A19F",
    value: "$119.99",
    category: "SaaS"
  },
  {
    offerId: "xbox-gamepass-1m",
    partnerName: "Xbox",
    rewardDescription: "1-Month Ultimate Game Pass Access",
    requiredAction: "Install the official Crunchyroll app on Android/iOS, sign up for a mega fan trial",
    partner_url_base: "https://www.xbox.com/en-US/xbox-game-pass/crunchyroll-perk",
    isProOnly: false,
    rewardPool: "XBOX-PASS-ULT-CRUNCHY-88AA92",
    value: "$16.99",
    category: "Gaming"
  },
  {
    offerId: "netflix-magenta-1m",
    partnerName: "Netflix",
    rewardDescription: "30-Day Premium 4K Netflix Coupon",
    requiredAction: "Download and register the T-Mobile Magenta status client app and tap the Magenta reward button",
    partner_url_base: "https://www.netflix.com/promo/tmobile-magenta-status",
    isProOnly: true,
    rewardPool: "NETFLIX-PREM-CODE-TMOBILE-2291A",
    value: "$22.99",
    category: "Streaming"
  },
  {
    offerId: "geforce-now-rtx",
    partnerName: "NVIDIA Geforce GSync",
    rewardDescription: "2 Months GeForce Now RTX Priority Access",
    requiredAction: "Download the GeForce Experience client application, log in, and register for G-Force Club perks",
    partner_url_base: "https://www.nvidia.com/en-us/geforce-now/rewards",
    isProOnly: true,
    rewardPool: "GEFORCE-NOW-RTX-2M-PRIORITY-9F3C2",
    value: "$19.98",
    category: "Gaming"
  },
  {
    offerId: "nordvpn-safe-3m",
    partnerName: "NordVPN",
    rewardDescription: "3-Month Full Security Guard Subscription",
    requiredAction: "Complete a verification run via the official Brave Browser desktop download page banner",
    partner_url_base: "https://nordvpn.com/risk-free-brave",
    isProOnly: true,
    rewardPool: "NORDVPN-SECURE-3MONTHS-81A22C",
    value: "$38.97",
    category: "SaaS"
  },
  {
    offerId: "notion-team-6m",
    partnerName: "Notion",
    rewardDescription: "6-Month Premium Team Collaboration Workspace",
    requiredAction: "Create a verified ProductHunt profile and upvote the current Notion AI workspace tool package",
    partner_url_base: "https://www.notion.so/product/producthunt-rewards",
    isProOnly: true,
    rewardPool: "NOTION-TEAM-6M-PRO-UPVOTE-4C8E2",
    value: "$60.00",
    category: "SaaS"
  }
];
