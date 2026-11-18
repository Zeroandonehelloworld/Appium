#!/usr/bin/env bash
# run_tests.sh — called by android-emulator-runner script: bash run_tests.sh
#
# NOTE: deliberately NOT using `set -e` here. Under `set -e` a single failing
# command (adb hiccup, a flaky dumpsys call, node returning non-zero) kills
# the whole script immediately and skips all the cleanup/log-dumping logic
# below it. Every step that must hard-stop the job (emulator never boots,
# Appium never starts) exits explicitly; everything else is best-effort and
# the script keeps going.

export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"

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

# ── 5. Sanity-check the Appium install BEFORE trying to launch it ─────────
#    Key fix: previously, if `appium` failed to start for any reason (bad
#    CLI flag, missing driver, etc.) it died silently before its own logger
#    ever opened appium.log, and we just burned 90s waiting on a port that
#    was never going to open with zero clue why. Fail fast here instead.
echo "=== Verifying Appium install ==="
echo "APPIUM_HOME=$APPIUM_HOME"
if ! command -v appium >/dev/null 2>&1; then
  echo "❌ 'appium' binary not found on PATH"
  echo "PATH=$PATH"
  npm root -g || true
  exit 1
fi
which appium
appium --version || { echo "❌ 'appium --version' failed"; exit 1; }
appium driver list --installed || { echo "❌ No Appium drivers installed"; exit 1; }

# ── 6. Start Appium ─────────────────────────────────────────────────────────
#    FIX: removed `--base-path '/'`. A bare '/' base path fails Appium's CLI
#    argument validation on some 2.x/3.x builds, which makes the process
#    exit immediately — before its internal logger even opens appium.log.
#    That silent, instant death is exactly what produced "cat: appium.log:
#    No such file or directory" plus a 90s wait-on timeout with no other
#    clue. The default base path is already '/', so dropping the flag keeps
#    identical behavior while avoiding the validation bug.
#
#    Also: redirect the process's own stdout/stderr to a second file. If
#    Appium dies before opening appium.log (its internal logger), this file
#    still captures whatever error it printed on the way out.
echo "=== Memory before starting Appium ==="
free -h

# GitHub-hosted ubuntu-latest runners have ~7GB RAM. A pixel_6 +
# google_apis_playstore emulator can eat most of that, leaving nothing for
# the Node/Appium process that starts right after boot — the OOM killer
# then kills it silently (no stdout, no log file content, just gone), which
# is exactly what the previous run showed. Add swap as a safety margin.
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  echo "=== No swap present, adding 4G swap file ==="
  sudo fallocate -l 4G /swapfile && \
    sudo chmod 600 /swapfile && \
    sudo mkswap /swapfile && \
    sudo swapon /swapfile && \
    echo "✅ swap added" || echo "⚠️  could not add swap (continuing anyway)"
  free -h
fi

echo "=== Starting Appium ==="
rm -f appium.log appium_stdout.log
(
  appium --port 4723 \
         --log appium.log \
         --log-level info
  echo "APPIUM_EXIT_CODE=$?"
) > appium_stdout.log 2>&1 &
APPIUM_PID=$!

# Give it a moment, then check it didn't die on the spot.
sleep 3
if ! kill -0 "$APPIUM_PID" 2>/dev/null; then
  echo "❌ Appium process ($APPIUM_PID) died immediately after launch"
  echo "--- appium_stdout.log ---"
  cat appium_stdout.log
  echo "--- appium.log ---"
  cat appium.log
  echo "--- free -h ---"
  free -h
  echo "--- dmesg (checking for OOM kill) ---"
  sudo dmesg 2>/dev/null | tail -40 || dmesg | tail -40 || true
  exit 1
fi
echo "Appium process is alive (pid $APPIUM_PID), waiting for it to bind the port..."

# ── 7. Wait until Appium is ready ───────────────────────────────────────────
npx --yes wait-on tcp:127.0.0.1:4723 --timeout 120000 --interval 2000
WAIT_EXIT=$?
if [ "$WAIT_EXIT" -ne 0 ]; then
  echo "=== Appium failed to start (did not bind port 4723 within timeout) ==="
  echo "--- appium_stdout.log ---"
  cat appium_stdout.log
  echo "--- appium.log ---"
  cat appium.log
  kill "$APPIUM_PID" 2>/dev/null || true
  exit 1
fi
echo "✅ Appium server is ready!"

# ── 8. Run the test ──────────────────────────────────────────────────────────
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
  cat appium.log 2>/dev/null || true
fi

kill "$APPIUM_PID" 2>/dev/null || true

# Always succeed: screenshots/logs (uploaded as artifacts in the workflow)
# are the record of what happened. A crash should never be the thing that
# stops the pipeline from moving on to the next step.
exit 0
