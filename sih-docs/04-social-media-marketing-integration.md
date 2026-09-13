# Social Media Marketing Generator & Integration

> End-to-end strategy for collecting AI-generated marketing content and forwarding it directly to WhatsApp and Instagram — seamlessly, with full formatting preserved.

---

## What Already Exists

The Gemini-powered marketing generator is fully built:

- **Flow**: `src/ai/flows/artisan-ai-marketing-generator.ts`
- **Inputs**: `productName`, `craftType`, `region`, `description`
- **Outputs**: `instagram` caption, `whatsapp` message, `hashtags[]`, `promoLine`
- **UI**: Dashboard listing cards have a "Marketing" button that opens a dialog showing the generated content

The generated content is displayed in a dialog box. There are currently **no share buttons** — the artisan has to manually copy and paste text into WhatsApp or Instagram. That is the gap this doc addresses.

---

## The Core Problem: Web Apps Cannot Directly Post to Instagram or WhatsApp

Instagram and WhatsApp do **not** allow web browsers to push posts or messages directly. You cannot call their API from a Next.js page and have a post appear. Here is exactly what each platform allows and does not allow:

| Action | Web (Next.js browser) | Mobile App (React Native) |
|---|---|---|
| Open WhatsApp with pre-filled text | ✅ `wa.me` deep link | ✅ Linking API |
| Open Instagram with pre-filled caption | ❌ Not supported | ✅ Instagram Share sheet |
| Auto-post to Instagram feed | ❌ | ❌ (requires Instagram Graph API + Business account) |
| Auto-post Story to Instagram | ❌ | ✅ Instagram Stories URL scheme (iOS only) |
| Send WhatsApp message to customer | ❌ (requires WhatsApp Business API) | ✅ Deep link |
| Copy to clipboard, user pastes | ✅ | ✅ |

---

## Strategy: Two-Tier Integration

### Tier 1 — Web (Works Today, Requires No API Keys)

Use **deep links** and **clipboard copy**. This works right now in the existing Next.js app without any new dependencies or business accounts.

#### WhatsApp Deep Link

```
https://wa.me/?text=<url-encoded-message>
```

When the artisan clicks "Share on WhatsApp", open this URL in a new tab. WhatsApp Web opens (desktop) or the WhatsApp app opens (mobile browser) with the message pre-filled. The artisan just taps Send.

**Implementation (add to the marketing dialog in `dashboard/page.tsx`):**

```tsx
const handleWhatsAppShare = () => {
  const text = `${marketingResult.whatsapp}\n\n${marketingResult.hashtags.join(' ')}`;
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
};
```

The message arrives in WhatsApp with bold, emojis, and hashtags intact — WhatsApp renders them natively.

#### Instagram — Copy + Open App

Instagram's web interface does not support pre-filling captions. The best UX is:

1. **Auto-copy** the full caption + hashtags to clipboard when the artisan clicks "Share on Instagram"
2. **Open** `https://www.instagram.com/` (or the Instagram app on mobile via deep link)
3. Show a toast: *"Caption copied! Paste it when creating your post."*

```tsx
const handleInstagramShare = async () => {
  const caption = `${marketingResult.instagram}\n\n${marketingResult.hashtags.join(' ')}`;
  await navigator.clipboard.writeText(caption);
  toast({ title: "Caption copied!", description: "Open Instagram and paste into your new post." });
  window.open('https://www.instagram.com/', '_blank');
};
```

This is the standard pattern used by Canva, Buffer, and every major creator tool for web-to-Instagram flow.

---

### Tier 2 — Mobile App (Full Native Share Sheet)

On a React Native / Expo mobile app, the native **Share Sheet** gives one-tap sharing to any installed app — WhatsApp, Instagram, Facebook, Telegram, Twitter, etc.

```tsx
import { Share } from 'react-native';

const handleNativeShare = async () => {
  const caption = `${marketingResult.instagram}\n\n${marketingResult.hashtags.join(' ')}`;
  await Share.share({
    message: caption,
    title: marketingResult.promoLine,
  });
};
```

This opens the native Android/iOS share sheet. The artisan picks WhatsApp or Instagram from the list. Formatting (bold, emojis, hashtags) is preserved exactly.

---

## Cover Image: Collecting & Forwarding the Product Photo

The marketing content is most impactful when shared **with the product image**. The current flow only generates text. Here is how to attach the image:

