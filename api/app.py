"""
CropStack Sensor API — Flask Backend
Serves real-time sensor data, market prices, orders, and transactions.
Includes an admin dashboard with Firestore integration for hub/organizer management.
Sensor data is stored locally to save Firestore read/write costs.
"""

from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_cors import CORS
from functools import wraps
import time
import random
import threading
import json
import os
import uuid
from datetime import datetime, timedelta

# ─────────────────────────────────────────────
#  FIREBASE ADMIN SDK INIT
# ─────────────────────────────────────────────

import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK
# Use a service account key file if available, otherwise use application default credentials
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')

if os.path.exists(SERVICE_ACCOUNT_PATH):
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
else:
    # Fallback: try default credentials
    try:
        firebase_admin.initialize_app()
    except Exception:
        print("⚠️  No Firebase credentials found. Firestore features will be disabled.")
        firebase_admin._apps.clear()

firestore_db = None
try:
    firestore_db = firestore.client()
    print("✅ Firestore connected successfully")
except Exception as e:
    print(f"⚠️  Firestore unavailable: {e}")


app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'cropstack-admin-secret-key-change-in-production'
CORS(app)

# ─────────────────────────────────────────────
#  ADMIN CREDENTIALS (hardcoded for simplicity)
# ─────────────────────────────────────────────

ADMIN_CREDENTIALS = {
    'admin@cropstack.com': 'admin123',
}

# ─────────────────────────────────────────────
#  IN-MEMORY DATA STORE
# ─────────────────────────────────────────────

sensor_data = {
    "temperature": 28.5,
    "humidity": 65.0,
    "soil_moisture": 42.0,
    "light_intensity": 780.0,
    "ph_level": 6.8,
    "wind_speed": 12.5,
    "rainfall": 0.0,
    "co2_level": 410.0,
    "pressure": 1013.25,
    "uv_index": 5.2,
}

sensor_history = {key: [] for key in sensor_data}

# ─────────────────────────────────────────────
#  HUB DATA STORE (local — no Firestore writes for sensor data)
# ─────────────────────────────────────────────

# Each hub: { id, name, organizer_id, organizer_email, temperature, moisture, last_updated, status }
hubs_data = {}

def generate_hub_id():
    """Generate a short unique hub ID."""
    return f"HUB-{uuid.uuid4().hex[:6].upper()}"

def load_hubs_from_firestore():
    """Load all hubs from the Firestore 'hubs' collection on startup."""
    global hubs_data
    if not firestore_db:
        print("⚠️  Firestore not available — starting with empty hub list")
        return
    try:
        hubs_ref = firestore_db.collection('hubs')
        docs = hubs_ref.get()
        for d in docs:
            data = d.to_dict()
            hub_id = d.id
            hubs_data[hub_id] = {
                "id": hub_id,
                "name": data.get("name", "Unnamed Hub"),
                "organizer_id": data.get("organizer_id", ""),
                "organizer_email": data.get("organizer_email", ""),
                "temperature": data.get("temperature", 25.0),
                "moisture": data.get("moisture", 50.0),
                "last_updated": data.get("last_updated", datetime.now().isoformat()),
                "status": data.get("status", "online"),
            }
        print(f"✅ Loaded {len(hubs_data)} hubs from Firestore")
    except Exception as e:
        print(f"⚠️  Error loading hubs from Firestore: {e}")

def sync_hub_to_firestore(hub_id, hub_data):
    """Write a hub's metadata to Firestore (not sensor readings to save cost)."""
    if not firestore_db:
        return
    try:
        hub_doc = {
            "name": hub_data["name"],
            "organizer_id": hub_data.get("organizer_id", ""),
            "organizer_email": hub_data.get("organizer_email", ""),
            "status": hub_data.get("status", "online"),
            "temperature": hub_data.get("temperature", 25.0),
            "moisture": hub_data.get("moisture", 50.0),
            "last_updated": hub_data.get("last_updated", datetime.now().isoformat()),
        }
        firestore_db.collection('hubs').document(hub_id).set(hub_doc, merge=True)
    except Exception as e:
        print(f"⚠️  Firestore sync error for hub {hub_id}: {e}")

def delete_hub_from_firestore(hub_id):
    """Delete a hub from Firestore."""
    if not firestore_db:
        return
    try:
        firestore_db.collection('hubs').document(hub_id).delete()
    except Exception as e:
        print(f"⚠️  Firestore delete error for hub {hub_id}: {e}")

