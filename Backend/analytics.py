import pandas as pd
import os
import glob
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.environ.get("DATA_DIR", "/app/data" if os.environ.get("RENDER") else os.path.join(BASE_DIR, "downloads"))

def get_path_for_file(filename: str) -> str:
    # 1. Check in DATA_DIR (runtime downloads/updates)
    data_dir = os.environ.get("DATA_DIR")
    if data_dir:
        p = os.path.join(data_dir, filename)
        if os.path.exists(p):
            return p
    # 2. Check in local downloads (git-committed assets)
    p_local = os.path.join(BASE_DIR, "downloads", filename)
    if os.path.exists(p_local):
        return p_local
    # 3. Fallback
    return os.path.join(DOWNLOADS_DIR, filename)

FIXED_FILE_PATH = get_path_for_file("Reposiciones Sabados Cusqueña 2026_act.xlsb")

def _load_fixed_clients():
    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Final', engine='pyxlsb')
    df_fixed['cliente_id'] = df_fixed['cliente_id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    return df_fixed.drop_duplicates(subset='cliente_id', keep='first').copy()


def _load_dynamic_report(dynamic_file_path: str):
    df_dyn = pd.read_excel(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    if ref_col in df_dyn.columns:
        df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    
    # Apply Sucursales mapping update
    if 'Sucursal' in df_dyn.columns and ref_col in df_dyn.columns:
        if os.path.exists(FIXED_FILE_PATH):
            try:
                xl = pd.ExcelFile(FIXED_FILE_PATH, engine='pyxlsb')
                if 'Sucursales' in xl.sheet_names:
                    df_suc = pd.read_excel(FIXED_FILE_PATH, sheet_name='Sucursales', engine='pyxlsb')
                    
                    suc_col = 'Sucursal'
                    new_code_col = None
                    for c in df_suc.columns:
                        c_norm = str(c).lower().strip()
                        if 'nuevo' in c_norm and ('c' in c_norm or 'd' in c_norm or 'g' in c_norm):
                            new_code_col = c
                            break
                    
                    if suc_col in df_suc.columns and new_code_col is not None:
                        df_suc[suc_col] = df_suc[suc_col].fillna('').astype(str).str.strip()
                        df_suc[new_code_col] = df_suc[new_code_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
                        df_suc = df_suc[df_suc[suc_col] != '']
                        
                        suc_mapping = df_suc.set_index(suc_col)[new_code_col].to_dict()
                        
                        # Apply mapping
                        df_dyn['Sucursal_clean'] = df_dyn['Sucursal'].fillna('').astype(str).str.strip()
                        mapped_codes = df_dyn['Sucursal_clean'].map(suc_mapping)
                        df_dyn[ref_col] = mapped_codes.fillna(df_dyn[ref_col])
                        df_dyn.drop(columns=['Sucursal_clean'], inplace=True)
            except Exception as e:
                print(f"Error applying Sucursales mapping: {e}")
                
    # Exclude Ola 3 redemptions before 13/06/2026
    if ref_col in df_dyn.columns and 'Fecha' in df_dyn.columns:
        if os.path.exists(FIXED_FILE_PATH):
            try:
                df_fixed = _load_fixed_clients()
                client_ola = df_fixed.set_index('cliente_id')['Ola'].to_dict()
                
                # Temporary clean date
                df_dyn['Fecha_dt_temp'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
                cutoff_date = pd.to_datetime('13/06/2026', format='%d/%m/%Y')
                
                # Map Ola column temporarily
                df_dyn['Ola_temp'] = df_dyn[ref_col].map(client_ola)
                
                # Mask for rows that should be excluded: (Ola_temp == 3) & (Fecha_dt_temp < cutoff_date)
                exclude_mask = (df_dyn['Ola_temp'] == 3) & (df_dyn['Fecha_dt_temp'] < cutoff_date)
                
                # Filter out excluded rows
                df_dyn = df_dyn[~exclude_mask].copy()
                
                # Drop temporary columns
                df_dyn.drop(columns=['Fecha_dt_temp', 'Ola_temp'], errors='ignore', inplace=True)
            except Exception as e:
                print(f"Error filtering Ola 3 redemptions: {e}")
                
    return df_dyn


def process_dashboard_data(dynamic_file_path: str):
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # Load fixed db
    df_fixed = _load_fixed_clients()
    
    # Load dynamic db
    df_dyn = _load_dynamic_report(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    
    # KPIs
    total_clients = len(df_fixed)
    total_redemptions = len(df_dyn)
    
    # Count redemptions per client
    redemptions_per_client = df_dyn.groupby(ref_col).size().reset_index(name='redemptions')
    
    # Also get the list of redemption dates
    df_dyn['Fecha'] = df_dyn['Fecha'].fillna('')
    redemption_dates = df_dyn[df_dyn['Fecha'] != ''].groupby(ref_col)['Fecha'].apply(list).reset_index(name='redemption_dates')
    
    # Also get the list of redemption hours/times
    df_dyn['Hora'] = df_dyn['Hora'].fillna('')
    redemption_hours = df_dyn[df_dyn['Fecha'] != ''].groupby(ref_col)['Hora'].apply(list).reset_index(name='redemption_hours')
    
    # Merge them
    redemptions_per_client = pd.merge(redemptions_per_client, redemption_dates, on=ref_col, how='left')
    redemptions_per_client = pd.merge(redemptions_per_client, redemption_hours, on=ref_col, how='left')
    redemptions_per_client.rename(columns={ref_col: 'cliente_id'}, inplace=True)
    
    # Merge fixed with redemptions
    df_merged = pd.merge(df_fixed, redemptions_per_client, on='cliente_id', how='left')
    df_merged['redemptions'] = df_merged['redemptions'].fillna(0).astype(int)
    # Fill NaN dates/hours with empty list
    df_merged['redemption_dates'] = df_merged['redemption_dates'].apply(lambda d: d if isinstance(d, list) else [])
    df_merged['redemption_hours'] = df_merged['redemption_hours'].apply(lambda h: h if isinstance(h, list) else [])
    
    active_clients = len(df_merged[df_merged['redemptions'] > 0])
    inactive_clients = total_clients - active_clients
    
    avg_redemptions = df_merged[df_merged['redemptions'] > 0]['redemptions'].mean() if active_clients > 0 else 0
    median_redemptions = df_merged[df_merged['redemptions'] > 0]['redemptions'].median() if active_clients > 0 else 0
    
    # Lower quartile
    if active_clients > 0:
        q1 = df_merged[df_merged['redemptions'] > 0]['redemptions'].quantile(0.25)
        low_performers = len(df_merged[(df_merged['redemptions'] > 0) & (df_merged['redemptions'] <= q1)])
    else:
        low_performers = 0
    # Map 'Ola' wave for each client
    client_ola = {}
    for _, row in df_fixed.iterrows():
        c_id = str(row['cliente_id']).strip().replace('.0', '')
        val = row.get('Ola')
        try:
            val_int = int(float(val)) if pd.notna(val) else 1
        except Exception:
            val_int = 1
        client_ola[c_id] = val_int

    # Dynamic 'Tipo' classification for each client based on Saturdays Q1 performance
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
    df_sats = df_dyn[df_dyn['Fecha_dt'].dt.dayofweek == 5]
    saturdays_list = sorted(df_sats['Fecha'].dropna().unique(), key=lambda x: pd.to_datetime(x, format='%d/%m/%Y'))
    
    sat_q1 = {}
    for sat in saturdays_list:
        df_sat = df_sats[df_sats['Fecha'] == sat]
        counts = df_sat.groupby(ref_col).size().tolist()
        if counts:
            sat_q1[sat] = pd.Series(counts).quantile(0.25)
        else:
            sat_q1[sat] = 0
            
    client_sat_counts = df_sats.groupby([ref_col, 'Fecha']).size().reset_index(name='count')
    
    # Store Saturdays above Q1 for each client ID
    client_above_q1_sats = {}
    for _, r_row in client_sat_counts.iterrows():
        c_id = str(r_row[ref_col]).replace('.0', '')
        sat = r_row['Fecha']
        count = r_row['count']
        q1 = sat_q1.get(sat, 0)
        if count > q1:
            if c_id not in client_above_q1_sats:
                client_above_q1_sats[c_id] = []
            client_above_q1_sats[c_id].append(sat)
            
    def get_client_type(c_id):
        ola = client_ola.get(c_id, 1)
        if ola == 2:
            # Ola 2: Only evaluation starting from 23/05/2026
            relevant_sats = [sat for sat in saturdays_list if pd.to_datetime(sat, format='%d/%m/%Y') >= pd.to_datetime('23/05/2026', format='%d/%m/%Y')]
        elif ola == 3:
            # Ola 3: Only evaluation starting from 13/06/2026
            relevant_sats = [sat for sat in saturdays_list if pd.to_datetime(sat, format='%d/%m/%Y') >= pd.to_datetime('13/06/2026', format='%d/%m/%Y')]
        else:
            # Ola 1: All Saturdays
            relevant_sats = saturdays_list

        if not relevant_sats:
            return 'NO ADH'

        above_sats = client_above_q1_sats.get(c_id, [])
        above_count = sum(1 for sat in above_sats if sat in relevant_sats)
        
        ratio = above_count / len(relevant_sats)
        if ratio >= 0.75:
            return 'ADH'
        elif ratio >= 0.25:
            return 'INT'
        else:
            return 'NO ADH'
            
    df_merged['Tipo'] = df_merged['cliente_id'].apply(get_client_type)
    df_merged['Ola'] = df_merged['cliente_id'].apply(lambda c_id: client_ola.get(c_id, 1))

    # Dropdowns Options
    filter_options = {
        'direccion': sorted([str(x) for x in df_merged['direccion'].dropna().unique()]),
        'gerencia': sorted([str(x) for x in df_merged['gerencia'].dropna().unique()]),
        'supervisor': sorted([str(x) for x in df_merged['supervisor'].dropna().unique()]),
        'BDR': sorted([str(x) for x in df_merged['BDR'].dropna().unique()])
    }
    
    # Fill NAs in volume columns with 0, and hierarchy/text columns with "N/A"
    vol_cols = ['BEER LM', 'BEER MTD', 'CSQ LM', 'CSQ MTD', 'NOLO LM', 'NOLO MTD', 'MIX NOLO LM', 'MIX NOLO MTD']
    for col in vol_cols:
        if col in df_merged.columns:
            df_merged[col] = df_merged[col].fillna(0)
    
    text_cols = ['direccion', 'gerencia', 'supervisor', 'BDR', 'nombre_comercial', 'Tipo']
    for col in text_cols:
        if col in df_merged.columns:
            df_merged[col] = df_merged[col].fillna("N/A")

    # We return the raw merged data so the frontend can do arbitrary cross-filtering and aggregate
    client_data = df_merged[[
        'cliente_id', 'nombre_comercial', 'direccion', 'gerencia', 'supervisor', 'BDR', 'redemptions', 'redemption_dates', 'redemption_hours',
        'BEER LM', 'BEER MTD', 'CSQ LM', 'CSQ MTD', 'NOLO LM', 'NOLO MTD', 'MIX NOLO LM', 'MIX NOLO MTD', 'Tipo', 'Ola'
    ]].to_dict(orient='records')

    # --- Progress Over Time Calculation ---
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
    
    # 1. Redemptions Over Time (Trend)
    redemptions_by_date = df_dyn.groupby('Fecha').size().reset_index(name='count')
    redemptions_by_date['Fecha_dt'] = pd.to_datetime(redemptions_by_date['Fecha'], format='%d/%m/%Y', errors='coerce')
    redemptions_by_date = redemptions_by_date.sort_values('Fecha_dt')
    redemptions_over_time = redemptions_by_date[['Fecha', 'count']].rename(columns={'Fecha': 'date'}).to_dict(orient='records')

    # Available dates for the frontend date picker
    available_dates = sorted(
        [d.strftime('%d/%m/%Y') for d in df_dyn['Fecha_dt'].dropna().unique()],
        key=lambda x: pd.to_datetime(x, format='%d/%m/%Y')
    )

    # 2. Default comparison: latest vs 7 days before
    latest_date = df_dyn['Fecha_dt'].max()
    last_week_date = latest_date - pd.Timedelta(days=7) if pd.notnull(latest_date) else None

    # Merge dynamic with fixed to get hierarchies
    df_dyn_merged = pd.merge(df_dyn, df_fixed, left_on=ref_col, right_on='cliente_id', how='inner')

    progress_data = _build_comparison(
        df_dyn_merged, ref_col, latest_date, last_week_date
    )
    progress_data['redemptionsOverTime'] = redemptions_over_time
    progress_data['available_dates'] = available_dates

    return {
        'kpis': {
            'total_clients': total_clients,
            'total_redemptions': total_redemptions,
            'active_clients': active_clients,
            'inactive_clients': inactive_clients,
            'avg_redemptions': round(avg_redemptions, 2),
            'median_redemptions': median_redemptions,
            'low_performers': low_performers
        },
        'filters': filter_options,
        'clients': client_data,
        'progress_data': progress_data
    }


def _build_comparison(df_dyn_merged, ref_col, date_a, date_b):
    """Build hourly comparison, cumulative, KPI deltas, and performance data for two dates."""
    df_a = df_dyn_merged[df_dyn_merged['Fecha_dt'] == date_a] if pd.notnull(date_a) else pd.DataFrame()
    df_b = df_dyn_merged[df_dyn_merged['Fecha_dt'] == date_b] if pd.notnull(date_b) else pd.DataFrame()

    # --- HOURLY COMPARISON ---
    hourly_a_counts = pd.Series(dtype=int)
    hourly_b_counts = pd.Series(dtype=int)
    df_a_h = None

    if not df_a.empty and 'Hora' in df_a.columns:
        df_a_h = df_a.copy()
        df_a_h['hour'] = pd.to_datetime(df_a_h['Hora'], format='%H:%M:%S', errors='coerce').dt.hour
        hourly_a_counts = df_a_h.groupby('hour').size()

    if not df_b.empty and 'Hora' in df_b.columns:
        df_b_h = df_b.copy()
        df_b_h['hour'] = pd.to_datetime(df_b_h['Hora'], format='%H:%M:%S', errors='coerce').dt.hour
        hourly_b_counts = df_b_h.groupby('hour').size()

    hourly_comparison = []
    for h in range(7, 24):
        hourly_comparison.append({
            'hour': f'{h:02d}:00',
            'today': int(hourly_a_counts.get(h, 0)) if not hourly_a_counts.empty else 0,
            'lastWeek': int(hourly_b_counts.get(h, 0)) if not hourly_b_counts.empty else 0
        })

    # --- CUMULATIVE DATA ---
    cumulative_a = []
    cumulative_b = []
    running_a = 0
    running_b = 0
    for entry in hourly_comparison:
        running_a += entry['today']
        running_b += entry['lastWeek']
        cumulative_a.append({'hour': entry['hour'], 'value': running_a})
        cumulative_b.append({'hour': entry['hour'], 'value': running_b})

    # --- KPI DELTAS ---
    a_total = len(df_a)
    b_total = len(df_b)
    redemption_delta = a_total - b_total
    redemption_pct = round(((a_total - b_total) / b_total) * 100, 1) if b_total > 0 else 0

    a_clients = set(df_a[ref_col].unique()) if not df_a.empty else set()
    b_clients = set(df_b[ref_col].unique()) if not df_b.empty else set()
    new_clients_a = len(a_clients)
    new_clients_b = len(b_clients)
    client_delta = new_clients_a - new_clients_b

    current_rate = 0
    if df_a_h is not None and not df_a_h.empty:
        hours_active = df_a_h['hour'].max() - df_a_h['hour'].min() + 1
        current_rate = round(a_total / max(hours_active, 1), 1)

    # --- TOP PERFORMERS BY INCREMENT ---
    performance = {}
    for level in ['direccion', 'gerencia', 'supervisor', 'BDR']:
        curr_counts = df_a.groupby(level).size() if not df_a.empty else pd.Series(dtype=int)
        prev_counts = df_b.groupby(level).size() if not df_b.empty else pd.Series(dtype=int)

        curr_clients_g = df_a.groupby(level)[ref_col].nunique() if not df_a.empty else pd.Series(dtype=int)
        prev_clients_g = df_b.groupby(level)[ref_col].nunique() if not df_b.empty else pd.Series(dtype=int)

        all_entities = set()
        if not curr_counts.empty: all_entities.update(curr_counts.index)
        if not prev_counts.empty: all_entities.update(prev_counts.index)

        perf_list = []
        for entity in all_entities:
            if pd.isna(entity): continue
            curr = int(curr_counts.get(entity, 0))
            prev = int(prev_counts.get(entity, 0))
            curr_cl = int(curr_clients_g.get(entity, 0))
            prev_cl = int(prev_clients_g.get(entity, 0))
            pct_change = round(((curr - prev) / prev) * 100, 1) if prev > 0 else (100.0 if curr > 0 else 0)

            perf_list.append({
                'name': str(entity),
                'current': curr,
                'previous': prev,
                'diff': curr - prev,
                'pctChange': pct_change,
                'currentClients': curr_cl,
                'previousClients': prev_cl,
                'clientDiff': curr_cl - prev_cl
            })

        perf_list.sort(key=lambda x: x['diff'], reverse=True)
        performance[level] = perf_list

    # Client-level performance (individual clients by nombre_comercial)
    if 'nombre_comercial' in df_a.columns or 'nombre_comercial' in df_b.columns:
        client_col = 'nombre_comercial'
        curr_cl_counts = df_a.groupby(client_col).size() if not df_a.empty and client_col in df_a.columns else pd.Series(dtype=int)
        prev_cl_counts = df_b.groupby(client_col).size() if not df_b.empty and client_col in df_b.columns else pd.Series(dtype=int)

        all_cl = set()
        if not curr_cl_counts.empty: all_cl.update(curr_cl_counts.index)
        if not prev_cl_counts.empty: all_cl.update(prev_cl_counts.index)

        cl_list = []
        for cl in all_cl:
            if pd.isna(cl): continue
            curr = int(curr_cl_counts.get(cl, 0))
            prev = int(prev_cl_counts.get(cl, 0))
            pct_change = round(((curr - prev) / prev) * 100, 1) if prev > 0 else (100.0 if curr > 0 else 0)
            cl_list.append({
                'name': str(cl),
                'current': curr,
                'previous': prev,
                'diff': curr - prev,
                'pctChange': pct_change,
            })
        cl_list.sort(key=lambda x: x['diff'], reverse=True)
        performance['cliente'] = cl_list

    return {
        'hourlyComparison': hourly_comparison,
        'cumulativeToday': cumulative_a,
        'cumulativeLastWeek': cumulative_b,
        'performance': performance,
        'kpiDeltas': {
            'todayTotal': a_total,
            'lastWeekTotal': b_total,
            'redemptionDelta': redemption_delta,
            'redemptionPct': redemption_pct,
            'newClientsToday': new_clients_a,
            'newClientsLW': new_clients_b,
            'clientDelta': client_delta,
            'currentRate': current_rate,
        },
        'latest_date': date_a.strftime('%d/%m/%Y') if pd.notnull(date_a) else None,
        'last_week_date': date_b.strftime('%d/%m/%Y') if pd.notnull(date_b) else None
    }


def process_comparison(dynamic_file_path: str, date_a_str: str, date_b_str: str):
    """Generate comparison data for two specific dates (format dd/MM/yyyy)."""
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    df_fixed = _load_fixed_clients()

    df_dyn = _load_dynamic_report(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')

    df_dyn_merged = pd.merge(df_dyn, df_fixed, left_on=ref_col, right_on='cliente_id', how='inner')

    date_a = pd.to_datetime(date_a_str, format='%d/%m/%Y')
    date_b = pd.to_datetime(date_b_str, format='%d/%m/%Y')

    return _build_comparison(df_dyn_merged, ref_col, date_a, date_b)


def get_waiter_rankings(dynamic_file_path: str, month_year: str = None):
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # Load fixed db
    df_fixed = _load_fixed_clients()
    client_dict = df_fixed.set_index('cliente_id')['nombre_comercial'].to_dict()

    # Load dynamic db
    import glob
    import re

    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # 1. Load fixed db (Base Final)
    df_fixed = _load_fixed_clients()
    client_dict = df_fixed.set_index('cliente_id')['nombre_comercial'].to_dict()

    # 2. Load dynamic db (canjes-institucion)
    df_dyn = _load_dynamic_report(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'

    # Extract month-year (MM/YYYY)
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
    df_dyn['Month_Key'] = df_dyn['Fecha_dt'].dt.strftime('%m/%Y')

    # Available months (sorted chronologically)
    available_months = sorted(
        df_dyn['Month_Key'].dropna().unique(),
        key=lambda x: pd.to_datetime(x, format='%m/%Y')
    )

    if not month_year:
        month_year = available_months[-1] if available_months else None

    # Filter for target month
    df_month = df_dyn[df_dyn['Month_Key'] == month_year].copy() if month_year else pd.DataFrame()

    # Normalize mesero and other locations
    if not df_month.empty:
        df_month['Mesero'] = df_month['Mesero'].fillna('').astype(str).str.strip()
        df_month = df_month[df_month['Mesero'] != '']
    
    # 3. Load sales boxes. June incentives use Venta_Junio; previous rules keep Venta_Mayo.
    sales_file_name = "Venta_Junio.xlsx" if month_year == "06/2026" else "Venta_Mayo.xlsx"
    sales_path = get_path_for_file(sales_file_name)
    if os.path.exists(sales_path):
        df_sales = pd.read_excel(
            sales_path,
            usecols=lambda col: str(col).strip() in {'codigo', 'CAJAS'}
        )
        df_sales.columns = [str(col).strip() for col in df_sales.columns]
        if 'codigo' not in df_sales.columns:
            df_sales['codigo'] = ''
        if 'CAJAS' not in df_sales.columns:
            df_sales['CAJAS'] = 0
        df_sales = df_sales[['codigo', 'CAJAS']].copy()
        df_sales['codigo'] = df_sales['codigo'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
        df_sales['CAJAS'] = pd.to_numeric(df_sales['CAJAS'], errors='coerce').fillna(0)
        df_sales = df_sales[~df_sales['codigo'].str.lower().isin(['', 'nan', 'none'])]
        cajas_sum = df_sales.groupby('codigo')['CAJAS'].sum().to_dict()
    else:
        cajas_sum = {}

    # 4. Load ranking-mozos-institucion lookup
    rmi_pattern = "ranking-mozos-institucion_*.xlsx"
    rmi_files = []
    data_dir = os.environ.get("DATA_DIR")
    if data_dir:
        rmi_files.extend(glob.glob(os.path.join(data_dir, rmi_pattern)))
    rmi_files.extend(glob.glob(os.path.join(BASE_DIR, "downloads", rmi_pattern)))

    if rmi_files:
        rmi_path = sorted(rmi_files)[-1]
    else:
        rmi_path = get_path_for_file("ranking-mozos-institucion.xlsx")

    rmi_lookup = {}
    if os.path.exists(rmi_path):
        df_rmi = pd.read_excel(rmi_path)
        df_rmi['Nombres'] = df_rmi['Nombres'].fillna('').astype(str)
        df_rmi['Apellidos'] = df_rmi['Apellidos'].fillna('').astype(str)
        
        def normalize_name(name):
            if not name or pd.isna(name):
                return ""
            s = str(name).upper().strip()
            s = re.sub(r'\s+', ' ', s)
            return s
            
        df_rmi['normalized_name'] = (df_rmi['Nombres'] + " " + df_rmi['Apellidos']).apply(normalize_name)
        
        for _, row in df_rmi.iterrows():
            name = row['normalized_name']
            doc = str(row['Documento de identidad']).strip() if pd.notna(row['Documento de identidad']) else ""
            tel = str(row['Celular']).strip() if pd.notna(row['Celular']) else ""
            if doc == 'nan' or doc == 'None': doc = ""
            if tel == 'nan' or tel == 'None': tel = ""
            
            if name not in rmi_lookup:
                rmi_lookup[name] = (doc, tel)
            else:
                existing_doc, existing_tel = rmi_lookup[name]
                new_doc = doc if doc else existing_doc
                new_tel = tel if tel else existing_tel
                rmi_lookup[name] = (new_doc, new_tel)

    # 5. Client eligibility
    red_counts = {}
    required_weekends = []
    client_weekend_sets = {}
    if not df_month.empty:
        red_counts = df_month.groupby(ref_col).size().to_dict()
        df_weekends = df_month[df_month['Fecha_dt'].dt.weekday.isin([5, 6])].copy()
        if not df_weekends.empty:
            df_weekends['Weekend_Start_dt'] = df_weekends['Fecha_dt'] - pd.to_timedelta(
                df_weekends['Fecha_dt'].dt.weekday - 5,
                unit='D'
            )
            df_weekends['Weekend_Key'] = df_weekends['Weekend_Start_dt'].dt.strftime('%d/%m/%Y')
            required_weekends = sorted(
                [w for w in df_weekends['Weekend_Key'].dropna().unique()],
                key=lambda x: pd.to_datetime(x, format='%d/%m/%Y')
            )
            client_weekend_sets = (
                df_weekends.dropna(subset=['Weekend_Key'])
                .groupby(ref_col)['Weekend_Key']
                .apply(lambda values: sorted(set(values), key=lambda x: pd.to_datetime(x, format='%d/%m/%Y')))
                .to_dict()
            )

    eligible_clients = []
    eligible_clients_detail = []
    ineligible_clients_detail = []
    excl_sales = 0
    excl_red = 0
    excl_weekly = 0
    clients_satisfying_rule = 0

    fixed_client_ids = set(df_fixed['cliente_id'].astype(str).tolist())
    fixed_lookup = df_fixed.set_index('cliente_id').to_dict(orient='index')
    all_client_ids = set(list(fixed_client_ids) + list(red_counts.keys()) + list(cajas_sum.keys()))
    
    # Pre-calculate mozo counts for the 3-mozos rule:
    client_mozos_rule_status = {}
    if not df_month.empty:
        mozo_red = df_month.groupby([ref_col, 'Mesero']).size().reset_index(name='count')
        mozos_gt_20 = mozo_red[mozo_red['count'] > 20]
        client_mozo_counts = mozos_gt_20.groupby(ref_col).size().to_dict()
        for cid in all_client_ids:
            client_mozos_rule_status[cid] = client_mozo_counts.get(cid, 0) >= 3

    # Check chosen month
    is_mayo = (month_year == "05/2026")
    uses_june_locks = (month_year == "06/2026")
    min_redemptions = 50 if uses_june_locks else 51
    min_boxes = 1 if uses_june_locks else 2

    def _client_meta(cid, key):
        value = fixed_lookup.get(cid, {}).get(key, '')
        return '' if pd.isna(value) else value

    def _format_cajas(value):
        try:
            return round(float(value), 2)
        except Exception:
            return 0

    for cid in all_client_ids:
        reds = red_counts.get(cid, 0)
        cajas = cajas_sum.get(cid, 0.0)
        client_weekends = client_weekend_sets.get(cid, [])
        missing_weekends = [weekend for weekend in required_weekends if weekend not in set(client_weekends)]

        if uses_june_locks:
            red_ok = reds >= min_redemptions
            cajas_ok = cajas >= min_boxes
            weekly_ok = bool(required_weekends) and len(missing_weekends) == 0
            eligible = red_ok and cajas_ok and weekly_ok
        else:
            red_ok = reds >= min_redemptions
            cajas_ok = cajas >= min_boxes
            weekly_ok = True
            eligible = red_ok and cajas_ok

        if not cajas_ok:
            excl_sales += 1
        if not red_ok:
            excl_red += 1
        if uses_june_locks and not weekly_ok:
            excl_weekly += 1

        base_eligible = red_ok and cajas_ok
        satisfies_rule = client_mozos_rule_status.get(cid, False)
        if base_eligible and satisfies_rule:
            clients_satisfying_rule += 1

        missing = []
        if not red_ok:
            missing.append(f"Faltan {max(min_redemptions - reds, 0)} cervezas")
        if uses_june_locks and not weekly_ok:
            if required_weekends:
                missing.append(f"Faltan fines de semana: {', '.join(missing_weekends)}")
            else:
                missing.append("Sin fines de semana evaluables")
        if not cajas_ok:
            missing.append(f"Falta compra de {min_boxes:g} caja{'s' if min_boxes != 1 else ''}")

        detail = {
            'cliente_id': cid,
            'nombre_comercial': client_dict.get(cid, f"Cliente {cid}"),
            'direccion': _client_meta(cid, 'direccion'),
            'gerencia': _client_meta(cid, 'gerencia'),
            'supervisor': _client_meta(cid, 'supervisor'),
            'BDR': _client_meta(cid, 'BDR'),
            'redenciones_mes': int(reds),
            'cajas': _format_cajas(cajas),
            'semanas_redimiendo': len(client_weekends),
            'semanas_requeridas': len(required_weekends),
            'semanas_con_redencion': ', '.join(client_weekends),
            'semanas_faltantes': ', '.join(missing_weekends),
            'fines_de_semana_redimiendo': len(client_weekends),
            'fines_de_semana_requeridos': len(required_weekends),
            'fines_de_semana_con_redencion': ', '.join(client_weekends),
            'fines_de_semana_faltantes': ', '.join(missing_weekends),
            'cumple_50_cervezas': red_ok,
            'cumple_todas_las_semanas': weekly_ok,
            'cumple_1_caja': cajas_ok,
            'elegible': eligible,
            'faltantes': ' | '.join(missing) if missing else 'Cumple todos los candados'
        }

        if eligible:
            eligible_clients.append(cid)
            eligible_clients_detail.append(detail)
        else:
            ineligible_clients_detail.append(detail)

    eligible_set = set(eligible_clients)

    winners_list = []
    top1_winner = None
    top100_list = []
    top_clients_list = []

    kpis = {
        'total_clients_evaluated': len(all_client_ids),
        'eligible_clients': len(eligible_clients),
        'ineligible_clients': len(ineligible_clients_detail),
        'top_1_winners': 0,
        'top_100_winners': 0,
        'top_client_winners': 0,
        'final_rows': 0,
        'rows_with_documento': 0,
        'rows_missing_documento': 0,
        'rows_with_telefono': 0,
        'rows_missing_telefono': 0,
        'excl_sales': excl_sales,
        'excl_red': excl_red,
        'excl_weekly': excl_weekly,
        'clients_satisfying_rule': f"{clients_satisfying_rule} / {len(eligible_clients)}" if eligible_clients else "0 / 0",
        'lock_redemptions_ok': len(all_client_ids) - excl_red,
        'lock_weeks_ok': len(all_client_ids) - excl_weekly if uses_june_locks else len(all_client_ids),
        'lock_boxes_ok': len(all_client_ids) - excl_sales,
        'min_redemptions_required': 50 if uses_june_locks else 51,
        'min_boxes_required': min_boxes,
        'weeks_required_count': len(required_weekends),
        'weeks_required': required_weekends,
        'weekends_required_count': len(required_weekends),
        'weekends_required': required_weekends,
        'uses_june_locks': uses_june_locks
    }

    if not df_month.empty and eligible_set:
        df_elig = df_month[df_month[ref_col].isin(eligible_set)].copy()
        
        df_elig['Departamento'] = df_elig['Departamento'].fillna('').astype(str).str.strip().str.upper()
        df_elig['Provincia'] = df_elig['Provincia'].fillna('').astype(str).str.strip().str.upper()
        df_elig['Distrito'] = df_elig['Distrito'].fillna('').astype(str).str.strip().str.upper()
        df_elig['Mesero_upper'] = df_elig['Mesero'].str.upper()
        
        df_elig['mozo_key'] = (df_elig['Mesero_upper'] + "|" + 
                               df_elig['Departamento'] + "|" + 
                               df_elig['Provincia'] + "|" + 
                               df_elig['Distrito'])
        
        # mozo_client_redemptions
        mcr = df_elig.groupby([ref_col, 'mozo_key', 'Mesero', 'Departamento', 'Provincia', 'Distrito']).size().reset_index(name='cantidad_redenciones')
        
        if not mcr.empty:
            # Sort for TOP 1 and TOP 100
            mcr_sorted = mcr.sort_values(by=['cantidad_redenciones', ref_col, 'mozo_key'], ascending=[False, True, True]).reset_index(drop=True)
            
            top1_keys = set(mcr_sorted.head(1)['mozo_key'] + "@" + mcr_sorted.head(1)[ref_col])
            top100_keys = set(mcr_sorted.head(100)['mozo_key'] + "@" + mcr_sorted.head(100)[ref_col])
            
            # TOP CLIENT
            mcr['rn'] = mcr.sort_values(by=['cantidad_redenciones', 'mozo_key'], ascending=[False, True]).groupby(ref_col).cumcount() + 1
            top_client_keys = set(mcr[mcr['rn'] == 1]['mozo_key'] + "@" + mcr[mcr['rn'] == 1][ref_col])
            
            kpis['top_1_winners'] = len(top1_keys)
            kpis['top_100_winners'] = len(top100_keys)
            kpis['top_client_winners'] = len(top_client_keys)
            
            # Deduplicate and merge prizes
            dedup_rows = []
            rows_with_doc = 0
            rows_with_tel = 0
            unique_winner_keys = top1_keys.union(top100_keys).union(top_client_keys)
            mcr_lookup = mcr.set_index(['mozo_key', ref_col]).to_dict(orient='index')
            
            def norm_lookup_name(name):
                s = str(name).upper().strip()
                s = re.sub(r'\s+', ' ', s)
                return s
                
            for wk in unique_winner_keys:
                mkey, cid = wk.split("@")
                info = mcr_lookup.get((mkey, cid))
                if not info:
                    continue
                
                # Check prizes
                prizes = []
                if wk in top1_keys:
                    prizes.append('TOP 1')
                if wk in top100_keys:
                    prizes.append('TOP 100')
                if wk in top_client_keys:
                    prizes.append('TOP CLIENT')
                premios_str = " + ".join(prizes)
                
                # Lookup contact details
                mname = info['Mesero']
                norm_name = norm_lookup_name(mname)
                doc, tel = rmi_lookup.get(norm_name, ("", ""))
                
                if doc: rows_with_doc += 1
                if tel: rows_with_tel += 1
                
                winner_obj = {
                    'mesero_nombre': mname,
                    'mesero_documento': doc,
                    'mesero_telefono': tel,
                    'cliente_id': cid,
                    'cantidad_redenciones': int(info['cantidad_redenciones']),
                    'premios': premios_str,
                    'nombre_comercial': client_dict.get(cid, f"Cliente {cid}")
                }
                dedup_rows.append(winner_obj)
            
            # Sort final list: cantidad_redenciones DESC, cliente_id ASC, mozo_key ASC
            dedup_rows.sort(key=lambda x: (-x['cantidad_redenciones'], x['cliente_id'], x['mesero_nombre']))
            winners_list = dedup_rows
            
            kpis['final_rows'] = len(dedup_rows)
            kpis['rows_with_documento'] = rows_with_doc
            kpis['rows_missing_documento'] = len(dedup_rows) - rows_with_doc
            kpis['rows_with_telefono'] = rows_with_tel
            kpis['rows_missing_telefono'] = len(dedup_rows) - rows_with_tel

            # Populate separated prize lists for Mayo view
            # top1
            top1_item = mcr_sorted.iloc[0]
            top1_cid = top1_item[ref_col]
            top1_mname = top1_item['Mesero']
            top1_doc, top1_tel = rmi_lookup.get(norm_lookup_name(top1_mname), ("", ""))
            top1_winner = {
                'rank': 1,
                'waiter': top1_mname,
                'client_id': top1_cid,
                'restaurant_name': client_dict.get(top1_cid, f"Cliente {top1_cid}"),
                'redemptions': int(top1_item['cantidad_redenciones']),
                'prize': "S/ 1,000",
                'mesero_documento': top1_doc,
                'mesero_telefono': top1_tel
            }

            # top100
            for idx, item in mcr_sorted.head(100).iterrows():
                cid = item[ref_col]
                mname = item['Mesero']
                doc, tel = rmi_lookup.get(norm_lookup_name(mname), ("", ""))
                top100_list.append({
                    'rank': idx + 1,
                    'waiter': mname,
                    'client_id': cid,
                    'restaurant_name': client_dict.get(cid, f"Cliente {cid}"),
                    'redemptions': int(item['cantidad_redenciones']),
                    'prize': "S/ 100",
                    'mesero_documento': doc,
                    'mesero_telefono': tel
                })

            # top_clients (113 rows)
            top_clients_df = mcr[mcr['rn'] == 1].sort_values(by=['cantidad_redenciones', ref_col], ascending=[False, True])
            for idx, item in top_clients_df.iterrows():
                cid = item[ref_col]
                mname = item['Mesero']
                doc, tel = rmi_lookup.get(norm_lookup_name(mname), ("", ""))
                top_clients_list.append({
                    'waiter': mname,
                    'client_id': cid,
                    'restaurant_name': client_dict.get(cid, f"Cliente {cid}"),
                    'redemptions': int(item['cantidad_redenciones']),
                    'prize': "S/ 50",
                    'mesero_documento': doc,
                    'mesero_telefono': tel
                })

    return {
        'available_months': available_months,
        'selected_month': month_year,
        'winners': winners_list,
        'eligible_clients_detail': sorted(eligible_clients_detail, key=lambda x: (-x['redenciones_mes'], -x['cajas'], x['cliente_id'])),
        'ineligible_clients_detail': sorted(ineligible_clients_detail, key=lambda x: (x['faltantes'], x['cliente_id'])),
        'kpis': kpis,
        'top1': top1_winner,
        'top100': top100_list,
        'top_clients': top_clients_list
    }


def get_sales_data():
    vm_path = get_path_for_file("Venta_Mayo.xlsx")
        
    if not os.path.exists(vm_path):
        raise FileNotFoundError(f"Sales file not found: {vm_path}")
        
    df_vm = pd.read_excel(vm_path)
    df_vm['codigo'] = df_vm['codigo'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    
    df_fixed = _load_fixed_clients()
    overlap_cols = [c for c in df_fixed.columns if c in df_vm.columns and c != 'cliente_id']
    df_fixed = df_fixed.drop(columns=overlap_cols)
    df_merged = pd.merge(df_fixed, df_vm, left_on='cliente_id', right_on='codigo', how='inner')
    
    num_cols = [c for c in df_vm.columns if c != 'codigo']
    for c in num_cols:
        df_merged[c] = df_merged[c].fillna(0)
        
    records = df_merged[[
        'cliente_id', 'nombre_comercial', 'direccion', 'gerencia', 'supervisor', 'BDR', 'Ola'
    ] + num_cols].to_dict(orient='records')

    return {
        'metadata': {
            'period': 'Mayo 2026',
            'scope': 'Solo clientes incluidos en el programa',
            'source_file': os.path.basename(vm_path),
            'client_count': len(records),
            'filtered_to_program_clients': True,
        },
        'records': records,
    }

