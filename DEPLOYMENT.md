# Deploy ScholoHub with MongoDB Atlas and Render

Repository: https://github.com/devang-agarwal07/ScholoHub

Use MongoDB Atlas for the database and the single Render Web Service defined in `render.yaml` for the app. The backend serves the compiled React frontend and API on one HTTPS origin. Separate frontend/backend deployment is also described below. You do not need to run a local MongoDB server. These instructions deploy the new ScholoHub repository; older Render services linked to another repository do not automatically switch to it.

## 1. Create or select the MongoDB Atlas cluster

1. Sign in at https://cloud.mongodb.com/ and select your project.
2. Open **Database / Clusters**. Reuse an existing cluster, or click **Create** and choose **Free (M0)** if available. You can have one Free cluster per project. Wait until it is ready.
3. Under **Database Access**, create a database user, for example `scholohub_app`, with `readWrite` access to the `scholarship_db` database. Save the generated password in your password manager. This is a database user, separate from your Atlas website login.
4. Under **Network Access**, add your current public IP for the setup commands below. After creating the Render backend, also add its outbound IP ranges from **Render service → Connect → Outbound**. Add each range separately. Atlas must permit the backend's outbound addresses, rather than its public website address. If your project already permits `0.0.0.0/0`, connections are allowed from everywhere; that is broader than needed for this setup.
5. Select the cluster's **Connect → Drivers → Node.js** option and copy its URI. Replace the username/password placeholders and include the database name:

   ```text
   mongodb+srv://scholohub_app:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/scholarship_db?retryWrites=true&w=majority&serverSelectionTimeoutMS=5000
   ```

   URL-encode special characters in the password. Do not copy the local `mongodb://127.0.0.1:27018/...` URL. Keep the Atlas URI in the backend only; never put it in frontend variables or GitHub files.

Atlas runs the MongoDB server for you. There is no separate database-start command after the cluster is ready. The following commands create the application's database, collections and indexes.

## 2. Initialize the cloud database

On your computer, open the repository's `backend/` folder:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead of overwriting it. Set its `DATABASE_URL` to the Atlas URI. Then run:

```powershell
npm run db:setup
npm run db:check
npm run db:test
```

The setup creates nine core collections: `users`, `profiles`, `scholarships`, `applications`, `documents`, `document_reviews`, `workflow_actions`, `notifications`, and `audit_logs`, plus `stored_files` for persistent document content. In Atlas, open **Browse Collections** and choose `scholarship_db` to inspect them. Database verification rolls back its temporary test records.

For a demonstration environment only, you can optionally add sample users, two scholarships and a draft application:

```powershell
npm run prisma:seed
```

New demo accounts are `admin@scholarship.edu`, `verifier@scholarship.edu`, `committee@scholarship.edu`, and `student@scholarship.edu`, with password `Password123!`. This seed preserves existing data and passwords and refuses to run with `NODE_ENV=production`. Do not use these shared demo credentials for a real deployment. Public registration creates student accounts only; staff roles must be provisioned through trusted database administration. Existing staff accounts keep their roles.

## 3. Deploy the entire app on one Render service (recommended)

Create a Render **Web Service** connected to `devang-agarwal07/ScholoHub`, branch `main`. Leave **Root Directory empty** and use:

| Setting | Value |
| --- | --- |
| Build Command | `cd backend && npm ci --include=dev && npm run build && cd ../frontend && npm ci --include=dev && npm run build` |
| Start Command | `cd backend && npm run start:cloud` |
| Health Check | `/api/health` |
| `NODE_ENV` | `production` |
| `SERVE_FRONTEND` | `true` |
| `VITE_API_URL` | `/api` |
| `DATABASE_URL` | Your Atlas URI |
| `JWT_SECRET` | A random secret of at least 32 characters |
| `JWT_REFRESH_SECRET` | A different random secret of at least 32 characters |

Add Render's outbound IP ranges to Atlas as described in step 1, then deploy. The service URL serves the React app, its deep links, and `/api/*`. Refresh tokens use the HTTP-only cookie, so they do not need to be exposed in browser storage. If setting `FRONTEND_URL` for password-reset links, use this same service URL; Render's `RENDER_EXTERNAL_URL` is used when it is omitted.