load_hubs_from_firestore()

# Hub sensor history (local only — never sent to Firestore to save costs)
hub_sensor_history = {}  # { hub_id: [ { time, temperature, moisture }, ... ] }


market_data = [
    {"name": "Basmati Rice", "price": 4540.00, "change": 4.2, "change_7d": 6.8, "volume": "142k q", "trend": "bullish", "category": "grain", "msp": 2183, "high": 4680, "low": 4390, "unit": "per quintal"},
    {"name": "Red Wheat", "price": 2110.00, "change": -1.5, "change_7d": -3.2, "volume": "89k q", "trend": "bearish", "category": "grain", "msp": 2125, "high": 2190, "low": 2050, "unit": "per quintal"},
    {"name": "Sona Masuri", "price": 3850.00, "change": 0.8, "change_7d": 2.1, "volume": "56k q", "trend": "stable", "category": "grain", "msp": 2183, "high": 3920, "low": 3780, "unit": "per quintal"},
    {"name": "Black Gram", "price": 7200.00, "change": 12.4, "change_7d": 18.5, "volume": "12k q", "trend": "bullish", "category": "pulse", "msp": 6950, "high": 7400, "low": 6800, "unit": "per quintal"},
    {"name": "Yellow Maize", "price": 1885.00, "change": -2.1, "change_7d": -4.5, "volume": "204k q", "trend": "bearish", "category": "grain", "msp": 1962, "high": 1950, "low": 1820, "unit": "per quintal"},
    {"name": "Soybeans", "price": 3222.00, "change": 0.8, "change_7d": 1.4, "volume": "67k q", "trend": "stable", "category": "oilseed", "msp": 4600, "high": 3300, "low": 3150, "unit": "per quintal"},
    {"name": "Pulses Mix", "price": 6535.00, "change": -2.1, "change_7d": -5.0, "volume": "34k q", "trend": "bearish", "category": "pulse", "msp": 6600, "high": 6700, "low": 6400, "unit": "per quintal"},
    {"name": "Toor Dal", "price": 8950.00, "change": 3.6, "change_7d": 7.2, "volume": "28k q", "trend": "bullish", "category": "pulse", "msp": 7000, "high": 9100, "low": 8700, "unit": "per quintal"},
    {"name": "Groundnut", "price": 5680.00, "change": 1.2, "change_7d": 3.8, "volume": "45k q", "trend": "bullish", "category": "oilseed", "msp": 5850, "high": 5750, "low": 5550, "unit": "per quintal"},
    {"name": "Mustard Seed", "price": 4920.00, "change": -0.5, "change_7d": 0.9, "volume": "78k q", "trend": "stable", "category": "oilseed", "msp": 5450, "high": 5000, "low": 4850, "unit": "per quintal"},
    {"name": "Cotton", "price": 6280.00, "change": 2.8, "change_7d": 4.1, "volume": "92k q", "trend": "bullish", "category": "fiber", "msp": 6620, "high": 6350, "low": 6100, "unit": "per quintal"},
    {"name": "Sugarcane", "price": 315.00, "change": 0.3, "change_7d": 0.5, "volume": "520k q", "trend": "stable", "category": "cash_crop", "msp": 315, "high": 320, "low": 310, "unit": "per quintal"},
    {"name": "Turmeric", "price": 12800.00, "change": 5.4, "change_7d": 11.2, "volume": "8k q", "trend": "bullish", "category": "spice", "msp": 0, "high": 13200, "low": 12200, "unit": "per quintal"},
    {"name": "Green Chilli", "price": 3200.00, "change": -8.5, "change_7d": -15.2, "volume": "18k q", "trend": "bearish", "category": "vegetable", "msp": 0, "high": 3800, "low": 3000, "unit": "per quintal"},
    {"name": "Onion", "price": 1450.00, "change": -3.2, "change_7d": -6.8, "volume": "310k q", "trend": "bearish", "category": "vegetable", "msp": 0, "high": 1600, "low": 1380, "unit": "per quintal"},
]

buyer_stats = {
    "active_orders": 14,
    "reservations": 8,
    "completed": 102,
    "savings": 4200.00,
    "order_growth": 12.4,
}

seller_stats = {
    "available_balance": 24500.00,
    "pending_payments": 8200.00,
    "monthly_yield": 32700.00,
    "monthly_growth": 18.4,
    "silo_efficiency": 92.4,
    "node_sync": 94.0,
    "silo_utilization": 78.4,
}

