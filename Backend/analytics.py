import pandas as pd
import os

FIXED_FILE_PATH = os.path.join(os.path.dirname(__file__), "downloads", "Reposiciones Sabados Cusqueña 2026_act.xlsb")

def process_dashboard_data(dynamic_file_path: str):
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # Load fixed db
    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Actualizada', engine='pyxlsb')
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

    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Actualizada', engine='pyxlsb')
    df_fixed['cliente_id'] = df_fixed['cliente_id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)

    df_dyn = pd.read_excel(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')

    df_dyn_merged = pd.merge(df_dyn, df_fixed, left_on=ref_col, right_on='cliente_id', how='inner')

    date_a = pd.to_datetime(date_a_str, format='%d/%m/%Y')
    date_b = pd.to_datetime(date_b_str, format='%d/%m/%Y')

    return _build_comparison(df_dyn_merged, ref_col, date_a, date_b)


def get_waiter_rankings(dynamic_file_path: str, month_year: str = None):
    if not os.path.exists(dynamic_file_path):
        raise FileNotFoundError(f"Dynamic file not found: {dynamic_file_path}")

    # Load fixed db
    df_fixed = pd.read_excel(FIXED_FILE_PATH, sheet_name='Base_Actualizada', engine='pyxlsb')
    df_fixed['cliente_id'] = df_fixed['cliente_id'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    client_dict = df_fixed.set_index('cliente_id')['nombre_comercial'].to_dict()

    # Load dynamic db
    df_dyn = pd.read_excel(dynamic_file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)

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

    # Count total redemptions per restaurant in month
    if not df_month.empty:
        rest_counts = df_month.groupby(ref_col).size().reset_index(name='redemptions')
    else:
        rest_counts = pd.DataFrame(columns=[ref_col, 'redemptions'])

    # Qualified restaurants: >= 50 redemptions
    eligible_rests = rest_counts[rest_counts['redemptions'] >= 50]
    eligible_rest_ids = set(eligible_rests[ref_col])

    # Contest 1 & 2 logic
    contest1_winner = None
    contest2_list = []
    
    if not df_month.empty:
        df_qual = df_month[df_month[ref_col].isin(eligible_rest_ids)].copy()
        df_qual['Mesero'] = df_qual['Mesero'].fillna('').astype(str).str.strip()
        df_qual = df_qual[df_qual['Mesero'] != '']
        
        if not df_qual.empty:
            waiter_groups = df_qual.groupby(['Mesero', ref_col]).size().reset_index(name='redemptions')
            waiter_groups = waiter_groups.sort_values('redemptions', ascending=False).reset_index(drop=True)
            
            # Contest 1: Mejor Mozo Nacional
            if not waiter_groups.empty:
                top_waiter = waiter_groups.iloc[0]
                c_id = top_waiter[ref_col]
                rest_name = client_dict.get(c_id)
                if not rest_name:
                    fallback_df = df_month[df_month[ref_col] == c_id]
                    rest_name = fallback_df['Empresa'].iloc[0] if not fallback_df.empty else f"Restaurante {c_id}"
                
                contest1_winner = {
                    'rank': 1,
                    'waiter': top_waiter['Mesero'],
                    'client_id': c_id,
                    'restaurant_name': rest_name,
                    'redemptions': int(top_waiter['redemptions']),
                    'prize': "S/ 1,000"
                }
            
            # Contest 2: Top 100 Waiters
            for idx, row in waiter_groups.head(100).iterrows():
                c_id = row[ref_col]
                rest_name = client_dict.get(c_id)
                if not rest_name:
                    fallback_df = df_month[df_month[ref_col] == c_id]
                    rest_name = fallback_df['Empresa'].iloc[0] if not fallback_df.empty else f"Restaurante {c_id}"
                
                contest2_list.append({
                    'rank': idx + 1,
                    'waiter': row['Mesero'],
                    'client_id': c_id,
                    'restaurant_name': rest_name,
                    'redemptions': int(row['redemptions']),
                    'prize': "S/ 100"
                })

    # Contest 3: Best Waiters of the Top 10 Restaurants
    contest3_winners = []
    if not rest_counts.empty:
        top_10_rest = rest_counts.sort_values('redemptions', ascending=False).head(10).reset_index(drop=True)
        for rank_idx, row in top_10_rest.iterrows():
            c_id = row[ref_col]
            rest_redemptions = int(row['redemptions'])
            
            rest_name = client_dict.get(c_id)
            if not rest_name:
                fallback_df = df_month[df_month[ref_col] == c_id]
                rest_name = fallback_df['Empresa'].iloc[0] if not fallback_df.empty else f"Restaurante {c_id}"
                
            # Waiters for this restaurant
            df_rest_waiters = df_month[df_month[ref_col] == c_id].copy()
            df_rest_waiters['Mesero'] = df_rest_waiters['Mesero'].fillna('').astype(str).str.strip()
            df_rest_waiters = df_rest_waiters[df_rest_waiters['Mesero'] != '']
            
            best_waiter_name = "Sin mesero registrado"
            best_waiter_redemptions = 0
            
            if not df_rest_waiters.empty:
                w_counts = df_rest_waiters.groupby('Mesero').size().reset_index(name='redemptions')
                w_counts = w_counts.sort_values('redemptions', ascending=False)
                best_waiter_row = w_counts.iloc[0]
                best_waiter_name = best_waiter_row['Mesero']
                best_waiter_redemptions = int(best_waiter_row['redemptions'])
                
            contest3_winners.append({
                'restaurant_rank': rank_idx + 1,
                'client_id': c_id,
                'restaurant_name': rest_name,
                'restaurant_redemptions': rest_redemptions,
                'waiter': best_waiter_name,
                'waiter_redemptions': best_waiter_redemptions,
                'prize': "S/ 50"
            })

    return {
        'available_months': available_months,
        'selected_month': month_year,
        'contest1': contest1_winner,
        'contest2': contest2_list,
        'contest3': contest3_winners
    }


