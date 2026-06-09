import sys
import os
import pandas as pd

sys.path.append(os.path.abspath(r"c:\Users\asus\Desktop\SabadosCusquena\Backend"))

from analytics import process_dashboard_data

dynamic_file_path = r"c:\Users\asus\Desktop\SabadosCusquena\Backend\downloads\canjes-institucion_30-05-2026_10-30-00.xlsx"

# Let's inspect the dates and Q1 thresholds directly using code from analytics.py
df_dyn = pd.read_excel(dynamic_file_path)
ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
df_dyn[ref_col] = df_dyn[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)

df_dyn['Fecha_dt'] = pd.to_datetime(df_dyn['Fecha'], format='%d/%m/%Y', errors='coerce')
df_sats = df_dyn[df_dyn['Fecha_dt'].dt.dayofweek == 5]
saturdays_list = sorted(df_sats['Fecha'].dropna().unique(), key=lambda x: pd.to_datetime(x, format='%d/%m/%Y'))

print("All Saturdays in database:", saturdays_list)

sat_q1 = {}
for sat in saturdays_list:
    df_sat = df_sats[df_sats['Fecha'] == sat]
    counts = df_sat.groupby(ref_col).size().tolist()
    if counts:
        sat_q1[sat] = pd.Series(counts).quantile(0.25)
    else:
        sat_q1[sat] = 0

print("Saturday Q1s:", sat_q1)

# Let's see client 10025123's records
client_id = "10025123"
c_records = df_dyn[df_dyn[ref_col] == client_id]
print(f"\nRecords for client {client_id}:")
print(c_records[['Fecha', 'Hora']])

# Let's look at get_client_type for this client
res = process_dashboard_data(dynamic_file_path)
clients = res['clients']
matched = [c for c in clients if c['cliente_id'] == client_id]
if matched:
    print("\nClient info from process_dashboard_data:")
    print(matched[0])