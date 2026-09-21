const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('let kegelTimer=');
const end = source.indexOf('function fitness(){', start);
assert.ok(start >= 0 && end > start, 'Kegel program helpers are present');

function engine(kegel) {
  const context = {
    state: { fitness: { kegel } },
    setInterval: () => 1,
    clearInterval: () => {},
    Date,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nthis.api={nextKegelDay,kegelPlan};', context);
  return context.api;
}

// A migrated owner resumes conservatively instead of being sent to beginner day 1.
{
  const api = engine({ startDay: 6, history: [] });
  assert.equal(api.nextKegelDay(), 6);
  const plan = api.kegelPlan(6);
  assert.equal(plan.day, 6);
  assert.ok(plan.phases.some(x => x.kind === 'hold'));
  assert.ok(plan.phases.some(x => x.kind === 'rest'));
  assert.ok(plan.phases.some(x => x.kind === 'quick'));
  assert.ok(plan.phases.some(x => x.kind === 'reverse'));
  assert.ok(plan.phases.find(x => x.kind === 'reverse').instruction.includes('Не тужься'));
}

// Calendar gaps do not advance progression; only completed program days do.
{
  const api = engine({ startDay: 6, history: [
    { programDay: 6, date: '2026-09-08', completedAt: '2026-09-08T12:00:00Z' },
    { programDay: 7, date: '2026-09-12' },
  ] });
  assert.equal(api.nextKegelDay(), 7);
}

// Imported completions can establish a later continuation point, and load rises gradually.
{
  const api = engine({ startDay: 4, history: [
    { programDay: 8, date: '2026-09-15', completedAt: '2026-09-15T12:00:00Z', source: 'manual' },
  ] });
  assert.equal(api.nextKegelDay(), 9);
  assert.ok(api.kegelPlan(10).hold <= api.kegelPlan(11).hold);
  assert.ok(api.kegelPlan(11).hold - api.kegelPlan(10).hold <= 1);
}

console.log('V0.24.2 Kegel continuation scenarios passed');
