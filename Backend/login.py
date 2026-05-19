import os
import shutil
import time
from datetime import datetime
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

def get_config_status():
    return {
        "URL": bool(_get_config_value("URL")),
        "REPORT_USER_or_USER": bool(_get_config_value("REPORT_USER", "PORTAL_USER", "USER")),
        "PASSWORD": bool(_get_config_value("PASSWORD")),
    }

def run_report_extraction():
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
    download_dir = os.environ.get("DATA_DIR", "/app/data" if os.environ.get("RENDER") else os.path.join(BASE_DIR, "downloads"))
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
        
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
            
            def is_month_visible(month_text):
                try:
                    driver.find_element(By.XPATH, f"//*[translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{month_text}']")
                    return True
                except:
                    return False

            def click_day_in_month(month_text, day_num):
                # We look for the day button that is chronologically after the month title
                # We try a few generic patterns used by React date pickers
                xpath1 = f"(//*[translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{month_text}']/ancestor::div[1]/following-sibling::table//button[(text()='{day_num}' or .//span[text()='{day_num}']) and not(contains(@class, 'outside'))])[1]"
                xpath2 = f"(//*[translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')='{month_text}']/following::table[1]//button[(text()='{day_num}' or .//span[text()='{day_num}']) and not(contains(@class, 'outside'))])[1]"
                
                try:
                    btn = driver.find_element(By.XPATH, xpath1)
                    btn.click()
                    return True
                except:
                    try:
                        btn = driver.find_element(By.XPATH, xpath2)
                        btn.click()
                        return True
                    except Exception as e:
                        print(f"Could not click day {day_num} in {month_text}: {e}")
                        return False
                
            print("Navigating calendar to target start date (mayo 2026)...")
            target_text = "mayo 2026"
            
            for _ in range(24):
                if is_month_visible(target_text):
                    break
                try:
                    prev_button = driver.find_element(By.XPATH, "//button[@aria-label='Go to the Previous Month' or @name='previous-month' or contains(@class, 'previous') or .//svg[contains(@class, 'chevron-left')]]")
                    prev_button.click()
                    time.sleep(0.2)
                except:
                    break
                
            print(f"Found month {target_text}, clicking day 7...")
            click_day_in_month(target_text, 7)
            time.sleep(0.5)
            
            print("Navigating calendar to current month...")
            current_date = datetime.now()
            month_names = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
            current_text = f"{month_names[current_date.month-1]} {current_date.year}"
            
            for _ in range(24):
                if is_month_visible(current_text):
                    break
                try:
                    next_button = driver.find_element(By.XPATH, "//button[@aria-label='Go to the Next Month' or @name='next-month' or contains(@class, 'next') or .//svg[contains(@class, 'chevron-right')]]")
                    next_button.click()
                    time.sleep(0.2)
                except:
                    break
                
            print(f"Found current month {current_text}, clicking day {current_date.day}...")
            click_day_in_month(current_text, current_date.day)
            time.sleep(0.5)
            
            # Press escape to close the popover just in case it blocks the export button
            webdriver.ActionChains(driver).send_keys(u'\ue00c').perform() # Escape key
            print("Date range selected.")
                
        except Exception as e:
            print(f"Error filling dates via calendar: {e}")
        
        # 3. Look for the 'Exportar Excel' button and click it
        try:
            print("Looking for 'Exportar Excel' button...")
            export_button = dashboard_wait.until(EC.element_to_be_clickable(
                (By.XPATH, "//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')] | //button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'exportar excel')]")
            ))
            
            export_button.click()
            print("Export button clicked! Waiting for download to complete...")
            
            timeout = 60
            start_time = time.time()
            downloaded_file = None
            
            while time.time() - start_time < timeout:
                files = os.listdir(download_dir)
                crdownloads = [f for f in files if f.endswith('.crdownload') or f.endswith('.tmp')]
                if not crdownloads:
                    xlsx_files = [f for f in files if f.endswith('.xlsx')]
                    if xlsx_files:
                        xlsx_files_paths = [os.path.join(download_dir, f) for f in xlsx_files]
                        newest_file = max(xlsx_files_paths, key=os.path.getctime)
                        if os.path.getctime(newest_file) > start_time - 5:
                            downloaded_file = newest_file
                            break
                time.sleep(1)
            
            if downloaded_file:
                print(f"Download completed: {downloaded_file}")
                return downloaded_file
            else:
                print("Download timed out.")
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

if __name__ == "__main__":
    result = run_report_extraction()
    print(f"Result: {result}")
