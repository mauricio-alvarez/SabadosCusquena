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

## Norte hourly email

The scheduled Norte automation emails the newly generated workbook after every
successful hourly update. It uses a configured SMTP server when
`NORTE_SMTP_HOST` is present; otherwise it falls back to Gmail SMTP.

For Gmail, add these values to the root `.env` file:

```env
NORTE_EMAIL_TO=alvarez.mauri.alex@gmail.com
GMAIL_SMTP_USER=your-sender@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

Use a Gmail App Password, not the regular account password. The scheduled run
is marked as failed when workbook generation succeeds but email delivery fails,
so the error is visible in `Cortes/Norte/automation.log`.

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
