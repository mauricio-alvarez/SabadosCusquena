import os
import pandas as pd

# File path
download_dir = os.environ.get("DATA_DIR", "/app/data" if os.environ.get("RENDER") else "./downloads")
file_path = os.path.join(download_dir, 'Reposiciones Sabados Cusqueña 2026.xlsb')

# Load sheets
base_clientes_df = pd.read_excel(
    file_path,
    sheet_name='Base_Clientes',
    engine='pyxlsb'
)

reporte_yape_raw_df = pd.read_excel(
    file_path,
    sheet_name='Reporte_Yape',
    engine='pyxlsb'
)

# Detect the real header row in Reporte_Yape
header_row_idx = None
for idx in range(min(15, len(reporte_yape_raw_df))):
    row_vals = [str(x).strip().lower() for x in reporte_yape_raw_df.iloc[idx].tolist()]
    row_text = ' | '.join(row_vals)
    if 'código de referencia' in row_text or 'codigo de referencia' in row_text or 'fecha' in row_text:
        header_row_idx = idx
        break

# Clean Reporte_Yape
reporte_yape_df = reporte_yape_raw_df.iloc[header_row_idx:].copy()
reporte_yape_df.columns = reporte_yape_df.iloc[0]
reporte_yape_df = reporte_yape_df.iloc[1:].reset_index(drop=True)

# Standardize fields in Base_Clientes
base_clientes_df['cliente_id'] = base_clientes_df['cliente_id'].astype(str).str.strip()
base_clientes_df['direccion'] = base_clientes_df['direccion'].astype(str).str.strip()
base_clientes_df['gerencia'] = base_clientes_df['gerencia'].astype(str).str.strip()
base_clientes_df['supervisor'] = base_clientes_df['supervisor'].astype(str).str.strip()

# Standardize fields in Reporte_Yape
reporte_yape_df['Código de referencia (Backus)'] = (
    reporte_yape_df['Código de referencia (Backus)'].astype(str).str.strip()
)
reporte_yape_df['direccion'] = reporte_yape_df['direccion'].astype(str).str.strip()
reporte_yape_df['Fecha_dt'] = pd.to_datetime(
    reporte_yape_df['Fecha'],
    dayfirst=True,
    errors='coerce'
)

# Filter only today's canjes
fecha_objetivo = '2026-05-16'
yape_today_df = reporte_yape_df[
    reporte_yape_df['Fecha_dt'].dt.strftime('%Y-%m-%d') == fecha_objetivo
].copy()

# Count total redemptions by direccion + client
redenciones_df = (
    yape_today_df
    .groupby(['direccion', 'Código de referencia (Backus)'])
    .size()
    .reset_index(name='Redenciones Tot')
)

# Merge client universe with redemptions
base_status_df = base_clientes_df.merge(
    redenciones_df,
    left_on=['direccion', 'cliente_id'],
    right_on=['direccion', 'Código de referencia (Backus)'],
    how='left'
)

base_status_df['Redenciones Tot'] = (
    pd.to_numeric(base_status_df['Redenciones Tot'], errors='coerce')
    .fillna(0)
    .astype(int)
)

# Flag active POCs
base_status_df['POCS Redimiendo'] = (base_status_df['Redenciones Tot'] > 0).astype(int)

# Build first sheet summary table
detalle_sup_df = (
    base_status_df
    .groupby(['direccion', 'gerencia', 'supervisor'], dropna=False)
    .agg(
        **{
            '#POCS': ('cliente_id', 'nunique'),
            'POCS Redimiendo': ('POCS Redimiendo', 'sum'),
            'Redenciones Tot': ('Redenciones Tot', 'sum')
        }
    )
    .reset_index()
)

# Calculate metrics
detalle_sup_df['Adh'] = (
    detalle_sup_df['POCS Redimiendo'] / detalle_sup_df['#POCS']
).fillna(0)

detalle_sup_df['Oportunidad'] = 1 - detalle_sup_df['Adh']

detalle_sup_df['Prom x poc'] = (
    detalle_sup_df['Redenciones Tot'] / detalle_sup_df['POCS Redimiendo']
).replace([float('inf')], 0).fillna(0)

# Format percentages
detalle_sup_df['Adh'] = (detalle_sup_df['Adh'] * 100).round(1)
detalle_sup_df['Oportunidad'] = (detalle_sup_df['Oportunidad'] * 100).round(1)
detalle_sup_df['Prom x poc'] = detalle_sup_df['Prom x poc'].round(2)

# Sort final table
detalle_sup_df = detalle_sup_df.sort_values(
    ['direccion', 'gerencia', 'supervisor']
).reset_index(drop=True)

# Preview
print(detalle_sup_df.head())

# Optional export
detalle_sup_df.to_excel('Detalle_Sup.xlsx', index=False)