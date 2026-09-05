import os
import shutil
import time
from datetime import datetime
from tempfile import TemporaryDirectory

from filelock import FileLock
import report_store
from dotenv import dotenv_values, load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Load environment variables from .env file in the parent directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
dotenv_values_map = dotenv_values(dotenv_path)
load_dotenv(dotenv_path)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DOWNLOAD_TIMEOUT_SECONDS = 240

def _clean(value):
    if isinstance(value, str):
        value = value.strip()
    return value or None

def _get_config_value(*names):
    for name in names:
        value = _clean(os.getenv(name)) or _clean(dotenv_values_map.get(name))
        if value:
            return value
    return None


def _get_download_timeout_seconds(override=None):
    raw_value = override
    if raw_value is None:
        raw_value = _get_config_value("REPORT_DOWNLOAD_TIMEOUT_SECONDS")
    if not raw_value:
        return DEFAULT_DOWNLOAD_TIMEOUT_SECONDS

    try:
        timeout_seconds = int(raw_value)
    except ValueError as error:
        raise ValueError(
            "REPORT_DOWNLOAD_TIMEOUT_SECONDS must be a positive integer."
        ) from error

    if timeout_seconds <= 0:
        raise ValueError(
            "REPORT_DOWNLOAD_TIMEOUT_SECONDS must be a positive integer."
        )
    return timeout_seconds

def get_config_status():
    return {
        "URL": bool(_get_config_value("URL")),
        "REPORT_USER_or_USER": bool(_get_config_value("REPORT_USER", "PORTAL_USER", "USER")),
        "PASSWORD": bool(_get_config_value("PASSWORD")),
    }

def run_report_extraction(download_timeout_seconds=None):
    directory = report_store.data_directory()
    directory.mkdir(parents=True, exist_ok=True)
    # Serialize the whole refresh, including reading the checkpoint. This also
    # protects multiple API workers and command-line invocations on this disk.
    with FileLock(str(directory / ".canjes-refresh.lock"), timeout=0):
        baseline = report_store.existing_report(directory, os.path.dirname(BASE_DIR))
        start_day = report_store.checkpoint_day(baseline)
        end_day = datetime.now(report_store.LIMA_TZ).date()
        if start_day > end_day:
            raise ValueError("The canjes checkpoint is in the future.")
        print(f"Downloading canjes from {start_day} through {end_day} (Lima).")
        with TemporaryDirectory(prefix=".canjes-download-", dir=directory) as download_dir:
            downloaded = _download_report(
                start_day, end_day, download_dir, download_timeout_seconds
            )
            if not downloaded:
                return None
            return report_store.append_report(
                baseline, downloaded, directory, start_day, end_day
            )


