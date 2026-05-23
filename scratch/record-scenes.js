const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const recordDir = path.join(__dirname, '../traces/recordings');
if (!fs.existsSync(recordDir)) {
  fs.mkdirSync(recordDir, { recursive: true });
}

// Trim video function using ffmpeg (re-encoding for frame accuracy)
function trimVideo(inputPath, outputPath, offsetMs, durationMs) {
  const offsetSec = (offsetMs / 1000).toFixed(3);
  const durationSec = (durationMs / 1000).toFixed(3);
  console.log(`✂️ Trimming video: Seek to ${offsetSec}s, duration ${durationSec}s...`);
  try {
    // Force re-encoding with libvpx-vp9 for exact frame-accurate cutting
    execSync(`ffmpeg -y -i "${inputPath}" -ss ${offsetSec} -t ${durationSec} -c:v libvpx-vp9 -crf 24 -b:v 0 -c:a libopus "${outputPath}"`, { stdio: 'ignore' });
    console.log(`✅ Video trimmed and re-encoded successfully: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.warn(`⚠️ Re-encoding failed, trying stream copy fallback:`, err.message);
    try {
      execSync(`ffmpeg -y -ss ${offsetSec} -i "${inputPath}" -t ${durationSec} -c copy "${outputPath}"`, { stdio: 'ignore' });
      console.log(`✅ Video trimmed successfully (stream copy fallback): ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e2) {
      console.error(`❌ Failed to trim video:`, e2.message);
      // Fallback: copy whole file if trim fails
      fs.copyFileSync(inputPath, outputPath);
    }
  }
}

// Resets dashboard to Setup Screen
async function resetToSetup(page) {
  console.log('🧹 Running workspace state cleanup...');
  await page.goto('http://localhost:5173');
  await page.evaluate(() => localStorage.setItem('na_onboarding_complete', 'true'));
  await page.reload({ waitUntil: 'networkidle' });

  const stopButton = page.locator('button[title="Stop"]');
  if (await stopButton.isVisible() && await stopButton.isEnabled()) {
    console.log('🛑 Active simulation running on server. Stopping it...');
    await stopButton.click();
    await page.waitForTimeout(1500);
  }

  const exitReplay = page.locator('button[title="Exit Replay"]');
  if (await exitReplay.isVisible()) {
    console.log('🚪 Active replay mode active. Exiting replay...');
    await exitReplay.click();
    await page.waitForTimeout(1500);
  }
}

async function runScene(name, description, durationMs, actionCallback) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`🎥 Scene: ${name}`);
  console.log(`📝 Description: ${description}`);
  console.log(`------------------------------------------------------------`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: recordDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  const startTime = Date.now();
  let totalOffsetMs = 0;
  let success = false;

  try {
    await resetToSetup(page);
    
    const actionStartTime = Date.now();
    const offsetWithinActionMs = await actionCallback(page, context) || 0;
    
    await page.waitForTimeout(durationMs);
    
    totalOffsetMs = (actionStartTime - startTime) + offsetWithinActionMs;
    success = true;
  } catch (error) {
    console.error(`❌ Error in ${name}:`, error.message);
  } finally {
    const video = page.video();
    let videoPath = null;
    if (video) {
      try {
        videoPath = await video.path();
      } catch (err) {
        console.warn('Could not get video path before close', err.message);
      }
    }
    
    await context.close();
    await browser.close();

    if (success && videoPath) {
      const targetPath = path.join(recordDir, `${name}.webm`);
      trimVideo(videoPath, targetPath, totalOffsetMs, durationMs);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } else if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
  }
}

