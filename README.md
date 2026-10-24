# Sales Orders PWA - Phase 1

## Setup (once)
1. Firebase Console > create project > Build > **Authentication** > enable **Email/Password**.
2. Build > **Firestore Database** > create (production mode).
3. Firestore > **Rules** > paste `firestore.rules` > Publish.
4. Project settings > Your apps > add **Web app** > copy config into `firebase-config.js`.
5. Authentication > Settings > Authorized domains > add `YOURNAME.github.io`.
6. Upload all files to a GitHub repo > Settings > Pages > deploy from main branch.
7. Open the site on your phone > **Create account** with your email.
8. **Make yourself admin (only once):** Firestore > `users` > your document > set `status` = `approved` and `role` = `admin`.
9. Reload. Set your PIN. Admin tab > Settings > set VAT, branches, cost PIN.

Install: Android Chrome menu > Install app. iPhone Safari > Share > Add to Home Screen.

If you change a file later, raise the version in `sw.js` (`sales-v1` to `sales-v2`) so phones update.
