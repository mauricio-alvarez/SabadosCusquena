import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import login
import analytics

app = FastAPI(title="Report Extractor API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
STATIC_DIR = os.path.join(BASE_DIR, "static")

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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

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
                "file_path": file_path
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
    xlsx_files = [
        os.path.join(DOWNLOAD_DIR, file_name)
        for file_name in os.listdir(DOWNLOAD_DIR)
        if file_name.endswith(".xlsx")
    ]

    if not xlsx_files:
        raise HTTPException(status_code=404, detail="No downloaded reports found. Extract a new report first.")

    latest_file = max(xlsx_files, key=os.path.getctime)
    return {"file_path": latest_file}

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
