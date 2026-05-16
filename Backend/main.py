import os
import re
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import login
import analytics
from zoneinfo import ZoneInfo

app = FastAPI(title="Report Extractor API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
STATIC_DIR = os.path.join(BASE_DIR, "static")
PROJECT_DIR = os.path.dirname(BASE_DIR)
REPORT_MAX_AGE_MINUTES = 20
REPORT_NAME_RE = re.compile(r"canjes-institucion_(\d{2}-\d{2}-\d{4})_(\d{2}-\d{2}-\d{2})\.xlsx$", re.IGNORECASE)
DISPLAY_TZ = ZoneInfo(os.getenv("DISPLAY_TZ", "America/Lima"))

cors_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
if not cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the downloads directory exists
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

class DashboardDataRequest(BaseModel):
    file_path: str

def _parse_report_timestamp(file_path):
    match = REPORT_NAME_RE.search(os.path.basename(file_path))
    if match:
        dt = datetime.strptime(f"{match.group(1)} {match.group(2)}", "%d-%m-%Y %H-%M-%S")
        return dt.replace(tzinfo=DISPLAY_TZ)
    return datetime.fromtimestamp(os.path.getmtime(file_path), tz=DISPLAY_TZ)

def _report_payload(file_path):
    updated_at = _parse_report_timestamp(file_path)
    now_tz = datetime.now(tz=DISPLAY_TZ)
    age_minutes = max(0, (now_tz - updated_at).total_seconds() / 60)

    return {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "updated_at": updated_at.isoformat(timespec="seconds"),
        "updated_at_display": updated_at.strftime("%d/%m/%Y %H:%M:%S"),
        "age_minutes": round(age_minutes, 1),
        "is_recent": age_minutes <= REPORT_MAX_AGE_MINUTES,
    }

def _report_files():
    search_dirs = [DOWNLOAD_DIR, PROJECT_DIR]
    files = []

    for directory in search_dirs:
        if not os.path.isdir(directory):
            continue

        for file_name in os.listdir(directory):
            file_path = os.path.join(directory, file_name)
            if os.path.isfile(file_path) and REPORT_NAME_RE.search(file_name):
                files.append(file_path)

    return files

def _latest_report():
    files = _report_files()
    if not files:
        raise HTTPException(status_code=404, detail="No downloaded reports found. Extract a new report first.")

    latest_file = max(files, key=_parse_report_timestamp)
    return _report_payload(latest_file)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/config-status")
def config_status():
    return login.get_config_status()

@app.post("/api/extract-report")
def extract_report():
    """
    Triggers the report extraction via Selenium and returns the path to the downloaded file.
    """
    try:
        # Run the extraction script
        file_path = login.run_report_extraction()
        
        if file_path and os.path.exists(file_path):
            return {
                "status": "success",
                "message": "Report downloaded successfully.",
                **_report_payload(file_path)
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to download report or timeout occurred.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dashboard-data")
def get_dashboard_data(request: DashboardDataRequest):
    try:
        data = analytics.process_dashboard_data(request.file_path)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/latest-report")
def get_latest_report():
    return _latest_report()

@app.post("/api/refresh-report")
def refresh_report():
    try:
        latest_report = _latest_report()
        if latest_report["is_recent"]:
            return {
                "status": "success",
                "source": "recent",
                "message": "Loaded the most recent report.",
                **latest_report,
            }
    except HTTPException as error:
        if error.status_code != 404:
            raise

    try:
        file_path = login.run_report_extraction()
        if file_path and os.path.exists(file_path):
            return {
                "status": "success",
                "source": "download",
                "message": "Downloaded a fresh report.",
                **_report_payload(file_path),
            }
        raise HTTPException(status_code=500, detail="Failed to download report or timeout occurred.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="Frontend build not found.")

    requested_path = os.path.abspath(os.path.join(STATIC_DIR, full_path))
    static_root = os.path.abspath(STATIC_DIR)

    if os.path.commonpath([static_root, requested_path]) == static_root and os.path.isfile(requested_path):
        return FileResponse(requested_path)

    return FileResponse(index_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
