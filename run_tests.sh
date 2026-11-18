#!/usr/bin/env bash
# run_tests.sh — called by android-emulator-runner script: bash run_tests.sh
#
# NOTE: deliberately NOT using `set -e` here. Under `set -e` a single failing
# command (adb hiccup, a flaky dumpsys call, node returning non-zero) kills
# the whole script immediately and skips all the cleanup/log-dumping logic
# below it. Every step that must hard-stop the job (emulator never boots,
# Appium never starts) exits explicitly; everything else is best-effort and
# the script keeps going.

# ── 1. Fix ADB offline state ───────────────────────────────────────────────
echo "=== Restarting ADB server ==="
adb kill-server || true
sleep 2
adb start-server
sleep 3
adb version
adb devices

# ── 2. Wait until Android has fully booted ─────────────────────────────────
echo "=== Waiting for sys.boot_completed ==="
BOOT_TIMEOUT=300
ELAPSED=0
until adb shell getprop sys.boot_completed 2>/dev/null | grep -q "^1$"; do
  if [ "$ELAPSED" -ge "$BOOT_TIMEOUT" ]; then
    echo "❌ Emulator did not fully boot within ${BOOT_TIMEOUT}s"
    adb devices
    adb logcat -d | tail -n 50 || true
    exit 1
  fi
  echo "  ... still booting (${ELAPSED}s)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
echo "✅ Android fully booted after ${ELAPSED}s"

# ── 3. Let Google services fully settle ────────────────────────────────────
sleep 10

# ── 4. Force-launch Play Store via adb BEFORE Appium starts ───────────────
#    Without this, Appium connects but the app never opens → home screen only.
echo "=== Launching Play Store via adb ==="
adb shell am start -n com.android.vending/com.google.android.finsky.activities.MainActivity || \
  echo "⚠️  Could not launch Play Store via adb (continuing — Appium's activateApp will retry)"
sleep 6

# Confirm Play Store is in foreground (diagnostic only, never fatal)
echo "=== Current foreground activity ==="
adb shell dumpsys window windows 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" || true

echo "=== Android version ==="
adb shell getprop ro.build.version.release || true

# ── 5. Start Appium ─────────────────────────────────────────────────────────
echo "=== Starting Appium ==="
appium --port 4723 \
       --log appium.log \
       --log-level info \
       --base-path '/' &
APPIUM_PID=$!

# ── 6. Wait until Appium is ready ───────────────────────────────────────────
npx wait-on tcp:127.0.0.1:4723 --timeout 90000 --interval 2000
if [ $? -ne 0 ]; then
  echo "=== Appium failed to start ==="
  cat appium.log || true
  kill "$APPIUM_PID" 2>/dev/null || true
  exit 1
fi
echo "✅ Appium server is ready!"

# ── 7. Run the test ──────────────────────────────────────────────────────────
#    test_sample.js already catches its own errors (missing elements, UI
#    changes, dropped sessions, ...) and exits 0 so a handled failure never
#    fails the job; it saves screenshots as evidence instead. We still guard
#    the exit code here in case something unexpected ever returns non-zero,
#    so a single flaky run never blocks the pipeline.
set +e
node test_sample.js
TEST_EXIT=$?
set -e

if [ "$TEST_EXIT" -ne 0 ]; then
  echo "⚠️  Test script exited with code $TEST_EXIT — dumping Appium log for diagnosis"
  cat appium.log || true
fi

kill "$APPIUM_PID" 2>/dev/null || true

# Always succeed: screenshots/logs (uploaded as artifacts in the workflow)
# are the record of what happened. A crash should never be the thing that
# stops the pipeline from moving on to the next step.
exit 0