def _download_report(start_day, end_day, download_dir, download_timeout_seconds=None):
    url = _get_config_value("URL")
    report_user = _get_config_value("REPORT_USER", "PORTAL_USER", "USER")
    password = _get_config_value("PASSWORD")

    missing = []
    if not url:
        missing.append("URL")
    if not report_user:
        missing.append("REPORT_USER (or USER)")
    if not password:
        missing.append("PASSWORD")

    if missing:
        message = f"Missing environment variable(s): {', '.join(missing)}."
        print(f"Error: {message}")
        raise ValueError(message)

    print("Setting up Chrome driver...")
    # Setup Chrome options
    options = webdriver.ChromeOptions()
    chrome_binary = os.getenv("CHROME_BIN")
    if chrome_binary:
        options.binary_location = chrome_binary

    options.add_argument("--headless=new") # Modern headless mode
    options.add_argument("--window-size=1920,1080") # Prevent responsive layout issues
    options.add_argument("--start-maximized")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    # Configure download directory
        
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    options.add_experimental_option("prefs", prefs)

    chromedriver_path = os.getenv("CHROMEDRIVER_PATH") or shutil.which("chromedriver")
    if chromedriver_path:
        service = Service(chromedriver_path)
    else:
        service = Service(ChromeDriverManager().install())

    driver = webdriver.Chrome(service=service, options=options)

    try:
        print(f"Navigating to {url}...")
        driver.get(url)

        # Wait for the password input to be present to ensure the page has loaded
        wait = WebDriverWait(driver, 15)
        
        print("Looking for input fields...")
        # Usually password input has type="password"
        password_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='password']")))
        
        # Username is usually an input of type text, email, or a generic input before the password
        inputs = driver.find_elements(By.TAG_NAME, "input")
        username_input = None
        for input_element in inputs:
            input_type = input_element.get_attribute("type")
            if input_type in ["text", "email"] or not input_type:
                username_input = input_element
                break
        
        # Fallback if no specific type is found
        if not username_input:
            username_input = driver.find_element(By.XPATH, "//input[not(@type='password') and not(@type='hidden')]")

        print("Entering credentials...")
        username_input.send_keys(report_user)
        password_input.send_keys(password)

        print("Submitting the form...")
        # Try to find a submit button, or fallback to pressing Enter on the password field
        try:
            submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")
            submit_button.click()
        except:
            print("Specific submit button not found, pressing Enter on the password field instead.")
            password_input.submit()
            
        print("Login action completed. Waiting for the dashboard to load...")
        dashboard_wait = WebDriverWait(driver, 30)
        
        # 1. Click on Reportes in the left panel
        try:
            print("Looking for 'Reportes' link...")
            reportes_link = dashboard_wait.until(EC.element_to_be_clickable(
                (By.XPATH, "//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reportes')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reportes')] | //span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reportes')]")
            ))
            reportes_link.click()
            print("Clicked on 'Reportes'.")
        except Exception as e:
            print(f"Could not find or click 'Reportes': {e}")
            
        # 2. Fill date inputs using the popover calendar
        try:
            print("Looking for date button...")
            time.sleep(3) # Wait for page to render
            
            # Click the date button to open popover
            date_button = dashboard_wait.until(EC.element_to_be_clickable((By.ID, "date")))
            date_button.click()
            
            # Wait for calendar to be fully visible
            time.sleep(2)
            
            select_calendar_range(driver, start_day, end_day)

            # Press escape to close the popover just in case it blocks the export button
            webdriver.ActionChains(driver).send_keys(u'\ue00c').perform() # Escape key
            print("Date range selected.")
                
        except Exception as e:
            raise RuntimeError("Could not select the requested canjes date range; export cancelled.") from e
        
        # 3. Look for the 'Exportar Excel' button and click it
        try:
            print("Looking for 'Exportar Excel' button...")
            export_button = dashboard_wait.until(EC.element_to_be_clickable(
                (By.XPATH, "//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')] | //button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')]")
            ))
            
            start_time = time.monotonic()
            export_button.click()

            timeout = _get_download_timeout_seconds(download_timeout_seconds)
            print(
                "Export button clicked! Waiting up to "
                f"{timeout} seconds for the download to complete..."
            )

            downloaded_file = None
            
            while time.monotonic() - start_time < timeout:
                files = os.listdir(download_dir)
                crdownloads = [
                    f for f in files
                    if (f.endswith('.crdownload') or f.endswith('.tmp'))
                ]
                if not crdownloads:
                    xlsx_files = [f for f in files if f.endswith('.xlsx')]
                    if xlsx_files:
                        xlsx_files_paths = [os.path.join(download_dir, f) for f in xlsx_files]
                        newest_file = max(xlsx_files_paths, key=os.path.getctime)
                        downloaded_file = newest_file
                        break
                time.sleep(1)
            
            if downloaded_file:
                print(f"Download completed: {downloaded_file}")
                return downloaded_file
            else:
                print(f"Download timed out after {timeout} seconds.")
                return None
            
        except Exception as export_error:
            print(f"Could not find or click the 'Exportar Excel' button: {export_error}")
            time.sleep(15)
            return None

    except Exception as e:
        print(f"An error occurred: {e}")
        raise e
    finally:
        print("Closing browser...")
        if 'driver' in locals():
            driver.quit()

def select_calendar_range(driver, start_day, end_day):
    """Select an inclusive range; never export after a failed calendar click."""
    month_names = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                   "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

    def select_day(day, backwards):
        target_text = f"{month_names[day.month - 1]} {day.year}"
        direction = ("Previous", "previous", "left") if backwards else ("Next", "next", "right")
        # Start from the portal's current month, then move forward to the end.
        max_steps = abs((end_day.year - start_day.year) * 12 + end_day.month - start_day.month) + 2
        for _ in range(max_steps):
            captions = driver.find_elements(By.XPATH,
                f"//*[translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{target_text}']")
            if any(caption.is_displayed() for caption in captions):
                button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((
                    By.XPATH, f"//button[@data-day='{day.day}/{day.month}/{day.year}']"
                )))
                button.click()
                time.sleep(0.5)
                return
            nav = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH,
                f"//button[@aria-label='Go to the {direction[0]} Month' or @name='{direction[1]}-month' or contains(@class, '{direction[1]}') or .//svg[contains(@class, 'chevron-{direction[2]}')]]"
            )))
            nav.click()
            time.sleep(0.2)
        raise RuntimeError(f"Calendar month not found: {target_text}")

    select_day(start_day, backwards=True)
    select_day(end_day, backwards=False)


if __name__ == "__main__":
    result = run_report_extraction()
    print(f"Result: {result}")