(async () => {
  console.log('🚀 Starting Neural Arena Cinematic Scenes Recording Automation...');

  // =========================================================================
  // SCENE 1 — THE HOOK (5 seconds)
  // =========================================================================
  await runScene(
    'scene1_the_hook',
    'Cinematic look at active dashboard with chessboard running and telemetry updates.',
    5000,
    async (page) => {
      const actionStartTime = Date.now();
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      await page.waitForTimeout(5000); // let it warm up
      return Date.now() - actionStartTime;
    }
  );

  // =========================================================================
  // SCENE 2 — START SIMULATION (7 seconds)
  // =========================================================================
  await runScene(
    'scene2_start_simulation',
    'Clicks Launch Demo Match button and watches the status go online.',
    7000,
    async (page) => {
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await page.waitForTimeout(1000);
      console.log('🖱️ Clicking Launch Demo Match... ');
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      return 0; // Start video from the Setup screen
    }
  );

  // =========================================================================
  // SCENE 3 — AI THINKING (10 seconds)
  // =========================================================================
  await runScene(
    'scene3_ai_thinking',
    'Focus on the Cognition Panels, latency graphs, and prompt validation stages.',
    10000,
    async (page) => {
      const actionStartTime = Date.now();
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      await page.waitForTimeout(3000); // let it warm up
      return Date.now() - actionStartTime;
    }
  );

  // =========================================================================
  // SCENE 4 — THE VIRAL MOMENT (16 seconds)
  // =========================================================================
  await runScene(
    'scene4_viral_moment',
    'Captures the illegal move attempt by Black, Anti-Cheat warning flash, and self-correction.',
    16000,
    async (page) => {
      const actionStartTime = Date.now();
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      
      console.log('⏳ Waiting for Turn 3 (ply 5 illegal move attempt) to start...');
      await page.waitForFunction(() => {
        const spans = Array.from(document.querySelectorAll('.font-telemetry'));
        return spans.some(span => span.textContent.trim() === '3.');
      }, { timeout: 30000 });

      return Date.now() - actionStartTime;
    }
  );

  // =========================================================================
  // SCENE 5 — REPLAY ENGINE (12 seconds)
  // =========================================================================
  await runScene(
    'scene5_replay_engine',
    'Pause game, drag scrubber backward to rewind board, then scrub forward.',
    12000,
    async (page) => {
      const actionStartTime = Date.now();
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      
      // Let it play for 10 seconds to compile some history
      await page.waitForTimeout(10000);
      
      // Enter Replay Mode
      console.log('🔄 Entering Replay Mode...');
      const reviewBtn = page.locator('button[title="Enter Replay Mode"]');
      await reviewBtn.waitFor({ state: 'visible' });
      await reviewBtn.click();
      await page.waitForTimeout(1000);
      
      const offset = Date.now() - actionStartTime;
      
      // Locate scrubber track
      const track = page.locator('.cursor-pointer.group').first();
      await track.waitFor({ state: 'visible' });
      const box = await track.boundingBox();
      if (box) {
        console.log('⏪ Scrubbing back to 20%...');
        await track.click({ position: { x: box.width * 0.2, y: box.height / 2 } });
        await page.waitForTimeout(5000);
        
        console.log('⏩ Scrubbing forward to 80%...');
        await track.click({ position: { x: box.width * 0.8, y: box.height / 2 } });
      }
      
      return offset;
    }
  );

  // =========================================================================
  // SCENE 6 — BENCHMARK DASHBOARD (10 seconds)
  // =========================================================================
  await runScene(
    'scene6_benchmark_dashboard',
    'View the Telemetry/Benchmark dashboard to see radar charts, latency charts, and metrics.',
    10000,
    async (page) => {
      const actionStartTime = Date.now();
      
      // 1. Launch a demo match
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      
      // 2. Wait 10 seconds to compile events
      await page.waitForTimeout(10000);
      
      // 3. Pause simulation to freeze telemetry values
      const pauseBtn = page.locator('button[title="Pause"]');
      if (await pauseBtn.isVisible()) {
        await pauseBtn.click();
        await page.waitForTimeout(500);
      }
      
      const offset = Date.now() - actionStartTime;
      
      // 4. Click the Telemetry tab
      console.log('📊 Navigating to Telemetry tab...');
      const telemetryTab = page.locator('button:has-text("Telemetry")').first();
      await telemetryTab.click();
      
      return offset;
    }
  );

  // =========================================================================
  // SCENE 7 — FINAL SHOT (10 seconds)
  // =========================================================================
  await runScene(
    'scene7_final_shot',
    'Show the full moving dashboard for a clean cinematic ending.',
    10000,
    async (page) => {
      const actionStartTime = Date.now();
      const launchBtn = page.locator('button:has-text("Launch Demo Match")');
      await launchBtn.waitFor({ state: 'visible' });
      await launchBtn.click();
      await page.waitForSelector('.font-telemetry');
      await page.waitForTimeout(4000);
      
      const offset = Date.now() - actionStartTime;
      
      // Inject CSS for slow cinematic zoom out
      console.log('🔍 Injecting cinematic zoom-out animation...');
      await page.evaluate(() => {
        const root = document.querySelector('#root') || document.body;
        root.style.transition = 'transform 10000ms cubic-bezier(0.1, 0.8, 0.3, 1)';
        root.style.transformOrigin = 'center center';
        setTimeout(() => {
          root.style.transform = 'scale(0.96)';
        }, 50);
      });
      
      return offset;
    }
  );

  console.log('\n🎉 All cinematic scenes have been recorded successfully in traces/recordings/!');
})();
