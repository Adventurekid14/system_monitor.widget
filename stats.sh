#!/bin/bash
# system_monitor stats.sh — gathers all system stats and outputs JSON

# ── Network: first sample ──────────────────────────────────────────────────
PRIMARY_IF=$(route get default 2>/dev/null | awk '/interface:/{print $2}')
[[ -z "$PRIMARY_IF" ]] && PRIMARY_IF="en0"

read -r NET1_IN NET1_OUT <<< "$(netstat -ib 2>/dev/null | \
  awk -v iface="$PRIMARY_IF" 'NR>1 && $1==iface {print $7, $10; exit}')"

# ── CPU: takes ~1 second, run in background ────────────────────────────────
CPU_TMP=$(mktemp /tmp/sm_cpu.XXXXXX)
top -l 2 -s 1 -n 0 > "$CPU_TMP" 2>/dev/null &
TOP_PID=$!

# ── RAM ───────────────────────────────────────────────────────────────────
MEM_TOTAL=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
PAGE_SIZE=$(pagesize 2>/dev/null || echo "4096")
VM_OUT=$(vm_stat 2>/dev/null)
PAGES_ACTIVE=$(echo "$VM_OUT"  | awk '/Pages active:/        {gsub(/\./,"",$3); print $3+0}')
PAGES_WIRED=$(echo "$VM_OUT"   | awk '/Pages wired down:/    {gsub(/\./,"",$4); print $4+0}')
PAGES_COMP=$(echo "$VM_OUT"    | awk '/occupied by compressor/{gsub(/\./,"",$5); print $5+0}')

# ── GPU usage via IOKit ────────────────────────────────────────────────────
GPU_RAW=$(ioreg -r -d 1 -c IOAccelerator 2>/dev/null \
  | grep -o '"Device Utilization %"=[0-9]*' | head -1 | grep -o '[0-9]*$')

# ── CPU Temperature ────────────────────────────────────────────────────────
CPU_TEMP_RAW=$(/opt/homebrew/bin/macmon pipe -i 1 2>/dev/null | head -1 \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(d['temp']['cpu_temp_avg']))" 2>/dev/null)

# ── Battery ────────────────────────────────────────────────────────────────
BATT_INFO=$(pmset -g batt 2>/dev/null)
BATT_PCT=$(echo "$BATT_INFO" | grep -Eo '[0-9]+%' | head -1 | tr -d '%')
CHARGING="false"
echo "$BATT_INFO" | grep -qiE '\bcharging\b' && CHARGING="true"

# ── Wait for CPU measurement ───────────────────────────────────────────────
wait "$TOP_PID" 2>/dev/null
CPU_LINE=$(grep "CPU usage" "$CPU_TMP" 2>/dev/null | tail -1)
rm -f "$CPU_TMP"

CPU_USER=$(echo "$CPU_LINE" | grep -Eo '[0-9]+(\.[0-9]+)?% user' | grep -Eo '[0-9]+(\.[0-9]+)?')
CPU_SYS=$(echo  "$CPU_LINE" | grep -Eo '[0-9]+(\.[0-9]+)?% sys'  | grep -Eo '[0-9]+(\.[0-9]+)?')

# ── Network: second sample ─────────────────────────────────────────────────
read -r NET2_IN NET2_OUT <<< "$(netstat -ib 2>/dev/null | \
  awk -v iface="$PRIMARY_IF" 'NR>1 && $1==iface {print $7, $10; exit}')"

# ── Build JSON with Python3 ────────────────────────────────────────────────
python3 - <<PYEOF
import json, math

def safe_float(v, fallback=None):
    try: return float(v)
    except: return fallback

# CPU
cpu_user = safe_float("""${CPU_USER}""")
cpu_sys  = safe_float("""${CPU_SYS}""")
cpu_val  = round(cpu_user + cpu_sys, 1) if cpu_user is not None and cpu_sys is not None else None

# RAM
mem_total   = safe_float("""${MEM_TOTAL}""", 0)
page_size   = safe_float("""${PAGE_SIZE}""", 4096)
p_active    = safe_float("""${PAGES_ACTIVE}""", 0)
p_wired     = safe_float("""${PAGES_WIRED}""", 0)
p_comp      = safe_float("""${PAGES_COMP}""", 0)
used_bytes  = (p_active + p_wired + p_comp) * page_size
total_gb    = mem_total / (1024**3)
used_gb     = used_bytes / (1024**3)
ram_pct     = round(used_gb / total_gb * 100) if total_gb > 0 else 0
ram_str     = f"{used_gb:.1f},{total_gb:.0f},{ram_pct}" if total_gb > 0 else None

# GPU
gpu_val = safe_float("""${GPU_RAW}""")

# CPU Temp
cpu_temp = safe_float("""${CPU_TEMP_RAW}""")

# Battery
batt = safe_float("""${BATT_PCT}""")
charging = """${CHARGING}""" == "true"

# Network  (bytes since boot — just diff the two samples; sampling gap ≈ 1 s)
n1_in  = safe_float("""${NET1_IN}""")
n2_in  = safe_float("""${NET2_IN}""")
n1_out = safe_float("""${NET1_OUT}""")
n2_out = safe_float("""${NET2_OUT}""")

net_down = round(max(0, n2_in  - n1_in)  / 1_048_576, 3) if None not in (n1_in,  n2_in)  else None
net_up   = round(max(0, n2_out - n1_out) / 1_048_576, 3) if None not in (n1_out, n2_out) else None

print(json.dumps({
    "cpu":      cpu_val,
    "ram":      ram_str,
    "gpu":      gpu_val,
    "cpu_temp": cpu_temp,
    "battery":  batt,
    "charging": charging,
    "net_up":   net_up,
    "net_down": net_down,
}))
PYEOF
