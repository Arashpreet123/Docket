import requests
import random
import time
import os

API = os.environ.get('API_URL', 'http://backend:8000/api')

SOURCES = ['sensor_1', 'sensor_2', 'sensor_3']
TYPES = ['temperature', 'pressure', 'humidity']

print("Simulator starting...")

while True:
    payload = {
        'source': random.choice(SOURCES),
        'type': random.choice(TYPES),
        'value': round(random.uniform(60, 110), 2),
    }
    try:
        res = requests.post(f'{API}/events/', json=payload, timeout=3)
        alert = '🔴 ALERT' if res.json().get('alert') else '  '
        print(f"{alert}  {payload['source']} / {payload['type']}: {payload['value']}")
    except Exception as e:
        print(f"Connection error: {e}")
    time.sleep(1)