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
    
    # We return the raw merged data so the frontend can do arbitrary cross-filtering and aggregate
    client_data = df_merged[['cliente_id', 'nombre_comercial', 'direccion', 'gerencia', 'supervisor', 'BDR', 'redemptions', 'redemption_dates']].fillna("N/A").to_dict(orient='records')

    # --- Progress Over Time Calculation ---
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
    
    # 1. Redemptions Over Time (Trend)
    redemptions_by_date = df_dyn.groupby('Fecha').size().reset_index(name='count')
    redemptions_by_date['Fecha_dt'] = pd.to_datetime(redemptions_by_date['Fecha'], format='%d/%m/%Y', errors='coerce')
    redemptions_by_date = redemptions_by_date.sort_values('Fecha_dt')
    redemptions_over_time = redemptions_by_date[['Fecha', 'count']].rename(columns={'Fecha': 'date'}).to_dict(orient='records')

    # 2. Performance Comparison (Latest vs Last Week)
    latest_date = df_dyn['Fecha_dt'].max()
    last_week_date = latest_date - pd.Timedelta(days=7) if pd.notnull(latest_date) else None
    
    # Merge dynamic with fixed to get hierarchies
    df_dyn_merged = pd.merge(df_dyn, df_fixed, left_on=ref_col, right_on='cliente_id', how='inner')
    
    df_today = df_dyn_merged[df_dyn_merged['Fecha_dt'] == latest_date] if pd.notnull(latest_date) else pd.DataFrame()
    df_last_week = df_dyn_merged[df_dyn_merged['Fecha_dt'] == last_week_date] if pd.notnull(last_week_date) else pd.DataFrame()

    # --- HOURLY COMPARISON ---
    hourly_today = []
    hourly_last_week = []
    
    if not df_today.empty and 'Hora' in df_today.columns:
        df_today_h = df_today.copy()
        df_today_h['hour'] = pd.to_datetime(df_today_h['Hora'], format='%H:%M:%S', errors='coerce').dt.hour
        hourly_today_counts = df_today_h.groupby('hour').size()
        
    if not df_last_week.empty and 'Hora' in df_last_week.columns:
        df_lw_h = df_last_week.copy()
        df_lw_h['hour'] = pd.to_datetime(df_lw_h['Hora'], format='%H:%M:%S', errors='coerce').dt.hour
        hourly_lw_counts = df_lw_h.groupby('hour').size()
    else:
        hourly_lw_counts = pd.Series(dtype=int)
    
    if not df_today.empty and 'Hora' in df_today.columns:
        hourly_lw_counts_safe = hourly_lw_counts
    else:
        hourly_today_counts = pd.Series(dtype=int)
        hourly_lw_counts_safe = pd.Series(dtype=int)
    
    # Build hourly data for hours 7-23
    hourly_comparison = []
    for h in range(7, 24):
        hourly_comparison.append({
            'hour': f'{h:02d}:00',
            'today': int(hourly_today_counts.get(h, 0)) if not hourly_today_counts.empty else 0,
            'lastWeek': int(hourly_lw_counts.get(h, 0)) if not hourly_lw_counts.empty else 0
        })

    # --- CUMULATIVE DATA ---
    cumulative_today = []
    cumulative_lw = []
    running_today = 0
    running_lw = 0
    for entry in hourly_comparison:
        running_today += entry['today']
        running_lw += entry['lastWeek']
        cumulative_today.append({'hour': entry['hour'], 'value': running_today})
        cumulative_lw.append({'hour': entry['hour'], 'value': running_lw})

    # --- KPI DELTAS ---
    today_total = len(df_today)
    lw_total = len(df_last_week)
    redemption_delta = today_total - lw_total
    redemption_pct = round(((today_total - lw_total) / lw_total) * 100, 1) if lw_total > 0 else 0

    # New unique active clients
    today_clients = set(df_today[ref_col].unique()) if not df_today.empty else set()
    lw_clients = set(df_last_week[ref_col].unique()) if not df_last_week.empty else set()
    new_clients_today = len(today_clients)
    new_clients_lw = len(lw_clients)
    client_delta = new_clients_today - new_clients_lw

    # Current rate (redemptions per hour since first redemption today)
    current_rate = 0
    if not df_today.empty and 'Hora' in df_today.columns:
        hours_active = df_today_h['hour'].max() - df_today_h['hour'].min() + 1
        current_rate = round(today_total / max(hours_active, 1), 1)

    # --- LINEAR PREDICTION ---
    prediction = None
    if not df_today.empty and 'Hora' in df_today.columns and len(hourly_today_counts) >= 2:
        import numpy as np
        hours_with_data = sorted(hourly_today_counts.index.tolist())
        values = [int(hourly_today_counts[h]) for h in hours_with_data]
        
        # Cumulative values for regression
        cum_values = []
        s = 0
        for v in values:
            s += v
            cum_values.append(s)
        
        x = np.array(hours_with_data, dtype=float)
        y = np.array(cum_values, dtype=float)
        
        # Linear regression
        if len(x) >= 2:
            slope, intercept = np.polyfit(x, y, 1)
            # Predict at hour 23 (end of day)
            predicted_total = max(int(slope * 23 + intercept), today_total)
            # Confidence: R² 
            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = round(1 - (ss_res / ss_tot), 2) if ss_tot > 0 else 0
            
            # Build prediction line from last known hour to 23
            prediction_line = []
            last_known_hour = max(hours_with_data)
            for h in range(last_known_hour, 24):
                pred_val = max(int(slope * h + intercept), today_total)
                prediction_line.append({'hour': f'{h:02d}:00', 'value': pred_val})
            
            prediction = {
                'predictedTotal': predicted_total,
                'confidence': r_squared,
                'slope': round(slope, 2),
                'predictionLine': prediction_line
            }

    # --- TOP PERFORMERS BY INCREMENT ---
    performance = {}
    for level in ['direccion', 'gerencia', 'supervisor', 'BDR']:
        curr_counts = df_today.groupby(level).size() if not df_today.empty else pd.Series(dtype=int)
        prev_counts = df_last_week.groupby(level).size() if not df_last_week.empty else pd.Series(dtype=int)
        
        # Unique clients per entity
        curr_clients = df_today.groupby(level)[ref_col].nunique() if not df_today.empty else pd.Series(dtype=int)
        prev_clients = df_last_week.groupby(level)[ref_col].nunique() if not df_last_week.empty else pd.Series(dtype=int)
        
        all_entities = set()
        if not curr_counts.empty: all_entities.update(curr_counts.index)
        if not prev_counts.empty: all_entities.update(prev_counts.index)
        
        perf_list = []
        for entity in all_entities:
            if pd.isna(entity): continue
            curr = int(curr_counts.get(entity, 0))
            prev = int(prev_counts.get(entity, 0))
            curr_cl = int(curr_clients.get(entity, 0))
            prev_cl = int(prev_clients.get(entity, 0))
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

    progress_data = {
        'redemptionsOverTime': redemptions_over_time,
        'hourlyComparison': hourly_comparison,
        'cumulativeToday': cumulative_today,
        'cumulativeLastWeek': cumulative_lw,
        'prediction': prediction,
        'performance': performance,
        'kpiDeltas': {
            'todayTotal': today_total,
            'lastWeekTotal': lw_total,
            'redemptionDelta': redemption_delta,
            'redemptionPct': redemption_pct,
            'newClientsToday': new_clients_today,
            'newClientsLW': new_clients_lw,
            'clientDelta': client_delta,
            'currentRate': current_rate,
        },
        'latest_date': latest_date.strftime('%d/%m/%Y') if pd.notnull(latest_date) else None,
        'last_week_date': last_week_date.strftime('%d/%m/%Y') if pd.notnull(last_week_date) else None
    }

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

