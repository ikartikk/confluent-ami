import json
import os
import random
import time
from datetime import datetime, timezone

from confluent_kafka import Producer
from dotenv import load_dotenv
from faker import Faker

load_dotenv(dotenv_path="C:/Users/kartkum4/Desktop/Confluent/.env")
faker = Faker()

BOOTSTRAP = os.getenv("CONFLUENT_BOOTSTRAP_SERVERS", "")
API_KEY = os.getenv("CONFLUENT_API_KEY", "")
API_SECRET = os.getenv("CONFLUENT_API_SECRET", "")

if not BOOTSTRAP or not API_KEY or not API_SECRET:
    raise SystemExit("Missing Confluent Cloud credentials. Check .env.")

producer = Producer(
    {
        "bootstrap.servers": BOOTSTRAP,
        "security.protocol": "SASL_SSL",
        "sasl.mechanisms": "PLAIN",
        "sasl.username": API_KEY,
        "sasl.password": API_SECRET,
        "client.id": "ami-simulator",
    }
)

# --- Factory layout -----------------------------------------------------------
# 3 production lines, each with assigned machines and part dependencies.
# Machines on the same line share quality correlation.

LINES = {
    "Line-A": {
        "machines": ["RB-22", "RB-13"],
        "parts": ["PT-bearing-A", "PT-seal-A", "PT-nozzle-A"],
    },
    "Line-B": {
        "machines": ["RB-07", "WB-05"],
        "parts": ["PT-bearing-B", "PT-seal-B", "PT-sensor-B"],
    },
    "Line-C": {
        "machines": ["QC-11"],
        "parts": ["PT-bearing-C", "PT-filter-C"],
    },
}

SUPPLIERS = {
    "SUP-1": {"material": "bearings", "reliability": 0.92},
    "SUP-2": {"material": "seals", "reliability": 0.95},
    "SUP-3": {"material": "nozzles", "reliability": 0.88},
    "SUP-4": {"material": "sensors", "reliability": 0.90},
    "SUP-5": {"material": "filters", "reliability": 0.97},
}

MATERIAL_TO_PARTS = {
    "bearings": ["PT-bearing-A", "PT-bearing-B", "PT-bearing-C"],
    "seals": ["PT-seal-A", "PT-seal-B"],
    "nozzles": ["PT-nozzle-A"],
    "sensors": ["PT-sensor-B"],
    "filters": ["PT-filter-C"],
}

ALL_MACHINES = []
MACHINE_TO_LINE = {}
for line_id, cfg in LINES.items():
    for m in cfg["machines"]:
        ALL_MACHINES.append(m)
        MACHINE_TO_LINE[m] = line_id

ALL_PARTS = []
for cfg in LINES.values():
    ALL_PARTS.extend(cfg["parts"])

# --- State initialization -----------------------------------------------------

machine_state = {}
for machine_id in ALL_MACHINES:
    line_id = MACHINE_TO_LINE[machine_id]
    machine_state[machine_id] = {
        "line_id": line_id,
        "vibration_hz": round(random.uniform(10.0, 14.0), 2),
        "torque_nm": round(random.uniform(24.0, 32.0), 2),
        "temperature_c": round(random.uniform(55.0, 65.0), 2),
        "defect_rate": round(random.uniform(0.005, 0.015), 4),
        "wear": random.uniform(0.1, 0.4),
        "cycles_since_maintenance": random.randint(0, 50),
        "last_maintenance_time": time.time() - random.uniform(30, 120),
    }

line_state = {}
for line_id in LINES:
    line_state[line_id] = {
        "batch_seq": random.randint(400, 500),
        "batch_id": f"B-{random.randint(400, 500)}",
        "batch_start": time.time(),
        "base_defect_rate": round(random.uniform(0.008, 0.018), 4),
    }

inventory_state = {}
for part_id in ALL_PARTS:
    inventory_state[part_id] = {
        "stock_level": random.randint(180, 320),
        "consumption_rate": round(random.uniform(1.5, 3.0), 2),
        "reorder_point": 100,
        "last_restock": time.time(),
    }

supply_state = {}
for sup_id, cfg in SUPPLIERS.items():
    supply_state[sup_id] = {
        "material": cfg["material"],
        "reliability": cfg["reliability"],
        "base_delay": round(random.uniform(0.5, 1.5), 2),
        "current_delay": round(random.uniform(0.5, 1.5), 2),
        "disruption_until": 0.0,
    }


def now_ts():
    return datetime.now(timezone.utc).isoformat()


def delivery_report(err, msg):
    if err is not None:
        print(f"DELIVERY FAILED -> {msg.topic()}: {err}")


def send(topic, payload):
    producer.produce(
        topic,
        json.dumps(payload).encode("utf-8"),
        callback=delivery_report,
    )


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