Hosted uploads automatically persist in Atlas's `stored_files` collection when Cloudinary is not configured. Downloads use links valid for five minutes, issued after document authorization. Each upload is limited to 5 MB and counts toward the Atlas cluster's storage allowance. Once the single service is live, skip the separate service setup and go to **Verify the deployed application**.

## Alternative: deploy the backend and frontend separately

In https://dashboard.render.com/, choose **New → Web Service**, connect GitHub, and select `devang-agarwal07/ScholoHub`.

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `backend` |
| Language / Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:cloud` |
| Health Check Path | `/api/health` |
| Instance | Free, if appropriate for your demo |

Add these environment variables in Render. Each JWT secret must be a different random string of at least 32 characters. For example, generate each one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and copy it into Render's secret field.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your complete Atlas URI, including `/scholarship_db` |
| `JWT_SECRET` | A newly generated secret |
| `JWT_REFRESH_SECRET` | A different newly generated secret |
| `FRONTEND_URL` | Your frontend's public HTTPS URL; use the planned URL initially and replace it with the actual URL after step 4 |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |

Cloudinary is optional: set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to use it instead of MongoDB file storage. Without them, production uploads persist in Atlas, with signed download links. Development mode uses local disk unless `DOCUMENT_STORAGE=mongodb` is set.

If using email/background jobs, provision a compatible Redis service and set `REDIS_URL` plus the appropriate SMTP settings. Otherwise, leave `REDIS_URL` unset; queue producers and workers skip jobs when it is absent, so email is unavailable. Do not set it to a localhost Redis address on Render.

Create the service and add its outbound IP ranges in Atlas Network Access. If the first deploy fails before those ranges are added, deploy again after adding them. `start:cloud` runs `prisma db push` before starting the API; it does not delete the database or seed demo accounts. An incompatible unique index stops startup instead of resetting records.

Copy the backend's actual HTTPS URL. Verify `https://YOUR_BACKEND.onrender.com/api/health` returns `status: ok`. This endpoint checks the API process; use a login or the database checks above to verify database access.

### Deploy the frontend on Render

Choose **New → Static Site** and select the same ScholoHub repository.

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment variable | `VITE_API_URL=https://YOUR_BACKEND.onrender.com/api` |

Use the backend URL from step 3, including the trailing `/api` path. Never put the MongoDB URI here: `VITE_` variables are embedded in the public browser bundle.

Add a **Rewrite** rule with **Source** `/*` and **Destination** `/index.html`. This lets React routes such as `/login` work when opened directly or refreshed.

Deploy the static site, then copy its actual HTTPS URL. Update `FRONTEND_URL` on the backend to this frontend URL and save/deploy the backend. If changing `VITE_API_URL` later, rebuild/redeploy the frontend because Vite reads it at build time.

## 5. Verify the deployed application

1. Open the frontend URL and register or sign in.
2. Confirm scholarship and application pages load.
3. Verify new records appear under Atlas → Browse Collections → `scholarship_db`.
4. Upload a document and confirm its signed link opens. Hosted uploads persist in MongoDB unless Cloudinary is configured.
5. Test a direct frontend route such as `/login` with a page refresh.

If startup reports a database connection timeout, check the Atlas cluster status, URI, database password and IP access list. If login returns 401, verify the account exists in the same Atlas database and that its password is correct. If frontend requests fail, verify `VITE_API_URL` and inspect the backend's Render logs.

## Optional: Vercel frontend instead of Render Static Site

Render can host both parts; Vercel is not required. If you choose Vercel, import the same GitHub repository, set the Root Directory to `frontend`, use the Vite preset, set `VITE_API_URL` to the Render backend URL plus `/api`, and deploy. Add `frontend/vercel.json` with the following SPA rewrite before deployment:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Update the Render backend's `FRONTEND_URL` to the Vercel production URL and redeploy it.

## References

The CI workflow is provided at `.github/workflow-templates/deploy.yml`. It is inactive because the GitHub authorization used for this upload does not include the `workflow` permission. To enable GitHub Actions later, use GitHub's web editor or authorization with that permission to move the template to `.github/workflows/deploy.yml`. This is optional for Render deployment.

- MongoDB Atlas: https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- Atlas connection prerequisites: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/
- Render Express deployment: https://render.com/docs/deploy-node-express-app
- Render static sites: https://render.com/docs/static-sites
- Render outbound IPs: https://render.com/docs/outbound-ip-addresses