organizer_stats = {
    "active_queue": 7,
    "gate_traffic": 5,
    "hub_security": 99.8,
    "flow_volume": 145000.00,
}

orders_data = [
    {
        "id": "ord-001",
        "pickup_code": "PIN-4829",
        "buyer_name": "Rajesh Kumar",
        "product_name": "Basmati Rice",
        "quantity": 50,
        "total_price": 227000.00,
        "product_id": "prd-a1b2",
        "status": "reserved",
        "created_at": (datetime.now() - timedelta(hours=2)).isoformat()
    },
    {
        "id": "ord-002",
        "pickup_code": "PIN-7351",
        "buyer_name": "Anita Sharma",
        "product_name": "Red Wheat",
        "quantity": 100,
        "total_price": 211000.00,
        "product_id": "prd-c3d4",
        "status": "reserved",
        "created_at": (datetime.now() - timedelta(hours=5)).isoformat()
    },
    {
        "id": "ord-003",
        "pickup_code": "PIN-9102",
        "buyer_name": "Mohammed Ali",
        "product_name": "Black Gram",
        "quantity": 20,
        "total_price": 144000.00,
        "product_id": "prd-e5f6",
        "status": "reserved",
        "created_at": (datetime.now() - timedelta(hours=8)).isoformat()
    },
    {
        "id": "ord-004",
        "pickup_code": "PIN-5540",
        "buyer_name": "Priya Nair",
        "product_name": "Sona Masuri",
        "quantity": 30,
        "total_price": 115500.00,
        "product_id": "prd-g7h8",
        "status": "reserved",
        "created_at": (datetime.now() - timedelta(hours=12)).isoformat()
    },
]

transactions_data = [
    {
        "id": "txn-001",
        "order_id": "ord-a1b2c3",
        "amount": 45000.00,
        "status": "cleared",
        "created_at": (datetime.now() - timedelta(days=1)).isoformat()
    },
    {
        "id": "txn-002",
        "order_id": "ord-d4e5f6",
        "amount": 18200.00,
        "status": "held",
        "created_at": (datetime.now() - timedelta(days=2)).isoformat()
    },
    {
        "id": "txn-003",
        "order_id": "ord-g7h8i9",
        "amount": 32000.00,
        "status": "cleared",
        "created_at": (datetime.now() - timedelta(days=3)).isoformat()
    },
    {
        "id": "txn-004",
        "order_id": "ord-j0k1l2",
        "amount": 12500.00,
        "status": "held",
        "created_at": (datetime.now() - timedelta(days=4)).isoformat()
    },
    {
        "id": "txn-005",
        "order_id": "ord-m3n4o5",
        "amount": 67800.00,
        "status": "cleared",
        "created_at": (datetime.now() - timedelta(days=5)).isoformat()
    },
]

monthly_chart_data = [40, 70, 45, 90, 65, 80, 55, 75, 50, 85, 60, 95]

cluster_health = [
    {"name": "North-WH Cluster", "value": 88, "color": "#059669"},
    {"name": "West-Silo Cluster", "value": 42, "color": "#f59e0b"},
    {"name": "South-Storage Grid", "value": 65, "color": "#059669"},
    {"name": "East-Node Hub", "value": 24, "color": "#ef4444"},
]

network_stats = {
    "supply_index": 84.2,
    "storage_utilization": 72.4,
    "escrow_liquidity": 420,
    "market_sentiment": "Bullish",
}

# Record sensor history periodically
def record_history():
    while True:
        ts = datetime.now().isoformat()
        for key, val in sensor_data.items():
            sensor_history[key].append({"time": ts, "value": val})
            # Keep last 100 data points
            if len(sensor_history[key]) > 100:
                sensor_history[key] = sensor_history[key][-100:]
        
        # Record hub sensor history
        for hub_id, hub in hubs_data.items():
            if hub_id not in hub_sensor_history:
                hub_sensor_history[hub_id] = []
            hub_sensor_history[hub_id].append({
                "time": ts,
                "temperature": hub["temperature"],
                "moisture": hub["moisture"],
            })
            if len(hub_sensor_history[hub_id]) > 100:
                hub_sensor_history[hub_id] = hub_sensor_history[hub_id][-100:]
        
        time.sleep(5)

history_thread = threading.Thread(target=record_history, daemon=True)
history_thread.start()