# --- Simulation tick functions ------------------------------------------------

def tick_machine(machine_id):
    """Simulate one cycle for a machine. Wear accumulates, driving vibration,
    temperature, and defect rate upward. Occasional random spikes model
    real-world sensor noise."""
    m = machine_state[machine_id]

    m["cycles_since_maintenance"] += 1
    wear_growth = 0.003 + random.uniform(0.0, 0.005)
    m["wear"] = clamp(m["wear"] + wear_growth, 0.0, 2.0)

    # Vibration: base + wear component + noise
    wear_vib = m["wear"] * 4.0
    noise_vib = random.gauss(0, 0.3)
    m["vibration_hz"] = clamp(round(10.0 + wear_vib + noise_vib, 2), 6.0, 30.0)

    # Temperature: follows vibration with lag
    target_temp = 55.0 + (m["vibration_hz"] - 10.0) * 2.5 + random.gauss(0, 0.5)
    m["temperature_c"] = clamp(
        round(m["temperature_c"] + (target_temp - m["temperature_c"]) * 0.3, 2),
        40.0, 110.0,
    )

    # Torque: slight drift with wear
    m["torque_nm"] = clamp(
        round(m["torque_nm"] + random.gauss(0, 0.3) + m["wear"] * 0.1, 2),
        18.0, 55.0,
    )

    # Defect rate: driven by wear and temperature
    temp_factor = max(0, (m["temperature_c"] - 70.0) * 0.001)
    wear_factor = m["wear"] * 0.015
    m["defect_rate"] = clamp(
        round(0.005 + wear_factor + temp_factor + random.gauss(0, 0.002), 4),
        0.0, 0.12,
    )

    status = "LOW"
    if m["vibration_hz"] > 22 or m["defect_rate"] > 0.06:
        status = "CRITICAL"
    elif m["vibration_hz"] > 20 or m["defect_rate"] > 0.04:
        status = "HIGH"
    elif m["vibration_hz"] > 18 or m["defect_rate"] > 0.03:
        status = "MEDIUM"

    send("telemetry.robot", {
        "machine_id": machine_id,
        "line_id": m["line_id"],
        "ts": now_ts(),
        "vibration_hz": m["vibration_hz"],
        "torque_nm": m["torque_nm"],
        "temperature_c": m["temperature_c"],
        "defect_rate": m["defect_rate"],
        "status": status,
    })

    return status


def tick_quality(line_id):
    """Quality is driven by the worst machine on the line."""
    line = line_state[line_id]
    line_machines = LINES[line_id]["machines"]

    # Rotate batch every 60-120s
    if time.time() - line["batch_start"] > random.uniform(60, 120):
        line["batch_seq"] += 1
        line["batch_id"] = f"B-{line['batch_seq']}"
        line["batch_start"] = time.time()

    # Line defect rate = base + worst-machine contribution
    worst_defect = max(machine_state[m]["defect_rate"] for m in line_machines)
    combined = line["base_defect_rate"] + worst_defect * 0.4 + random.gauss(0, 0.002)
    line_defect = clamp(round(combined, 4), 0.0, 0.10)

    send("telemetry.quality", {
        "line_id": line_id,
        "ts": now_ts(),
        "batch_id": line["batch_id"],
        "defect_rate": line_defect,
    })


def tick_maintenance(machine_id, status):
    """Maintenance is triggered by machine health. Severe status triggers faster.
    Maintenance repairs reduce wear and vibration."""
    m = machine_state[machine_id]
    cooldown = time.time() - m["last_maintenance_time"]

    should_maintain = False
    if status == "CRITICAL" and cooldown > 30:
        should_maintain = True
    elif status == "HIGH" and cooldown > 60:
        should_maintain = random.random() < 0.6
    elif cooldown > 120 and random.random() < 0.08:
        should_maintain = True

    if not should_maintain:
        return

    # Choose action based on severity
    if status == "CRITICAL":
        action = "replace-bearing"
    elif status == "HIGH":
        action = random.choice(["replace-bearing", "lubricate"])
    else:
        action = random.choice(["inspect", "lubricate"])

    # Apply repair effects
    if action == "replace-bearing":
        m["wear"] = clamp(m["wear"] - 0.5, 0.05, 2.0)
        m["vibration_hz"] = clamp(m["vibration_hz"] - 3.0, 8.0, 30.0)
        # Consume a bearing from this line's inventory
        line_id = m["line_id"]
        bearing_parts = [p for p in LINES[line_id]["parts"] if "bearing" in p]
        for part_id in bearing_parts:
            inventory_state[part_id]["stock_level"] = max(
                0, inventory_state[part_id]["stock_level"] - 1
            )
    elif action == "lubricate":
        m["wear"] = clamp(m["wear"] - 0.15, 0.05, 2.0)
        m["vibration_hz"] = clamp(m["vibration_hz"] - 1.0, 8.0, 30.0)
        m["temperature_c"] = clamp(m["temperature_c"] - 2.0, 40.0, 110.0)

    m["last_maintenance_time"] = time.time()
    m["cycles_since_maintenance"] = 0

    send("events.maintenance", {
        "machine_id": machine_id,
        "ts": now_ts(),
        "action": action,
        "technician": faker.name(),
    })


