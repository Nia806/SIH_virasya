# Authentication Architecture & Implementation

Virasya uses **Firebase Authentication** coupled with **Cloud Firestore** (`userProfiles` collection) for role-based access control and persistent session management.

---

## 🔐 Core Capabilities

### 1. Dual-Tab Authentication (Sign In & Sign Up)
- **Sign In Tab**:
  - Direct email and password login (`signInWithEmailAndPassword`).
  - No role selection required upfront for returning users.
  - Automatically queries the user's stored profile in Firestore (`/userProfiles/{uid}`) to route them to their designated experience:
    - **Artisan**: Directed to `/dashboard` (craft inventory, upload wizard, AI tools).
    - **Buyer**: Directed to `/marketplace` (browsing, real-time discovery, AI Q&A).
- **Create Account (Sign Up) Tab**:
  - Explicit role selection: **Artisan** (selling handcrafted art) or **Buyer** (discovering and acquiring verified crafts).
  - Collects Full Name, Email, and Password (minimum 6 characters enforced).
  - Uses `createUserWithEmailAndPassword` to register the credential.
  - Atomically creates the user document in `/userProfiles/{uid}` with `role`, `name`, `email`, default language preference, and server timestamps.

### 2. Forgot Password / Password Recovery
- Integrated via Firebase Auth's `sendPasswordResetEmail(auth, targetEmail)`.
- Dedicated "Forgot Password" view accessible with a single click from the Sign In form.
- Protects user privacy via standard email enumeration defense while delivering clear in-app success confirmation and guidance to check spam/inbox folders.
- Provides a one-click return to the Sign In form.

### 3. Smart Google OAuth Sign-In
- Triggered using `signInWithPopup(auth, GoogleAuthProvider)`.
- **Returning User**: Instantly reads their existing Firestore profile and routes them to their dashboard or marketplace without interrupting their flow.
- **New User via Sign Up Tab**: Automatically writes their profile using their selected role and Google account display name.
- **New User via Direct Sign In**: Shows a streamlined, one-click role selection step (*"I am an Artisan"* vs *"I am a Buyer"*) before finalizing their account in Firestore.

### 4. Human-Friendly Error Mapping
All Firebase Auth exceptions are parsed and mapped to clear, actionable guidance:
- `auth/invalid-credential` & `auth/wrong-password`: Prompt users to check credentials or use the reset link.
- `auth/email-already-in-use`: Informs user to switch to the Sign In tab.
- `auth/weak-password`: Instructs user to provide at least 6 characters.
- `auth/too-many-requests`: Alerts user to temporary rate limits and suggests password reset.
- `auth/popup-closed-by-user`: Handled gracefully without alarming error toasts.

### 5. UI & Accessibility Enhancements
- **Interactive Password Visibility Toggle**: Eye / Eye-off button to preview entered passwords.
- **URL Parameter Direct Routing**: Supports `?mode=signup&role=artisan` or `?mode=signin` from landing page CTAs.
- **Suspense Boundary**: Wrapped in React Suspense to ensure smooth streaming and hydration in Next.js 15 App Router.

---

## 📁 Key Files & References

| File | Purpose |
|---|---|
| `src/app/auth/page.tsx` | Main authentication view (Tabs, Google OAuth, Forms, Reset Flow) |
| `src/firebase/provider.tsx` | React Context provider managing `auth`, `user`, and `isUserLoading` |
| `src/firebase/config.ts` | Direct Firebase client configuration |
| `firestore.rules` | Security rules enforcing role-based and ownership-based data access |
| `docs/DATABASE.md` | Schema specification for `userProfiles` and dependent collections |
