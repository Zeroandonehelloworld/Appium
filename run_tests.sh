#!/usr/bin/env bash
set -uo pipefail

DEVICE="emulator-5554"
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"
APPIUM_PID=""

cleanup() {
  if [ -n "$APPIUM_PID" ]; then
    kill "$APPIUM_PID" >/dev/null 2>&1 || true
    wait "$APPIUM_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== Checking ADB and emulator state (leaving ADB server running) ==="
adb devices -l

echo "=== Waiting for emulator to come online ==="
ADB_TIMEOUT=180
ADB_ELAPSED=0

while true; do
  ADB_STATE=$(adb -s "$DEVICE" get-state 2>/dev/null || true)

  if [ "$ADB_STATE" = "device" ]; then
    echo "✅ $DEVICE is online"
    break
  fi

  if [ "$ADB_ELAPSED" -ge "$ADB_TIMEOUT" ]; then
    echo "❌ $DEVICE did not come online within ${ADB_TIMEOUT}s"
    adb devices -l || true
    exit 1
  fi

  echo "  ... ADB state=${ADB_STATE:-missing} (${ADB_ELAPSED}s)"
  sleep 5
  ADB_ELAPSED=$((ADB_ELAPSED + 5))
done

echo "=== Waiting for Android boot to complete ==="
BOOT_TIMEOUT=180
BOOT_ELAPSED=0

while true; do
  BOOT_COMPLETED=$(
    adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null |
      tr -d '\r' || true
  )

  if [ "$BOOT_COMPLETED" = "1" ]; then
    echo "✅ Android boot complete"
    break
  fi

  if [ "$BOOT_ELAPSED" -ge "$BOOT_TIMEOUT" ]; then
    echo "❌ Android did not finish booting within ${BOOT_TIMEOUT}s"
    adb devices -l || true
    adb -s "$DEVICE" logcat -d 2>/dev/null | tail -n 100 || true
    exit 1
  fi

  echo "  ... sys.boot_completed=${BOOT_COMPLETED:-not-ready} (${BOOT_ELAPSED}s)"
  sleep 5
  BOOT_ELAPSED=$((BOOT_ELAPSED + 5))
done

echo "=== Waiting for Android package manager ==="
PACKAGE_TIMEOUT=120
PACKAGE_ELAPSED=0

while ! adb -s "$DEVICE" shell pm path android 2>/dev/null | grep -q '^package:'; do
  if [ "$PACKAGE_ELAPSED" -ge "$PACKAGE_TIMEOUT" ]; then
    echo "❌ Android package manager did not become ready"
    adb -s "$DEVICE" logcat -d 2>/dev/null | tail -n 100 || true
    exit 1
  fi

  echo "  ... waiting for package manager (${PACKAGE_ELAPSED}s)"
  sleep 5
  PACKAGE_ELAPSED=$((PACKAGE_ELAPSED + 5))
done

echo "✅ Android package manager is ready"
adb -s "$DEVICE" shell getprop ro.build.version.release || true

echo "=== Verifying Appium ==="
if ! command -v appium >/dev/null 2>&1; then
  echo "❌ appium is not on PATH"
  exit 1
fi

appium --version
appium driver list --installed

echo "=== Starting Appium ==="
rm -f appium.log appium_stdout.log

appium \
  --port 4723 \
  --log appium.log \
  --log-level info \
  >appium_stdout.log 2>&1 &
APPIUM_PID=$!

sleep 3
if ! kill -0 "$APPIUM_PID" 2>/dev/null; then
  echo "❌ Appium exited immediately"
  cat appium_stdout.log || true
  cat appium.log 2>/dev/null || true
  exit 1
fi

echo "=== Waiting for Appium port ==="
if ! npx --yes wait-on tcp:127.0.0.1:4723 \
  --timeout 120000 \
  --interval 2000; then
  echo "❌ Appium did not open port 4723"
  cat appium_stdout.log || true
  cat appium.log 2>/dev/null || true
  exit 1
fi

echo "✅ Appium is ready"

echo "=== Running Appium test ==="
set +e
node test_sample.js
TEST_EXIT=$?
set -e

if [ "$TEST_EXIT" -ne 0 ]; then
  echo "❌ Test script exited with code $TEST_EXIT"
  tail -n 100 appium.log 2>/dev/null || true
fi

exit "$TEST_EXIT"
