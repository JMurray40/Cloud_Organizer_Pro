# OAuth Provider Setup Guide

Each provider below is already wired into the codebase. To activate a provider,
you only need to complete the steps in its section, then add the two environment
variables to the `fileorbit-api` service in your Render dashboard and redeploy.

The redirect URI for every provider follows this pattern:
```
https://fileorbit-api.onrender.com/api/oauth/callback/<provider_key>
```
Replace `fileorbit-api.onrender.com` with your actual API hostname if it differs.

---

## Google Drive

**Provider key:** `google_drive`  
**Redirect URI:** `https://fileorbit-api.onrender.com/api/oauth/callback/google_drive`

### Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com) and sign in.
2. Click the project dropdown at the top → **New Project** → give it a name (e.g. `FileOrbit`) → **Create**.
3. In the left sidebar: **APIs & Services** → **Library**.
4. Search for **Google Drive API** → click it → **Enable**.
5. **APIs & Services** → **OAuth consent screen**.
   - User Type: **External** → **Create**.
   - Fill in App name (`FileOrbit`), User support email, Developer contact email → **Save and Continue**.
   - Scopes: click **Add or Remove Scopes** → search for and add:
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
     - `openid`, `email`, `profile`
   - **Save and Continue** through the rest.
   - Under **Test users**: add your own Google account so you can test before publishing.
6. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `FileOrbit API`.
   - Under **Authorized redirect URIs**: click **Add URI** and paste the redirect URI above.
   - **Create** → copy the **Client ID** and **Client Secret**.
7. In Render dashboard → `fileorbit-api` service → **Environment** → add:
   - `GOOGLE_CLIENT_ID` = the Client ID you copied
   - `GOOGLE_CLIENT_SECRET` = the Client Secret you copied
8. Also add (if not already set):
   - `API_BASE_URL` = `https://fileorbit-api.onrender.com`
   - `FRONTEND_URL` = `https://fileorbit-frontend.onrender.com`
9. **Manual Deploy** → **Deploy latest commit**.

> **Note:** While in testing mode (step 5), only accounts listed as Test Users can connect.
> To open it to all users, go back to OAuth consent screen → **Publish App**.

---

## Dropbox

**Provider key:** `dropbox`  
**Redirect URI:** `https://fileorbit-api.onrender.com/api/oauth/callback/dropbox`

### Steps

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps) and sign in.
2. Click **Create app**.
   - Choose **Scoped access**.
   - Choose **Full Dropbox** (gives access to all files, not just an app folder).
   - Name your app (e.g. `FileOrbit`).
   - **Create app**.
3. On the app settings page, under **OAuth 2**:
   - In **Redirect URIs**, paste the redirect URI above → **Add**.
4. Under the **Permissions** tab, enable:
   - `files.metadata.read`
   - `account_info.read`
   - Click **Submit**.
5. Back on the **Settings** tab, copy the **App key** (Client ID) and **App secret** (Client Secret).
6. In Render dashboard → `fileorbit-api` → **Environment** → add:
   - `DROPBOX_CLIENT_ID` = App key
   - `DROPBOX_CLIENT_SECRET` = App secret
7. **Manual Deploy** → **Deploy latest commit**.

> **Note:** New Dropbox apps start in Development mode (3 users max).
> To go to Production, click **Apply for Production** on the app settings page.

---

## OneDrive (Microsoft)

**Provider key:** `onedrive`  
**Redirect URI:** `https://fileorbit-api.onrender.com/api/oauth/callback/onedrive`

### Steps

