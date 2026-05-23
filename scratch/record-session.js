const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🚀 Starting Neural Arena Recording Automation...');

  // Ensure target recording directory exists
  const recordDir = path.join(__dirname, '../traces/recordings');
  if (!fs.existsSync(recordDir)) {
    fs.mkdirSync(recordDir, { recursive: true });
  }

  // Launch Chromium
  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized']
  });

  // Create browser context with video recording enabled at 1080p resolution
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: recordDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('📌 Navigating to Neural Arena Dashboard (http://localhost:5173)...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log('🔑 Bypassing Onboarding Wizard...');
    await page.evaluate(() => {
      localStorage.setItem('na_onboarding_complete', 'true');
    });

    // Reload the page to apply the onboarding bypass
    console.log('🔄 Reloading page to load Setup Screen...');
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for Setup Screen options to render
    console.log('⏳ Waiting for Setup Screen load...');
    await page.waitForTimeout(2000);

    // Locate and click the Launch Demo Match button
    const demoButton = page.locator('button:has-text("Launch Demo Match")');
    if (await demoButton.count() > 0) {
      console.log('🖱️ Clicking: ⚡ Launch Demo Match (No API Keys Required)...');
      await demoButton.click();
    } else {
      throw new Error('Could not find the "Launch Demo Match" button on the screen.');
    }

    // Wait for the simulation dashboard viewport to render
    console.log('🎮 Dashboard active. Capturing simulation run...');
    await page.waitForSelector('.font-telemetry', { timeout: 15000 });

    // Let the chess match execute for 30 seconds to capture moves and active telemetry
    console.log('📹 Recording active simulation loop (30 seconds)...');
    await page.waitForTimeout(30000);

    // Simulate clicking the Pause button on the control dock
    const pauseButton = page.locator('button:has-text("Pause"), [title="Pause"], button:has(.lucide-pause)');
    if (await pauseButton.count() > 0) {
      console.log('⏸️ Clicking Pause...');
      await pauseButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Simulate Replay Scrubber interaction
    console.log('🎛️ Simulating Timeline Scrubber interaction...');
    const scrubber = page.locator('input[type="range"]');
    if (await scrubber.count() > 0) {
      await scrubber.evaluate(el => {
        el.value = '5'; // Scrub back to turn 5
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      console.log('⏪ Timeline scrubbed back to Turn 5.');
      await page.waitForTimeout(4000);
    }

    // Simulate opening the Replay Library panel
    const libraryTab = page.locator('text="Replay Library"');
    if (await libraryTab.count() > 0) {
      console.log('🗂️ Navigating to Replay Library panel...');
      await libraryTab.click();
      await page.waitForTimeout(5000);
    }

    console.log('🎉 Recording complete. Closing browser session...');
  } catch (error) {
    console.error('❌ Automation Error:', error.message);
  } finally {
    // Close context to save the recorded video file
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      console.log(`\n✅ Video successfully saved at:`);
      console.log(`   ${videoPath}`);
      
      // Rename output file for clarity
      const cleanPath = path.join(recordDir, 'neural-arena-raw-ui.webm');
      if (fs.existsSync(videoPath)) {
        fs.renameSync(videoPath, cleanPath);
        console.log(`📂 Renamed asset to: ${cleanPath}`);
      }
    } else {
      console.log('⚠️ Warning: No video file was generated.');
    }
  }
})();
