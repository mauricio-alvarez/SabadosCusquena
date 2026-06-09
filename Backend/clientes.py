import pandas as pd

import os

# =========================
# 1. Config
# =========================
download_dir = os.environ.get("DATA_DIR", "/app/data" if os.environ.get("RENDER") else "./downloads")
file_path = os.path.join(download_dir, 'Reposiciones Sabados Cusqueña 2026.xlsb')
target_date = '2026-05-16'  # change if needed

# =========================
# 2. Load source sheets
# =========================
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

# =========================
# 3. Detect real header row in Reporte_Yape
# =========================
header_row_idx = None

for idx in range(min(15, len(reporte_yape_raw_df))):
    row_vals = [str(x).strip().lower() for x in reporte_yape_raw_df.iloc[idx].tolist()]
    row_text = ' | '.join(row_vals)

    if (
        'código de referencia' in row_text
        or 'codigo de referencia' in row_text
        or 'fecha' in row_text
    ):
        header_row_idx = idx
        break

if header_row_idx is None:
    raise ValueError('No se pudo detectar la fila de encabezados en Reporte_Yape')

# =========================
# 4. Clean Reporte_Yape
# =========================
reporte_yape_df = reporte_yape_raw_df.iloc[header_row_idx:].copy()
reporte_yape_df.columns = reporte_yape_df.iloc[0]
reporte_yape_df = reporte_yape_df.iloc[1:].reset_index(drop=True)

# Normalize key fields
reporte_yape_df['Código de referencia (Backus)'] = (
    reporte_yape_df['Código de referencia (Backus)']
    .astype(str)
    .str.strip()
)

reporte_yape_df['direccion'] = (
    reporte_yape_df['direccion']
    .astype(str)
    .str.strip()
)

reporte_yape_df['Fecha_dt'] = pd.to_datetime(
    reporte_yape_df['Fecha'],
    dayfirst=True,
    errors='coerce'
)

# Keep only target date
reporte_yape_today_df = reporte_yape_df[
    reporte_yape_df['Fecha_dt'].dt.strftime('%Y-%m-%d') == target_date
].copy()

# =========================
# 5. Clean Base_Clientes
# =========================
base_clientes_work_df = base_clientes_df.copy()

base_clientes_work_df['cliente_id'] = (
    base_clientes_work_df['cliente_id']
    .astype(str)
    .str.strip()
)

base_clientes_work_df['nombre_comercial'] = (
    base_clientes_work_df['nombre_comercial']
    .astype(str)
    .str.strip()
)

base_clientes_work_df['direccion'] = (
    base_clientes_work_df['direccion']
    .astype(str)
    .str.strip()
)

base_clientes_work_df['gerencia'] = (
    base_clientes_work_df['gerencia']
    .astype(str)
    .str.strip()
)

base_clientes_work_df['supervisor'] = (
    base_clientes_work_df['supervisor']
    .astype(str)
    .str.strip()
)

# =========================
# 6. Aggregate redemptions by client
# =========================
redenciones_cliente_df = (
    reporte_yape_today_df
    .groupby(['direccion', 'Código de referencia (Backus)'])
    .size()
    .reset_index(name='Redenciones Tot')
)

# =========================
# 7. Join with client base
# =========================
detalle_cliente_df = base_clientes_work_df.merge(
    redenciones_cliente_df,
    left_on=['direccion', 'cliente_id'],
    right_on=['direccion', 'Código de referencia (Backus)'],
    how='left'
)

detalle_cliente_df['Redenciones Tot'] = pd.to_numeric(
    detalle_cliente_df['Redenciones Tot'],
    errors='coerce'
).fillna(0).astype(int)

# =========================
# 8. Build requested KPI columns
# =========================
detalle_cliente_df['#POCS'] = 1
detalle_cliente_df['POCS Redimiendo'] = (detalle_cliente_df['Redenciones Tot'] > 0).astype(int)
detalle_cliente_df['Adh'] = detalle_cliente_df['POCS Redimiendo'] * 100.0
detalle_cliente_df['Oportunidad'] = 100.0 - detalle_cliente_df['Adh']
detalle_cliente_df['Prom x poc'] = detalle_cliente_df['Redenciones Tot'].astype(float).round(2)

# =========================
# 9. Select final columns
# =========================
detalle_cliente_df = detalle_cliente_df[
    [
        'direccion',
        'gerencia',
        'supervisor',
        'cliente_id',
        'nombre_comercial',
        '#POCS',
        'POCS Redimiendo',
        'Adh',
        'Oportunidad',
        'Redenciones Tot',
        'Prom x poc'
    ]
].copy()

# =========================
# 10. Sort final table
# =========================
detalle_cliente_df = detalle_cliente_df.sort_values(
    ['direccion', 'gerencia', 'supervisor', 'nombre_comercial', 'cliente_id']
).reset_index(drop=True)

# =========================
# 11. Preview
# =========================
print(detalle_cliente_df.head())

# =========================
# 12. Export
# =========================
output_file = 'Detalle_Clientes_2026-05-16.xlsx'
detalle_cliente_df.to_excel(output_file, index=False)

print(output_file)