# ─────────────────────────────────────────────
#  AUTH HELPERS
# ─────────────────────────────────────────────

def admin_required(f):
    """Decorator to require admin login for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function


# ─────────────────────────────────────────────
#  FIRESTORE HELPERS
# ─────────────────────────────────────────────

def get_organizers_from_firestore():
    """Fetch all organizer profiles from Firestore."""
    if not firestore_db:
        return []
    try:
        profiles_ref = firestore_db.collection('profiles')
        query = profiles_ref.where('role', '==', 'organizer')
        docs = query.get()
        organizers = []
        for doc in docs:
            data = doc.to_dict()
            data['uid'] = doc.id
            organizers.append(data)
        return organizers
    except Exception as e:
        print(f"Error fetching organizers: {e}")
        return []

def get_all_profiles_from_firestore():
    """Fetch all profiles from Firestore."""
    if not firestore_db:
        return []
    try:
        profiles_ref = firestore_db.collection('profiles')
        docs = profiles_ref.get()
        profiles = []
        for doc in docs:
            data = doc.to_dict()
            data['uid'] = doc.id
            profiles.append(data)
        return profiles
    except Exception as e:
        print(f"Error fetching profiles: {e}")
        return []


# ─────────────────────────────────────────────
#  ADMIN DASHBOARD ROUTES
# ─────────────────────────────────────────────

@app.route('/')
def index():
    """Redirect to login or dashboard."""
    if session.get('admin_logged_in'):
        return redirect(url_for('admin_dashboard'))
    return redirect(url_for('admin_login'))


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page."""
    if request.method == 'POST':
        email = request.form.get('email', '')
        password = request.form.get('password', '')
        
        if email in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[email] == password:
            session['admin_logged_in'] = True
            session['admin_email'] = email
            return redirect(url_for('admin_dashboard'))
        else:
            return render_template('login.html', error='Invalid credentials. Please try again.')
    
    return render_template('login.html', error=None)


@app.route('/admin/logout')
def admin_logout():
    """Admin logout."""
    session.clear()
    return redirect(url_for('admin_login'))


@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    """Serve the admin dashboard."""
    return render_template('dashboard.html', admin_email=session.get('admin_email', ''))


# ─────────────────────────────────────────────
#  HUB MANAGEMENT API ENDPOINTS
# ─────────────────────────────────────────────

@app.route('/api/hubs', methods=['GET'])
def get_hubs():
    """Get all hubs with their sensor data. Supports filtering by organizer_id or organizer_email."""
    organizer_id = request.args.get('organizer_id')
    organizer_email = request.args.get('organizer_email')
    
    if organizer_id:
        filtered = {k: v for k, v in hubs_data.items() if v.get('organizer_id') == organizer_id}
        return jsonify({"hubs": list(filtered.values()), "timestamp": datetime.now().isoformat()})
    
    if organizer_email:
        filtered = {k: v for k, v in hubs_data.items() if v.get('organizer_email') == organizer_email}
        return jsonify({"hubs": list(filtered.values()), "timestamp": datetime.now().isoformat()})
    
    return jsonify({"hubs": list(hubs_data.values()), "timestamp": datetime.now().isoformat()})


@app.route('/api/hubs/<hub_id>', methods=['GET'])
def get_hub(hub_id):
    """Get a specific hub by ID."""
    if hub_id not in hubs_data:
        return jsonify({"error": f"Hub '{hub_id}' not found"}), 404
    
    hub = hubs_data[hub_id]
    history = hub_sensor_history.get(hub_id, [])[-20:]
    
    return jsonify({
        "hub": hub,
        "history": history,
        "timestamp": datetime.now().isoformat()
    })


@app.route('/admin/hubs/<hub_id>/edit')
@admin_required
def edit_hub_page(hub_id):
    """Serve the page to manually update hub sensor data."""
    if hub_id not in hubs_data:
        return redirect(url_for('admin_dashboard'))
    hub = hubs_data[hub_id]
    return render_template('edit_hub.html', hub=hub)


