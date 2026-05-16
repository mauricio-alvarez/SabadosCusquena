# Sabados Cusquena

Full-stack dashboard for extracting campaign reports with Selenium and showing the results in a React dashboard.

## Local Development

Create a `.env` file in the repository root:

```env
URL=https://example.com/login
REPORT_USER=your-user
PASSWORD=your-password
```

Run the backend:

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Run the frontend:

```bash
cd Frontend
corepack pnpm install
corepack pnpm run dev
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Deploy on Render

This repo includes a `Dockerfile` and `render.yaml` for a single Render web service. The Docker image builds the Vite frontend, installs Chromium and Chromedriver for Selenium, runs FastAPI, and serves the frontend from the same public URL as the API.

1. Open Render and create a new Blueprint from this repository.
2. Use the default `render.yaml`.
3. When Render asks for environment variables, set:
   - `URL`: login URL for the reporting system.
   - `REPORT_USER`: reporting system username. The backend also accepts `USER`, but `REPORT_USER` is safer because some platforms reserve `USER` for the operating system account.
   - `PASSWORD`: reporting system password.
4. Deploy the service.

After deployment, open the Render URL and verify `/api/health` returns `{"status":"ok"}`.
You can also open `/api/config-status` to confirm whether the required environment variables are visible to the running backend. It returns booleans only, not secret values.
