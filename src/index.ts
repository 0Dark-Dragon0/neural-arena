// ================================================================
// Neural Arena — Headless Bootloader
// ================================================================
// This entry point boots the system as a headless service 
// waiting for UI commands.
// ================================================================

import { RuntimeController } from './transport/RuntimeController';

console.log('');
console.log('  ╔══════════════════════════════════════════════╗');
console.log('  ║           NEURAL ARENA  v1.0.0               ║');
console.log('  ║      Autonomous Simulation Runtime            ║');
console.log('  ╚══════════════════════════════════════════════╝');
console.log('');
console.log('  [Boot] Initializing Headless Control Service...');

try {
  new RuntimeController(4000);
  console.log('  [Boot] Ready. Awaiting UI connection...');
} catch (err: any) {
  console.error(`  [Boot] Fatal Error: ${err.message}`);
  process.exit(1);
}

// Keep process alive
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down headless service...');
  process.exit(0);
});
