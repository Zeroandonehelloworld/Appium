#!/usr/bin/env bash
set -uo pipefail

DEVICE="emulator-5554"
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"

cleanup() {
  adb -s "$DEVICE" emu kill >/dev/null 2>&1 || true
  kill "${APPIUM_PID:-0}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Restarting ADB ==="
adb kill-server >/dev/null 2>&1 || true
sleep 2
adb start-server
sleep 3

echo "=== Waiting for emulator ==="
if ! adb -s "$DEVICE" wait-for-device; then
  echo "ADB wait-for-device failed"
  adb devices -l
  exit 1
fi

BOOT_TIMEOUT=300
ELAPSED=0
until [ "$(adb -s \"$DEVICE\" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  if [ "$ELAPSED" -ge "$BOOT_TIMEOUT" ]; then
    echo "❌ Emulator did not boot"
    adb devices -l
    adb -s "$DEVICE" logcat -d 2>/dev/null | tail -n 100
    exit 1
  fi
  STATE=$(adb -s "$DEVICE" get-state 2>/dev/null || true)
  echo "  ... booting; ADB state=${STATE:-missing} (${ELAPSED}s)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
echo "✅ Android boot complete"

sleep 15
adb -s "$DEVICE" shell monkey -p com.android.vending -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
sleep 6
adb devices -l

echo "=== Verifying Appium ==="
if ! command -v appium >/dev/null 2>&1; then
  echo "❌ appium not found"
  exit 1
fi
appium --version
appium driver list --installed

echo "=== Starting Appium ==="
rm -f appium.log appium_stdout.log
appium --port 4723 --log appium.log --log-level info >appium_stdout.log 2>&1 &
APPIUM_PID=$!

sleep 3
if ! kill -0 "$APPIUM_PID" 2>/dev/null; then
  echo "❌ Appium exited immediately"
  cat appium_stdout.log
  cat appium.log 2>/dev/null || true
  exit 1
fi

npx --yes wait-on tcp:127.0.0.1:4723 --timeout 120000 --interval 2000
WAIT_EXIT=$?
if [ "$WAIT_EXIT" -ne 0 ]; then
  echo "❌ Appium did not open port 4723"
  cat appium_stdout.log
  cat appium.log 2>/dev/null || true
  exit 1
fi

echo "✅ Appium ready"

node test_sample.js
TEST_EXIT=$?

if [ "$TEST_EXIT" -ne 0 ]; then
  echo "⚠️ Test script exited with $TEST_EXIT"
  tail -n 100 appium.log 2>/dev/null || true
fi

kill "$APPIUM_PID" 2>/dev/null || true
wait "$APPIUM_PID" 2>/dev/null || true
APPIUM_PID=""

exit "$TEST_EXIT"