@app.route('/admin/hubs/<hub_id>/update-sensors', methods=['POST'])
@admin_required
def update_hub_sensors_manual(hub_id):
    """Manually update hub sensors from the edit page."""
    if hub_id not in hubs_data:
        return jsonify({"error": "Hub not found"}), 404
        
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    hub = hubs_data[hub_id]
    
    if 'temperature' in data:
        hub['temperature'] = round(float(data['temperature']), 1)
    if 'moisture' in data:
        hub['moisture'] = round(float(data['moisture']), 1)
        
    hub['last_updated'] = datetime.now().isoformat()
    hub['status'] = 'online'
    
    # Record to history
    if hub_id not in hub_sensor_history:
        hub_sensor_history[hub_id] = []
    hub_sensor_history[hub_id].append({
        "time": datetime.now().isoformat(),
        "temperature": hub['temperature'],
        "moisture": hub['moisture'],
    })
    
    return jsonify({"message": "Hub sensors updated successfully", "hub": hub})


@app.route('/api/hubs', methods=['POST'])
def create_hub():
    """Create a new hub and sync to Firestore."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"error": "Hub name is required"}), 400
    
    hub_id = generate_hub_id()
    hub = {
        "id": hub_id,
        "name": data['name'],
        "organizer_id": data.get('organizer_id', ''),
        "organizer_email": data.get('organizer_email', ''),
        "temperature": data.get('temperature', 25.0),
        "moisture": data.get('moisture', 50.0),
        "last_updated": datetime.now().isoformat(),
        "status": "online",
    }
    hubs_data[hub_id] = hub
    
    # Sync to Firestore
    sync_hub_to_firestore(hub_id, hub)
    
    return jsonify({"hub": hub, "message": "Hub created successfully", "timestamp": datetime.now().isoformat()}), 201


@app.route('/api/hubs/<hub_id>', methods=['PUT'])
def update_hub(hub_id):
    """Update hub details and sync to Firestore."""
    if hub_id not in hubs_data:
        return jsonify({"error": f"Hub '{hub_id}' not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    hub = hubs_data[hub_id]
    for key in ['name', 'organizer_id', 'organizer_email', 'status']:
        if key in data:
            hub[key] = data[key]
    
    hub['last_updated'] = datetime.now().isoformat()
    
    # Sync to Firestore
    sync_hub_to_firestore(hub_id, hub)
    
    return jsonify({"hub": hub, "message": "Hub updated", "timestamp": datetime.now().isoformat()})


@app.route('/api/hubs/<hub_id>', methods=['DELETE'])
def delete_hub(hub_id):
    """Delete a hub and remove from Firestore."""
    if hub_id not in hubs_data:
        return jsonify({"error": f"Hub '{hub_id}' not found"}), 404
    
    del hubs_data[hub_id]
    if hub_id in hub_sensor_history:
        del hub_sensor_history[hub_id]
    
    # Remove from Firestore
    delete_hub_from_firestore(hub_id)
    
    return jsonify({"message": f"Hub {hub_id} deleted", "timestamp": datetime.now().isoformat()})


# ─────────────────────────────────────────────
#  SENSOR INGESTION ENDPOINT (for IoT devices)
# ─────────────────────────────────────────────

@app.route('/api/hubs/<hub_id>/sensors', methods=['POST', 'PUT'])
def ingest_hub_sensor_data(hub_id):
    """
    Endpoint for sensors to send data to update a specific hub ID.
    Accepts JSON: { "temperature": 28.5, "moisture": 42.0 }
    Data is stored locally only (not sent to Firestore).
    """
    if hub_id not in hubs_data:
        return jsonify({"error": f"Hub '{hub_id}' not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    hub = hubs_data[hub_id]
    
    if 'temperature' in data:
        try:
            hub['temperature'] = round(float(data['temperature']), 1)
        except (ValueError, TypeError):
            pass
    
    if 'moisture' in data:
        try:
            hub['moisture'] = round(float(data['moisture']), 1)
        except (ValueError, TypeError):
            pass
    
    hub['last_updated'] = datetime.now().isoformat()
    hub['status'] = 'online'
    
    # Record to local history
    if hub_id not in hub_sensor_history:
        hub_sensor_history[hub_id] = []
    hub_sensor_history[hub_id].append({
        "time": datetime.now().isoformat(),
        "temperature": hub['temperature'],
        "moisture": hub['moisture'],
    })
    if len(hub_sensor_history[hub_id]) > 100:
        hub_sensor_history[hub_id] = hub_sensor_history[hub_id][-100:]
    
    return jsonify({
        "hub_id": hub_id,
        "temperature": hub['temperature'],
        "moisture": hub['moisture'],
        "message": "Sensor data updated",
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/hubs/<hub_id>/sensors/history', methods=['GET'])
def get_hub_sensor_history(hub_id):
    """Get sensor history for a specific hub."""
    if hub_id not in hubs_data:
        return jsonify({"error": f"Hub '{hub_id}' not found"}), 404
    
    limit = int(request.args.get('limit', 20))
    history = hub_sensor_history.get(hub_id, [])[-limit:]
    
    return jsonify({
        "hub_id": hub_id,
        "history": history,
        "timestamp": datetime.now().isoformat()
    })


# ─────────────────────────────────────────────
#  ADMIN API — FIRESTORE INTEGRATION
# ─────────────────────────────────────────────

@app.route('/api/admin/organizers', methods=['GET'])
def api_get_organizers():
    """Get all organizer profiles from Firestore."""
    organizers = get_organizers_from_firestore()
    return jsonify({"organizers": organizers, "timestamp": datetime.now().isoformat()})


@app.route('/api/admin/profiles', methods=['GET'])
def api_get_profiles():
    """Get all profiles from Firestore."""
    profiles = get_all_profiles_from_firestore()
    return jsonify({"profiles": profiles, "timestamp": datetime.now().isoformat()})


@app.route('/api/admin/stats', methods=['GET'])
def api_get_admin_stats():
    """Get admin dashboard stats — combines Firestore data with local hub data."""
    organizers = get_organizers_from_firestore()
    all_profiles = get_all_profiles_from_firestore()
    
    # Count by role
    role_counts = {}
    for p in all_profiles:
        role = p.get('role', 'unknown')
        role_counts[role] = role_counts.get(role, 0) + 1
    
    return jsonify({
        "total_hubs": len(hubs_data),
        "hubs_online": sum(1 for h in hubs_data.values() if h.get('status') == 'online'),
        "total_organizers": len(organizers),
        "total_users": len(all_profiles),
        "role_counts": role_counts,
        "hubs": list(hubs_data.values()),
        "organizers": organizers,
        "timestamp": datetime.now().isoformat()
    })


# ─────────────────────────────────────────────
#  SENSOR API ENDPOINTS (legacy — global sensors)
# ─────────────────────────────────────────────

@app.route('/api/sensors', methods=['GET'])
def get_sensors():
    """Get all current sensor readings."""
    return jsonify({
        "sensors": sensor_data,
        "timestamp": datetime.now().isoformat(),
        "status": "online"
    })

@app.route('/api/sensors', methods=['POST', 'PUT'])
def update_sensors():
    """Update one or more sensor values."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    updated = {}
    for key, value in data.items():
        if key in sensor_data:
            try:
                sensor_data[key] = float(value)
                updated[key] = sensor_data[key]
            except (ValueError, TypeError):
                pass
    
    return jsonify({
        "updated": updated,
        "sensors": sensor_data,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/sensors/<sensor_name>', methods=['GET'])
def get_sensor(sensor_name):
    """Get a specific sensor reading."""
    if sensor_name not in sensor_data:
        return jsonify({"error": f"Sensor '{sensor_name}' not found"}), 404
    return jsonify({
        "name": sensor_name,
        "value": sensor_data[sensor_name],
        "history": sensor_history.get(sensor_name, [])[-20:],
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/sensors/<sensor_name>', methods=['PUT'])
def update_single_sensor(sensor_name):
    """Update a single sensor value."""
    if sensor_name not in sensor_data:
        return jsonify({"error": f"Sensor '{sensor_name}' not found"}), 404
    
    data = request.get_json()
    value = data.get('value')
    if value is None:
        return jsonify({"error": "No value provided"}), 400
    
    try:
        sensor_data[sensor_name] = float(value)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid value"}), 400
    
    return jsonify({
        "name": sensor_name,
        "value": sensor_data[sensor_name],
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/sensors/history', methods=['GET'])
def get_sensor_history():
    """Get sensor history for all or specific sensors."""
    sensor = request.args.get('sensor')
    limit = int(request.args.get('limit', 20))
    
    if sensor:
        return jsonify({
            "sensor": sensor,
            "history": sensor_history.get(sensor, [])[-limit:]
        })
    
    return jsonify({
        name: history[-limit:] for name, history in sensor_history.items()
    })


# ─────────────────────────────────────────────
#  MARKET DATA ENDPOINTS
# ─────────────────────────────────────────────

@app.route('/api/market', methods=['GET'])
def get_market():
    """Get market commodity data."""
    return jsonify({
        "commodities": market_data,
        "network_stats": network_stats,
        "cluster_health": cluster_health,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/market', methods=['PUT'])
def update_market():
    """Update market data."""
    global market_data
    data = request.get_json()
    if 'commodities' in data:
        market_data = data['commodities']
    if 'network_stats' in data:
        network_stats.update(data['network_stats'])
    if 'cluster_health' in data:
        for i, item in enumerate(data['cluster_health']):
            if i < len(cluster_health):
                cluster_health[i].update(item)
    
    return jsonify({"message": "Market data updated", "timestamp": datetime.now().isoformat()})


# ─────────────────────────────────────────────
#  DASHBOARD STATS ENDPOINTS
# ─────────────────────────────────────────────

@app.route('/api/stats/buyer', methods=['GET'])
def get_buyer_stats():
    """Get buyer dashboard stats."""
    return jsonify({
        "stats": buyer_stats,
        "chart_data": monthly_chart_data,
        "market": market_data[:5],
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/stats/buyer', methods=['PUT'])
def update_buyer_stats():
    """Update buyer stats."""
    data = request.get_json()
    if data:
        for key, val in data.items():
            if key in buyer_stats:
                buyer_stats[key] = val
        if 'chart_data' in data:
            global monthly_chart_data
            monthly_chart_data = data['chart_data']
    return jsonify({"stats": buyer_stats, "timestamp": datetime.now().isoformat()})

@app.route('/api/stats/seller', methods=['GET'])
def get_seller_stats():
    """Get seller dashboard stats."""
    return jsonify({
        "stats": seller_stats,
        "transactions": transactions_data,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/stats/seller', methods=['PUT'])
def update_seller_stats():
    """Update seller stats."""
    data = request.get_json()
    if data:
        for key, val in data.items():
            if key in seller_stats:
                seller_stats[key] = val
    return jsonify({"stats": seller_stats, "timestamp": datetime.now().isoformat()})

@app.route('/api/stats/organizer', methods=['GET'])
def get_organizer_stats():
    """Get organizer dashboard stats."""
    return jsonify({
        "stats": organizer_stats,
        "orders": orders_data,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/stats/organizer', methods=['PUT'])
def update_organizer_stats():
    """Update organizer stats."""
    data = request.get_json()
    if data:
        for key, val in data.items():
            if key in organizer_stats:
                organizer_stats[key] = val
    return jsonify({"stats": organizer_stats, "timestamp": datetime.now().isoformat()})


# ─────────────────────────────────────────────
#  ORDERS & TRANSACTIONS
# ─────────────────────────────────────────────

@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders."""
    return jsonify({"orders": orders_data, "timestamp": datetime.now().isoformat()})

@app.route('/api/orders', methods=['POST'])
def add_order():
    """Add a new order."""
    data = request.get_json()
    if data:
        data.setdefault('id', f'ord-{random.randint(1000,9999)}')
        data.setdefault('created_at', datetime.now().isoformat())
        data.setdefault('status', 'reserved')
        orders_data.append(data)
    return jsonify({"orders": orders_data, "timestamp": datetime.now().isoformat()})

@app.route('/api/orders/<order_id>/complete', methods=['POST'])
def complete_order(order_id):
    """Mark order as completed."""
    for order in orders_data:
        if order['id'] == order_id:
            order['status'] = 'completed'
            # Create a transaction
            transactions_data.insert(0, {
                "id": f"txn-{random.randint(1000,9999)}",
                "order_id": order_id,
                "amount": order['total_price'],
                "status": "held",
                "created_at": datetime.now().isoformat()
            })
            return jsonify({"message": "Order completed", "order": order})
    return jsonify({"error": "Order not found"}), 404

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get all transactions."""
    return jsonify({"transactions": transactions_data, "timestamp": datetime.now().isoformat()})


# ─────────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "uptime": time.time(),
        "sensors_active": len(sensor_data),
        "hubs_active": len(hubs_data),
        "firestore_connected": firestore_db is not None,
        "timestamp": datetime.now().isoformat()
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  🌾 CropStack Sensor API v2.0")
    print("  📡 Admin Dashboard: http://localhost:5000")
    print("  🔌 API Base:  http://localhost:5000/api")
    print("  🔐 Admin Login: admin@cropstack.com / admin123")
    print("="*60 + "\n")
    app.run(debug=True, port=5000, host='0.0.0.0')
