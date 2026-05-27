import pandas as pd
import os

FIXED_FILE_PATH = os.path.join(os.path.dirname(__file__), "downloads", "Reposiciones Sabados Cusqueña 2026.xlsb")

def process_dashboard_data(dynamic_file_path: str):
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # Load fixed db
    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Clientes', engine='pyxlsb')
    df_fixed['cliente_id'] = df_fixed['cliente_id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    
    # Load dynamic db
    df_dyn = pd.read_excel(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    # Clean the column, handling possible floats/strings
    df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    
    # KPIs
    total_clients = len(df_fixed)
    total_redemptions = len(df_dyn)
    
    # Count redemptions per client
    redemptions_per_client = df_dyn.groupby(ref_col).size().reset_index(name='redemptions')
    
    # Also get the list of redemption dates
    df_dyn['Fecha'] = df_dyn['Fecha'].fillna('')
    redemption_dates = df_dyn[df_dyn['Fecha'] != ''].groupby(ref_col)['Fecha'].apply(list).reset_index(name='redemption_dates')
    
    # Merge them
    redemptions_per_client = pd.merge(redemptions_per_client, redemption_dates, on=ref_col, how='left')
    redemptions_per_client.rename(columns={ref_col: 'cliente_id'}, inplace=True)
    
    # Merge fixed with redemptions
    df_merged = pd.merge(df_fixed, redemptions_per_client, on='cliente_id', how='left')
    df_merged['redemptions'] = df_merged['redemptions'].fillna(0).astype(int)
    # Fill NaN dates with empty list
    df_merged['redemption_dates'] = df_merged['redemption_dates'].apply(lambda d: d if isinstance(d, list) else [])
    
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
        'cliente_id', 'nombre_comercial', 'direccion', 'gerencia', 'supervisor', 'BDR', 'redemptions', 'redemption_dates',
        'BEER LM', 'BEER MTD', 'CSQ LM', 'CSQ MTD', 'NOLO LM', 'NOLO MTD', 'MIX NOLO LM', 'MIX NOLO MTD', 'Tipo'
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

    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Clientes', engine='pyxlsb')
    df_fixed['cliente_id'] = df_fixed['cliente_id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)

    df_dyn = pd.read_excel(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')

    df_dyn_merged = pd.merge(df_dyn, df_fixed, left_on=ref_col, right_on='cliente_id', how='inner')

    date_a = pd.to_datetime(date_a_str, format='%d/%m/%Y')
    date_b = pd.to_datetime(date_b_str, format='%d/%m/%Y')

    return _build_comparison(df_dyn_merged, ref_col, date_a, date_b)