### Web — Navigator Share API (Progressive Enhancement)

Modern mobile browsers (Chrome Android, Safari iOS) support `navigator.share` with files:

```tsx
const handleShareWithImage = async (imageUrl: string, caption: string) => {
  if (navigator.canShare && navigator.canShare({ files: [] })) {
    // Fetch the image and convert to a File object
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'product.jpg', { type: blob.type });
    
    await navigator.share({
      files: [file],
      title: marketingResult.promoLine,
      text: caption,
    });
  } else {
    // Fallback: share text with product link
    const productUrl = `${window.location.origin}/product/${productId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(caption + '\n\n' + productUrl)}`, '_blank');
  }
};
```

`navigator.share` with files opens the native share sheet on mobile browsers. On desktop, it falls back gracefully to text-only share.

### Desktop Fallback — WhatsApp with Product Link

```tsx
const productUrl = `${window.location.origin}/product/${productId}`;
const text = `${marketingResult.whatsapp}\n\n${productUrl}\n\n${marketingResult.hashtags.join(' ')}`;
window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
```

---

## Instagram Graph API (Advanced — For Business Accounts)

If the artisan has an **Instagram Business account** linked to a **Facebook Page**, the Graph API allows fully automated posting.

### Prerequisites

1. Facebook Developer App (free at developers.facebook.com)
2. Instagram Business or Creator account
3. Long-lived User Access Token with `instagram_basic`, `instagram_content_publish` permissions

### Posting Flow

```
Step 1: Create a media container
POST https://graph.facebook.com/v20.0/{ig-user-id}/media
  ?image_url=<publicly-accessible-image-url>
  &caption=<caption-with-hashtags>
  &access_token=<token>
→ Returns: { id: "container_id" }

Step 2: Publish the container
POST https://graph.facebook.com/v20.0/{ig-user-id}/media_publish
  ?creation_id=<container_id>
  &access_token=<token>
→ Returns: { id: "post_id" }
```

**Important constraints:**
- Image must be a publicly accessible HTTPS URL (not base64, not localhost)
- For hackathon: store images in Firebase Cloud Storage (public URL) before posting
- Access tokens expire — need token refresh flow or long-lived tokens stored in Firestore
- Rate limit: 50 API calls per user per 24 hours

### Where to Store the Token

Store the Instagram access token in the artisan's Firestore document:

```
/users/{userId}/socialAccounts/instagram
  accessToken: "..."
  igUserId: "..."
  tokenExpiry: Timestamp
```

The Next.js API route reads this token server-side. The token never touches the client.

---

## WhatsApp Business API (Advanced — For Customer Messaging)

This is different from the `wa.me` deep link. The WhatsApp Business API lets you send messages **to your customers** programmatically — order confirmations, shipping updates, promotional broadcasts.

### Provider Options (Ranked by Ease)

| Provider | Free Tier | Setup Time | Best For |
|---|---|---|---|
| **Twilio WhatsApp** | 1,000 conversations/month free | 1–2 hours | Hackathon demo |
| **Meta Cloud API** (official) | Free | 1–2 days (Meta review) | Production |
| **Wati** | Trial available | 30 mins | Quick demo |

### Twilio WhatsApp Setup (Recommended for Demo)

1. Sign up at twilio.com (free)
2. Enable WhatsApp Sandbox: text "join [word]" to Twilio's sandbox number
3. Use Twilio's API to send messages:

```ts
// src/app/api/whatsapp-notify/route.ts
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  const { to, message } = await req.json();
  
  const msg = await client.messages.create({
    from: 'whatsapp:+14155238886', // Twilio sandbox number
    to: `whatsapp:${to}`,
    body: message,
  });
  
  return Response.json({ sid: msg.sid });
}
```

---

## Formatting Preservation

| Format | WhatsApp | Instagram |
|---|---|---|
| **Bold** | Wrap with `*text*` → renders bold | No markdown; use emojis for emphasis |
| _Italic_ | Wrap with `_text_` → renders italic | Not applicable |
| Emojis 🎨🪡 | Fully supported | Fully supported |
| #hashtags | Clickable links | Clickable links |
| Line breaks | `\n` preserved | `\n` preserved |
| URLs | Clickable with preview | Clickable links |

**Update the Gemini prompt** to include WhatsApp markdown formatting:

