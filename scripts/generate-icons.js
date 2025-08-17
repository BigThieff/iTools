// Generate macOS .icns and Windows .ico from macOS style SVG source
// Requires dev deps: icon-gen, sharp

const path = require('path');
const fs = require('fs');
const iconGen = require('icon-gen');

(async () => {
  const src = path.resolve(__dirname, '../assets/app-icon-macos.svg');
  const outDir = path.resolve(__dirname, '../assets');

  if (!fs.existsSync(src)) {
    console.error('Source SVG not found:', src);
    process.exit(1);
  }

  try {
    // 生成 macOS .icns 文件
    console.log('Generating macOS .icns...');
    const icnsResult = await iconGen(src, outDir, {
      report: true,
      modes: ['icns'], // macOS
    });

    // 生成 Windows .ico 文件  
    console.log('Generating Windows .ico...');
    const icoResult = await iconGen(src, outDir, {
      report: true,
      modes: ['ico'], // Windows
    });

    // 处理 .icns 文件重命名
    const generatedIcns = Array.isArray(icnsResult.icns) && icnsResult.icns.length ? icnsResult.icns[0] : null;
    const icnsTarget = path.join(outDir, 'app.icns');

    if (generatedIcns && generatedIcns !== icnsTarget) {
      fs.renameSync(generatedIcns, icnsTarget);
      console.log('✅ ICNS renamed to', icnsTarget);
    } else if (!generatedIcns && fs.existsSync(path.join(outDir, 'icon.icns'))) {
      fs.renameSync(path.join(outDir, 'icon.icns'), icnsTarget);
      console.log('✅ ICNS renamed to', icnsTarget);
    }

    // 处理 .ico 文件重命名
    const generatedIco = Array.isArray(icoResult.ico) && icoResult.ico.length ? icoResult.ico[0] : null;
    const icoTarget = path.join(outDir, 'app.ico');

    if (generatedIco && generatedIco !== icoTarget) {
      fs.renameSync(generatedIco, icoTarget);
      console.log('✅ ICO renamed to', icoTarget);
    } else if (!generatedIco && fs.existsSync(path.join(outDir, 'icon.ico'))) {
      fs.renameSync(path.join(outDir, 'icon.ico'), icoTarget);
      console.log('✅ ICO renamed to', icoTarget);
    }

    console.log('🎉 Icon generation completed successfully!');
  } catch (err) {
    console.error('❌ Failed to generate icons:', err);
    process.exit(1);
  }
})();
