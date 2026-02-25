const fs = require('fs');
const raw = fs.readFileSync('scripts/flow-analysis-result.txt', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);
const flows = data.flows.filter(f => !f.openingTitle.toLowerCase().includes('sample'));
fs.writeFileSync('scripts/flows-clean.json', JSON.stringify(flows, null, 2), 'utf8');
console.log('Flows written:', flows.map(f => f.openingTitle).join(', '));
