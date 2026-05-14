import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import login
import analytics

app = FastAPI(title="Report Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the downloads directory exists
os.makedirs("downloads", exist_ok=True)

class DashboardDataRequest(BaseModel):
    file_path: str

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
