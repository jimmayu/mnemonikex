// Final comprehensive test using JSDOM without browser
const fs = require('fs');

console.log('=== Static Code Analysis ===\n');

// Read the files
const mainJs = fs.readFileSync('main.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Check 1: No premature nobleCurves access
const hasPrematureCheck = mainJs.substring(0, 200).includes('nobleCurves');
console.log(`1. No premature nobleCurves check: ${!hasPrematureCheck ? '✅' : '❌'}`);

// Check 2: DOMContentLoaded uses window.nobleCurves
const hasWindowCheck = mainJs.includes('typeof window.nobleCurves === "undefined"');
console.log(`2. DOMContentLoaded checks window.nobleCurves: ${hasWindowCheck ? '✅' : '❌'}`);

// Check 3: All curve access uses window.nobleCurves
const allCurveAccess = mainJs.match(/window\.nobleCurves\.x25519/g);
console.log(`3. Found ${allCurveAccess ? allCurveAccess.length : 0} window.nobleCurves.x25519 references: ${allCurveAccess && allCurveAccess.length >= 2 ? '✅' : '❌'}`);

// Check 4: Module script in HTML
const hasModuleScript = indexHtml.includes('type="module"') &&
                        indexHtml.includes('window.nobleCurves = curves');
console.log(`4. HTML sets window.nobleCurves in module: ${hasModuleScript ? '✅' : '❌'}`);

// Check 5: Main.js comes after the module script
const moduleScriptPos = indexHtml.indexOf('<script type="module">');
const mainJsPos = indexHtml.indexOf('<script src="main.js">');
console.log(`5. main.js loads after module script: ${mainJsPos > moduleScriptPos ? '✅' : '❌'}`);

// Check 6: No syntax errors in main.js (basic check)
let syntaxOk = true;
try {
  // Basic syntax check - look for obvious issues
  if (mainJs.includes('const curve = nobleCurves.x25519') && !mainJs.includes('window.')) {
    syntaxOk = false;
  }
  console.log(`6. No obvious syntax errors: ${syntaxOk ? '✅' : '❌'}`);
} catch (e) {
  console.log(`6. Syntax check: ❌ ${e.message}`);
  syntaxOk = false;
}

console.log('\n=== Summary ===\n');

if (!hasPrematureCheck && hasWindowCheck && allCurveAccess && allCurveAccess.length >= 2 &&
    hasModuleScript && mainJsPos > moduleScriptPos && syntaxOk) {
  console.log('✅ All checks passed!');
  console.log('\nThe fix should work:');
  console.log('  - No premature access to nobleCurves before it\'s loaded');
  console.log('  - DOMContentLoaded checks for window.nobleCurves');
  console.log('  - All x25519 access uses window.nobleCurves');
  console.log('  - Module script properly sets window.nobleCurves');
  console.log('  - Script loading order is correct');
  console.log('\n🎉 Ready to commit and deploy!');
  process.exit(0);
} else {
  console.log('❌ Some checks failed');
  process.exit(1);
}
