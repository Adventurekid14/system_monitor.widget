# System Monitor

A sleek, real-time system stats dashboard for [Übersicht](https://tracesof.net/uebersicht/), designed for Apple Silicon Macs.

![screenshot](screenshot.png)

## Features

- **CPU** — usage percentage with a 60-second scrolling history graph
- **RAM** — used / total GB with a percentage bar
- **GPU** — utilization percentage via IOKit
- **CPU Temperature** — real sensor data via `macmon` (no sudo required)
- **Battery** — percentage, color-coded warning levels, and charging indicator
- **Network** — live upload / download throughput in MB/s

Color coding adapts to load levels (blue → orange → red) so at-a-glance status is instant.

## Requirements

- macOS with Apple Silicon (M1 / M2 / M3 / M4)
- [Übersicht](https://tracesof.net/uebersicht/) installed
- [macmon](https://github.com/vladkens/macmon) for CPU temperature (install via Homebrew):

```bash
brew install macmon
```

## Installation

1. Download or clone this repository.
2. Copy the `system_monitor.widget` folder into your Übersicht widgets directory:

```
~/Library/Application Support/Übersicht/widgets/
```

3. Übersicht will load the widget automatically. It appears in the **bottom-right corner** of your desktop.

## Configuration

Open `index.jsx` to adjust:

| Constant | Default | Description |
|---|---|---|
| `MAX_HISTORY` | `60` | Number of CPU history samples shown in graph |
| `refreshFrequency` | `3000` | Poll interval in milliseconds |
| `ACCENT / GREEN / ORANGE / RED / PURPLE` | — | Theme colors |

The widget position is set via `className` in `index.jsx` (`bottom: 20px; right: 20px`).

## How It Works

`stats.sh` runs on every refresh cycle and outputs a single JSON object. It collects:

- CPU usage via `top`
- RAM via `vm_stat`
- GPU via `ioreg`
- CPU temperature via `macmon pipe`
- Battery via `pmset`
- Network throughput by diffing two `netstat` samples ~1 second apart

`index.jsx` parses the JSON and renders the UI using Übersicht's JSX/React layer.

## Compatibility

Tested on macOS Sequoia with Apple Silicon. The GPU reading requires a discrete or integrated GPU exposed via `IOAccelerator`. CPU temperature requires `macmon` — Intel Macs may need `osx-cpu-temp` instead (see `stats.sh`).

## License

MIT
