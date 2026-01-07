// Verify that our code changes are correct
const fs = require('fs');

console.log('Reading main.js...');
const mainJs = fs.readFileSync('public/main.js', 'utf8');

// Check for the fixes we made
const checks = [
  {
    name: 'Removed early nobleCurves check',
    test: !mainJs.includes('console.log("nobleCurves immediate check:", typeof nobleCurves)'),
    issue: 'Early check should be removed from lines 2-5'
  },
  {
    name: 'Uses window.nobleCurves in DOMContentLoaded check',
    test: mainJs.includes('typeof window.nobleCurves === "undefined"'),
    issue: 'Should check window.nobleCurves in DOMContentLoaded handler'
  },
  {
    name: 'Uses window.nobleCurves.x25519',
    test: mainJs.includes('window.nobleCurves.x25519'),
    issue: 'Should use window.nobleCurves.x25519 when accessing the curve'
  },
  {
    name: 'No bare nobleCurves.x25519 references',
    test: !mainJs.match(/[^w]nobleCurves\.x25519/),
    issue: 'Should not have bare nobleCurves.x25519 (without window.)'
  }
];

console.log('\n=== Code Verification ===\n');

let allPassed = true;
checks.forEach((check, i) => {
  const passed = check.test;
  console.log(`${i + 1}. ${check.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  if (!passed) {
    console.log(`   Issue: ${check.issue}`);
    allPassed = false;
  }
});

console.log('\n=== HTML Module Script ===\n');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const hasModuleScript = indexHtml.includes('type="module"') &&
                        indexHtml.includes('window.nobleCurves = curves');
console.log(`Module script sets window.nobleCurves: ${hasModuleScript ? '✅ PASS' : '❌ FAIL'}`);

if (!hasModuleScript) {
  allPassed = false;
}

console.log('\n=== Result ===\n');
if (allPassed) {
  console.log('✅ All checks passed! Code looks good.');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Review the issues above.');
  process.exit(1);
}
