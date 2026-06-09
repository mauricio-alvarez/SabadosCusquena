import sys
import os

# Add Backend folder to path
sys.path.append(os.path.abspath(r"c:\Users\asus\Desktop\SabadosCusquena\Backend"))

from analytics import process_dashboard_data

dynamic_file_path = r"c:\Users\asus\Desktop\SabadosCusquena\Backend\downloads\canjes-institucion_30-05-2026_10-30-00.xlsx"

print("Running process_dashboard_data...")
try:
    res = process_dashboard_data(dynamic_file_path)
    clients = res['clients']
    print(f"Total clients processed: {len(clients)}")
    
    # Check Ola distribution
    olas = [c.get('Ola', 1) for c in clients]
    from collections import Counter
    print("Ola distribution in processed clients:", Counter(olas))
    
    # Check Tipo distribution for Ola 1 vs Ola 2
    ola1_tipos = [c.get('Tipo') for c in clients if c.get('Ola') == 1]
    ola2_tipos = [c.get('Tipo') for c in clients if c.get('Ola') == 2]
    
    print("Ola 1 Tipo distribution:", Counter(ola1_tipos))
    print("Ola 2 Tipo distribution:", Counter(ola2_tipos))
    
    # Print a few samples of Ola 2 clients
    ola2_clients = [c for c in clients if c.get('Ola') == 2]
    print("\nSample Ola 2 clients:")
    for c in ola2_clients[:5]:
        print(f"ID: {c['cliente_id']}, Name: {c['nombre_comercial']}, Tipo: {c['Tipo']}, Redemptions: {c['redemptions']}, Dates: {c['redemption_dates']}")

except Exception as e:
    import traceback
    traceback.print_exc()