1. Go to [Azure Portal](https://portal.azure.com) and sign in with a Microsoft account.
2. Search for **App registrations** → **New registration**.
   - Name: `FileOrbit`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: select **Web** and paste the redirect URI above.
   - **Register**.
3. Copy the **Application (client) ID** — this is your Client ID.
4. In the left sidebar: **Certificates & secrets** → **New client secret**.
   - Description: `FileOrbit Production`.
   - Expiry: choose **24 months** (you will need to rotate it before it expires).
   - **Add** → copy the **Value** immediately (it won't be shown again).
5. In the left sidebar: **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
   - Add: `Files.Read`, `User.Read`, `offline_access`.
   - **Add permissions** → **Grant admin consent** (if you have admin rights; otherwise skip and users will consent individually).
6. In Render dashboard → `fileorbit-api` → **Environment** → add:
   - `ONEDRIVE_CLIENT_ID` = Application (client) ID
   - `ONEDRIVE_CLIENT_SECRET` = the secret Value you copied
7. **Manual Deploy** → **Deploy latest commit**.

> **Note:** The client secret expires. Set a calendar reminder to rotate it before the expiry date.

---

## Box

**Provider key:** `box`  
**Redirect URI:** `https://fileorbit-api.onrender.com/api/oauth/callback/box`

### Steps

1. Go to [Box Developer Console](https://app.box.com/developers/console) and sign in.
2. Click **Create New App**.
   - Select **Custom App** → **Next**.
   - Authentication method: **Standard OAuth 2.0 (User Authentication)** → **Next**.
   - App name: `FileOrbit` → **Create App**.
3. On the **Configuration** tab:
   - Under **OAuth 2.0 Redirect URI**, paste the redirect URI above.
   - Under **Application Scopes**, check:
     - **Read all files and folders stored in Box**
     - **Write all files and folders stored in Box** (optional, for future upload support)
   - **Save Changes**.
4. Copy the **Client ID** and **Client Secret** from the Configuration tab.
5. In Render dashboard → `fileorbit-api` → **Environment** → add:
   - `BOX_CLIENT_ID` = Client ID
   - `BOX_CLIENT_SECRET` = Client Secret
6. **Manual Deploy** → **Deploy latest commit**.

> **Note:** New Box apps require approval to access accounts outside your own.
> For personal use, you can authorize just your own Box account immediately.
> For broader access, submit for **App Authorization** in the Box Admin Console.

---

## Amazon Photos

**Provider key:** `amazon_photos`  
**Redirect URI:** `https://fileorbit-api.onrender.com/api/oauth/callback/amazon_photos`

### Important limitation

Amazon closed the Amazon Drive API (which Amazon Photos is built on) to new
third-party developers in **August 2019**. No new applications can be approved
to read photo metadata or storage quota through an official API.

What FileOrbit can do: use **Login with Amazon (LWA)** to authenticate you with
your real Amazon account and record your name and email. Storage quota is shown
as unlimited (which is accurate — Amazon Photos gives Prime members unlimited
photo storage). You then use Scan or Drop to manually track which photos you
have there.

### Steps

1. Go to [Amazon Developer Console](https://developer.amazon.com) and sign in
   with your Amazon account.
2. In the top menu: **Apps & Services** → **Login with Amazon**.
3. Click **Create a New Security Profile**.
   - Name: `FileOrbit`
   - Description: `Cloud file organizer`
   - Privacy Notice URL: your site URL (or `https://fileorbit-frontend.onrender.com`)
   - **Save**.
4. Click the gear icon next to your new profile → **Web Settings**.
   - Under **Allowed Return URLs**, paste the redirect URI above → **Add**.
   - **Save**.
5. Back on the Security Profile list, click the gear → **Security Profile** to
   see your **Client ID** and **Client Secret**.
6. In Render dashboard → `fileorbit-api` → **Environment** → add:
   - `AMAZON_CLIENT_ID` = Client ID
   - `AMAZON_CLIENT_SECRET` = Client Secret
7. **Manual Deploy** → **Deploy latest commit**.

> Amazon Photos is unlimited for Prime members, so no storage quota bar is shown
> after connecting — this is expected and correct.

---

## iCloud Drive

iCloud Drive does not offer a public OAuth API. Apple provides **Sign in with Apple**
for identity only — it does not grant access to a user's iCloud Drive files.

FileOrbit keeps iCloud as a **manual tracking** entry: you add your account details
and then use Scan or Drop to record which files you have there. No code changes
are needed; this is the current behavior when iCloud is selected.

---

---

## Backblaze B2

**Provider key:** `backblaze_b2`  
**Auth model:** Application Keys — no OAuth redirect, no env vars required

Backblaze B2 does not support OAuth 2.0. Instead, users generate an Application
Key in their Backblaze dashboard and paste it directly into FileOrbit. The app
verifies the key against the B2 API before saving it.

Storage quota is not shown — B2 is pay-as-you-go with no fixed quota.

### Steps (per-user, done inside the app)

The user does this themselves when they click "Connect Backblaze B2":

1. Log into [backblaze.com](https://www.backblaze.com) and go to **B2 Cloud Storage**.
2. In the left sidebar: **App Keys** → **Add a New Application Key**.
   - Name: `FileOrbit` (or anything descriptive)
   - Allow access to: **All Buckets** (or a specific bucket)
   - Type of access: **Read and Write**
   - Leave other settings as defaults → **Create New Key**.
3. Copy the **keyID** and **applicationKey** shown (the key is only displayed once).
4. In FileOrbit → Cloud Accounts → Connect Account → pick **Backblaze B2**.
5. Enter a nickname, paste the Key ID and Application Key → click **Connect**.

FileOrbit verifies the credentials with Backblaze and saves the account.

> No Render environment variables are needed for Backblaze — credentials come
> directly from the user, not the app configuration.

---

## MEGA

**Provider key:** `mega`  
**Auth model:** Manual tracking only

MEGA does not offer a public third-party OAuth API. Their developer registration
portal has been inaccessible since approximately 2023, and MEGA's end-to-end
encryption means server-side file access without the user's password is
architecturally impossible.

FileOrbit adds MEGA as a **manual tracking** account: you enter your account
details (nickname + email), then use Scan or Drop to record which files you
have there. No setup steps required — just pick MEGA from the provider list
and fill in the form.

If MEGA ever publishes a supported third-party API, adding real integration
would follow the same pattern as Dropbox: add exchange/getUserInfo functions in
`artifacts/api-server/src/routes/oauth-callback.ts` and update the `connectMode`
in `artifacts/api-server/src/routes/oauth.ts`.

---

## Claude Prompt (to use later)

If you want to hand this work to Claude in a future session, paste the following:

```
I'm working on the FileOrbit app (Cloud_Organizer_Pro repo). The app has real
OAuth implemented for Google Drive, Dropbox, OneDrive, and Box. The code lives in:

  artifacts/api-server/src/routes/oauth.ts         (connect route + provider registry)
  artifacts/api-server/src/routes/oauth-callback.ts (token exchange + user info per provider)
  lib/db/src/schema/oauth-tokens.ts                 (stores access/refresh tokens)
  render.yaml                                       (env var declarations)

I have completed the setup for [PROVIDER NAME] on the provider's developer portal.
My credentials are:
  Client ID:     [paste here]
  Client Secret: [paste here]

Please:
1. Confirm the redirect URI I should have registered: https://fileorbit-api.onrender.com/api/oauth/callback/[provider_key]
2. Tell me the exact Render env var names to add for this provider (they are already
   declared in render.yaml and the code — I just need to set the values in the dashboard).
3. Verify the oauth-callback.ts handler for this provider looks correct.
4. Let me know if anything needs updating before I redeploy.
```
