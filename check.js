const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

if (!content.includes('<h1>')) {
  console.error('❌ Check failed: missing <h1> tag');
  process.exit(1);
}

console.log('✅ Check passed: index.html looks valid');