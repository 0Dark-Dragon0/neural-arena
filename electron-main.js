require('ts-node').register({
  compilerOptions: {
    module: "commonjs",
    esModuleInterop: true
  }
});
require('./src/electron/main.ts');