def tick_inventory():
    """Inventory depletes based on consumption rate. Restocking happens
    when stock drops below reorder point, but only if the supplier
    isn't disrupted."""
    for part_id, part in inventory_state.items():
        # Consume stock
        consumption = part["consumption_rate"] * (TICK_INTERVAL / 60.0)
        part["stock_level"] = max(0, part["stock_level"] - consumption)

        # Slight consumption rate drift
        part["consumption_rate"] = clamp(
            round(part["consumption_rate"] + random.gauss(0, 0.05), 2),
            0.5, 5.0,
        )

        # Restock if below reorder point (simulates automatic reorder)
        if part["stock_level"] < part["reorder_point"]:
            # Check if the relevant supplier is disrupted
            material = _part_material(part_id)
            supplier_delayed = any(
                supply_state[s]["current_delay"] > 4.0
                for s, cfg in SUPPLIERS.items()
                if cfg["material"] == material
            )
            if not supplier_delayed and random.random() < 0.4:
                restock_amount = random.randint(60, 150)
                part["stock_level"] += restock_amount
                part["last_restock"] = time.time()

    # Emit telemetry for a subset of parts each tick
    sampled = random.sample(ALL_PARTS, min(3, len(ALL_PARTS)))
    for part_id in sampled:
        part = inventory_state[part_id]
        send("telemetry.inventory", {
            "part_id": part_id,
            "ts": now_ts(),
            "stock_level": int(part["stock_level"]),
            "consumption_rate": part["consumption_rate"],
        })


def _part_material(part_id):
    """Derive material category from part name."""
    for material, parts in MATERIAL_TO_PARTS.items():
        if part_id in parts:
            return material
    return "unknown"


def tick_supply():
    """Supplier delays drift slowly with occasional disruption spikes.
    Disruptions resolve over time."""
    now = time.time()
    for sup_id, sup in supply_state.items():
        # Resolve disruptions
        if now > sup["disruption_until"]:
            # Drift toward base delay
            drift = (sup["base_delay"] - sup["current_delay"]) * 0.2
            sup["current_delay"] = clamp(
                round(sup["current_delay"] + drift + random.gauss(0, 0.1), 2),
                0.1, 12.0,
            )
        else:
            # During disruption, delay stays high with noise
            sup["current_delay"] = clamp(
                round(sup["current_delay"] + random.gauss(0, 0.3), 2),
                3.0, 12.0,
            )

        # Random disruption event (2% chance per tick)
        if random.random() < 0.02 and now > sup["disruption_until"]:
            sup["current_delay"] = round(random.uniform(4.0, 8.0), 2)
            sup["disruption_until"] = now + random.uniform(30, 90)

    # Emit supply events for 1-2 suppliers per tick
    sampled = random.sample(list(SUPPLIERS.keys()), min(2, len(SUPPLIERS)))
    for sup_id in sampled:
        sup = supply_state[sup_id]
        send("events.supply", {
            "supplier_id": sup_id,
            "ts": now_ts(),
            "delay_hours": sup["current_delay"],
            "material": sup["material"],
        })


# --- Main loop ----------------------------------------------------------------

TICK_INTERVAL = 2  # seconds between ticks

print("Starting simulator... producing to Confluent Cloud")
print(f"  Lines: {list(LINES.keys())}")
print(f"  Machines: {ALL_MACHINES}")
print(f"  Parts: {ALL_PARTS}")
print(f"  Suppliers: {list(SUPPLIERS.keys())}")
print(f"  Tick interval: {TICK_INTERVAL}s")
print()

tick = 0
while True:
    tick += 1

    # Every tick: update all machines and their lines
    for machine_id in ALL_MACHINES:
        status = tick_machine(machine_id)
        tick_maintenance(machine_id, status)

    # Quality: one line per tick, rotating
    line_ids = list(LINES.keys())
    tick_quality(line_ids[tick % len(line_ids)])

    # Inventory: every tick (depletes + samples a few parts)
    tick_inventory()

    # Supply: every 3rd tick
    if tick % 3 == 0:
        tick_supply()

    producer.poll(0)

    if tick % 10 == 0:
        print(f"[tick {tick}] machines: " + " | ".join(
            f"{m}: vib={machine_state[m]['vibration_hz']:.1f} wear={machine_state[m]['wear']:.2f}"
            for m in ALL_MACHINES
        ))

    time.sleep(TICK_INTERVAL)
