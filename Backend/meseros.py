import os
import pandas as pd
import numpy as np

def run_calculations():
    file_path = "./downloads/canjes-institucion_30-05-2026_18-12-19.xlsx"
    if not os.path.exists(file_path):
        print("File not found")
        return
        
    df = pd.read_excel(file_path)
    ref_col = 'Código de referencia (CERVECERIAS PERUANAS BACKUS SA)'
    df[ref_col] = df[ref_col].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
    
    # Parse month
    df['Fecha_dt'] = pd.to_datetime(df['Fecha'], format='%d/%m/%Y', errors='coerce')
    df['Month_Key'] = df['Fecha_dt'].dt.strftime('%m/%Y')
    
    print("Unique months in dataset:", df['Month_Key'].dropna().unique())
    
    # Filter for May 2026 (05/2026)
    df_may = df[df['Month_Key'] == '05/2026'].copy()
    print(f"Total transactions in May 2026: {len(df_may)}")
    
    # 1. Total redemptions per restaurant in May
    rest_counts = df_may.groupby(ref_col).size().reset_index(name='redemptions')
    print(f"Total restaurants in May: {len(rest_counts)}")
    
    # Qualified restaurants (redemptions >= 50)
    qual_rest = rest_counts[rest_counts['redemptions'] >= 50]
    qual_rest_ids = set(qual_rest[ref_col])
    print(f"Qualified restaurants (redemptions >= 50) in May: {len(qual_rest)}")
    
    # Filter May transactions to only qualified restaurants
    df_may_qual = df_may[df_may[ref_col].isin(qual_rest_ids)].copy()
    print(f"Transactions in qualified restaurants: {len(df_may_qual)}")
    
    # Group by Waiter (Mesero)
    # Filter out empty or null waiter names
    df_may_qual['Mesero'] = df_may_qual['Mesero'].fillna('').astype(str).str.strip()
    df_may_qual = df_may_qual[df_may_qual['Mesero'] != '']
    
    waiter_counts = df_may_qual.groupby(['Mesero', ref_col, 'Empresa']).size().reset_index(name='redemptions')
    waiter_counts = waiter_counts.sort_values('redemptions', ascending=False)
    
    print("\n--- Contest 1: Mejor Mozo a Nivel Nacional ---")
    if not waiter_counts.empty:
        top_waiter = waiter_counts.iloc[0]
        print(f"Winner: {top_waiter['Mesero']}")
        print(f"Restaurant: {top_waiter['Empresa']} ({top_waiter[ref_col]})")
        print(f"Redemptions: {top_waiter['redemptions']}")
    else:
        print("No waiters found")
        
    print("\n--- Contest 2: Los Mejores 100 Mozos (Top 10) ---")
    top_100 = waiter_counts.head(100)
    for idx, r in top_100.head(10).iterrows():
        print(f"  {r['Mesero']} - {r['Empresa']}: {r['redemptions']} redemptions")
        
    # Contest 3: Best Waiter from the Top 10 Restaurants
    print("\n--- Contest 3: Mejor Mozo de los Mejores 10 Restaurantes ---")
    top_10_rest = rest_counts.sort_values('redemptions', ascending=False).head(10)
    top_10_rest_ids = set(top_10_rest[ref_col])
    print("Top 10 Restaurants in May:")
    for idx, r in top_10_rest.iterrows():
        # find name from df
        name = df_may[df_may[ref_col] == r[ref_col]]['Empresa'].iloc[0]
        print(f"  {name} ({r[ref_col]}): {r['redemptions']} redemptions")
        
    # Filter May transactions for top 10 restaurants, then group by Waiter
    df_may_top_10 = df_may[df_may[ref_col].isin(top_10_rest_ids)].copy()
    df_may_top_10['Mesero'] = df_may_top_10['Mesero'].fillna('').astype(str).str.strip()
    df_may_top_10 = df_may_top_10[df_may_top_10['Mesero'] != '']
    
    waiter_top_10_counts = df_may_top_10.groupby(['Mesero', ref_col, 'Empresa']).size().reset_index(name='redemptions')
    waiter_top_10_counts = waiter_top_10_counts.sort_values('redemptions', ascending=False)
    
    if not waiter_top_10_counts.empty:
        top_waiter_top_10 = waiter_top_10_counts.iloc[0]
        print(f"\nWinner for Contest 3: {top_waiter_top_10['Mesero']}")
        print(f"Restaurant: {top_waiter_top_10['Empresa']} ({top_waiter_top_10[ref_col]})")
        print(f"Redemptions: {top_waiter_top_10['redemptions']}")
    else:
        print("No waiters found in top 10 restaurants")

if __name__ == "__main__":
    run_calculations()