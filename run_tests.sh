#!/usr/bin/env bash
set -uo pipefail

DEVICE="emulator-5554"
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"
APPIUM_PID=""

cleanup() {
  if [ -n "$APPIUM_PID" ]; then
    kill "$APPIUM_PID" >/dev/null 2>&1 || true
  fi
  adb -s "$DEVICE" emu kill >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Restarting ADB ==="
adb kill-server >/dev/null 2>&1 || true
sleep 2
adb start-server
sleep 3
adb devices -l

echo "=== Waiting for emulator ==="
ADB_TIMEOUT=180
ADB_ELAPSED=0
until adb -s "$DEVICE" get-state 2>/dev/null | grep -qx device; do
  if [ "$ADB_ELAPSED" -ge "$ADB_TIMEOUT" ]; then
    echo "❌ Emulator never became available through ADB"
    adb devices -l
    exit 1
  fi
  echo "  ... ADB state not ready (${ADB_ELAPSED}s)"
  sleep 5
  ADB_ELAPSED=$((ADB_ELAPSED + 5))
done
echo "✅ Emulator is online"

echo "=== Waiting for Android boot ==="
BOOT_TIMEOUT=300
BOOT_ELAPSED=0
while true; do
  BOOT_COMPLETED=$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$BOOT_COMPLETED" = "1" ]; then
    echo "✅ Android boot complete"
    break
  fi
  if [ "$BOOT_ELAPSED" -ge "$BOOT_TIMEOUT" ]; then
    echo "❌ Android did not finish booting"
    adb -s "$DEVICE" logcat -d 2>/dev/null | tail -n 100
    exit 1
  fi
  echo "  ... still booting (${BOOT_ELAPSED}s)"
  sleep 5
  BOOT_ELAPSED=$((BOOT_ELAPSED + 5))
done

sleep 15

echo "=== Launching Play Store ==="
for attempt in 1 2 3 4 5 6; do
  if adb -s "$DEVICE" shell monkey \
    -p com.android.vending \
    -c android.intent.category.LAUNCHER 1 \
    >/dev/null 2>&1; then
    echo "✅ Play Store launch succeeded"
    break
  fi
  echo "  ... launch retry $attempt/6"
  sleep 5
done
sleep 6

echo "=== Verifying Appium ==="
if ! command -v appium >/dev/null 2>&1; then
  echo "❌ appium is not on PATH"
  exit 1
fi
appium --version
appium driver list --installed

echo "=== Starting Appium ==="
rm -f appium.log appium_stdout.log
appium --port 4723 --log appium.log --log-level info \
  >appium_stdout.log 2>&1 &
APPIUM_PID=$!

sleep 3
if ! kill -0 "$APPIUM_PID" 2>/dev/null; then
  echo "❌ Appium exited immediately"
  cat appium_stdout.log
  cat appium.log 2>/dev/null || true
  exit 1
fi

npx --yes wait-on tcp:127.0.0.1:4723 \
  --timeout 120000 --interval 2000
WAIT_EXIT=$?

if [ "$WAIT_EXIT" -ne 0 ]; then
  echo "❌ Appium did not open port 4723"
  cat appium_stdout.log
  cat appium.log 2>/dev/null || true
  exit 1
fi

echo "✅ Appium is ready"

set +e
node test_sample.js
TEST_EXIT=$?
set -e

if [ "$TEST_EXIT" -ne 0 ]; then
  echo "⚠️ Test script exited with code $TEST_EXIT"
  tail -n 100 appium.log 2>/dev/null || true
fi

kill "$APPIUM_PID" 2>/dev/null || true
wait "$APPIUM_PID" 2>/dev/null || true
APPIUM_PID=""

exit "$TEST_EXIT"
