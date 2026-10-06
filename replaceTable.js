const fs = require('fs');
let p = fs.readFileSync('src/app/page.tsx', 'utf8');

// Replace the table with GroupedInventory
const startString = '<div className="p-0">';
const endString = '</table>\n            </div>';
const startIndex = p.indexOf(startString);
const endIndex = p.indexOf(endString) + endString.length;

if (startIndex !== -1 && endIndex !== -1) {
  p = p.substring(0, startIndex) + '<GroupedInventory inventory={inventory} />' + p.substring(endIndex);
}

// Ensure GroupedInventory is imported
if (!p.includes('GroupedInventory')) {
  p = "import GroupedInventory from '@/components/GroupedInventory';\n" + p;
}

fs.writeFileSync('src/app/page.tsx', p, 'utf8');
console.log('Replaced table with GroupedInventory');
