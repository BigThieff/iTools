// Generate macOS .icns from transparent SVG source
// Requires dev deps: icon-gen, sharp

const path = require('path');
const fs = require('fs');
const iconGen = require('icon-gen');

(async () => {
  const src = path.resolve(__dirname, '../assets/app-icon-source.svg');
  const outDir = path.resolve(__dirname, '../assets');

  if (!fs.existsSync(src)) {
    console.error('Source SVG not found:', src);
    process.exit(1);
  }

  try {
    const result = await iconGen(src, outDir, {
      report: true,
      modes: ['icns'], // only macOS
    });

    const generatedIcns = Array.isArray(result.icns) && result.icns.length ? result.icns[0] : null;
    const target = path.join(outDir, 'app-icon.icns');

    if (generatedIcns && generatedIcns !== target) {
      // Rename to app-icon.icns expected by electron-builder config
      fs.renameSync(generatedIcns, target);
      console.log('ICNS renamed to', target);
    } else if (!generatedIcns && fs.existsSync(path.join(outDir, 'icon.icns'))) {
      fs.renameSync(path.join(outDir, 'icon.icns'), target);
      console.log('ICNS renamed to', target);
    } else if (!fs.existsSync(target)) {
      console.warn('ICNS generated but could not determine path. Please check assets/ directory.');
    }

    console.log('ICNS generation done.');
  } catch (err) {
    console.error('Failed to generate ICNS:', err);
    process.exit(1);
  }
})();