```ts
// In artisan-ai-marketing-generator.ts prompt:
`WhatsApp message: Max 25 words. Use *bold* for the product name. Include 2-3 emojis.`
```

---

## Implementation Roadmap

### Phase 1 — Immediate (1–2 hours, no new dependencies, no new accounts)

Add share buttons to the existing marketing dialog in `src/app/dashboard/page.tsx`:

- [ ] "📱 Send on WhatsApp" button → `wa.me` deep link with pre-filled message + hashtags
- [ ] "📷 Copy Caption for Instagram" button → clipboard copy + open instagram.com + toast
- [ ] "📋 Copy All Content" button → copy full formatted content to clipboard
- [ ] Update Gemini prompt to output `*bold*` WhatsApp markdown formatting in whatsapp field

**Code to add to the marketing dialog (after the promo line block):**

```tsx
<div className="flex flex-col gap-3 pt-2 border-t border-primary/10">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Share</p>
  <Button
    onClick={() => {
      const text = `${marketingResult.whatsapp}\n\n${marketingResult.hashtags.join(' ')}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }}
    className="w-full rounded-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
  >
    <MessageSquare className="h-4 w-4" />
    Send on WhatsApp
  </Button>
  <Button
    onClick={async () => {
      const caption = `${marketingResult.instagram}\n\n${marketingResult.hashtags.join(' ')}`;
      await navigator.clipboard.writeText(caption);
      toast({ title: "Caption copied!", description: "Paste it into your Instagram post." });
      window.open('https://www.instagram.com/', '_blank');
    }}
    variant="outline"
    className="w-full rounded-full gap-2 border-pink-300 text-pink-600 hover:bg-pink-50"
  >
    <Camera className="h-4 w-4" />
    Copy Caption for Instagram
  </Button>
</div>
```

### Phase 2 — Mobile Browser Enhancement (2–3 hours)

- [ ] Add `navigator.share` with image File for mobile browsers (product photo + caption)
- [ ] Detect `navigator.canShare` and show appropriate share UI (native vs deep link)
- [ ] Include product listing URL in WhatsApp message as a clickable product link

### Phase 3 — Instagram Graph API (4–8 hours, requires Business account)

- [ ] Create Facebook Developer App
- [ ] Build OAuth flow for artisan to connect their Instagram Business account
- [ ] Store access token in Firestore under `/users/{userId}/socialAccounts/instagram`
- [ ] Build `POST /api/instagram/post` API route using Graph API two-step publish
- [ ] Add "Post to Instagram" button that calls this route directly (no copy-paste)
- [ ] Requires images in Cloud Storage (public HTTPS URL) — migrate images from base64 first

### Phase 4 — WhatsApp Business API (2–4 hours + Twilio signup)

- [ ] Add Twilio credentials to `.env.local`
- [ ] Build `POST /api/whatsapp-notify` route
- [ ] Send automated order confirmation via WhatsApp when a purchase is made
- [ ] Optional: allow artisans to broadcast new product announcements to opted-in customers

---

## Environment Variables Needed

```env
# Phase 3 — Instagram Graph API
INSTAGRAM_APP_ID=your_facebook_app_id
INSTAGRAM_APP_SECRET=your_facebook_app_secret

# Phase 4 — WhatsApp Business (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Summary: Is This All Possible?

**Yes. Here is the honest breakdown:**

| Feature | Difficulty | Free? | Works on Web? | Works on Mobile? |
|---|---|---|---|---|
| WhatsApp deep link share | ⭐ Easy | ✅ Free | ✅ Yes | ✅ Yes |
| Instagram caption copy + open | ⭐ Easy | ✅ Free | ✅ Yes | ✅ Yes |
| Native share sheet with image | ⭐⭐ Medium | ✅ Free | ✅ Mobile browsers | ✅ Yes |
| Instagram Graph API auto-post | ⭐⭐⭐ Hard | ✅ Free (limited) | ✅ Server-side | ✅ Server-side |
| WhatsApp Business broadcast | ⭐⭐ Medium | ✅ Twilio free tier | ✅ Server-side | ✅ Server-side |

**For the hackathon demo:** Phase 1 is 1–2 hours of work, produces a live "Share on WhatsApp" and "Copy for Instagram" feature that judges can try on their phones, requires zero new accounts, zero API keys, and zero cost.

**For production:** Phase 3 + 4 gives fully automated posting and customer messaging — the complete seamless integration with full formatting preserved.
