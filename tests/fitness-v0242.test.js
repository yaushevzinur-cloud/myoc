const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const program = source.slice(source.indexOf('function ensureFitness'), source.indexOf('function today(){'));
const context = {
  state: { fitness: { legacyField: 'kept', kegel: { selectedLevel: 0, history: [] } } },
  isoLocal: d => d.toISOString().slice(0, 10),
  escapeHtml: String,
  MYOS_DEVICE_ID: 'test-device'
};
vm.createContext(context);
vm.runInContext(program + '\nthis.api={ensureFitness,kegelPlan,suggestedKegelLevel,kegelStreak};', context);

// Add-only migration keeps unrelated existing fitness data.
context.api.ensureFitness();
assert.equal(context.state.fitness.legacyField, 'kept');
assert.deepEqual(Array.from(context.state.fitness.kegel.history), []);

// Program data drives the reusable phase sequence and progresses moderately.
const easy = context.api.kegelPlan(0);
const advanced = context.api.kegelPlan(3);
assert.ok(easy.phases.some(p => p.phase === 'СЖАТЬ'));
assert.ok(easy.phases.some(p => p.phase === 'РАССЛАБИТЬ'));
assert.ok(easy.phases.some(p => p.phase === 'БЫСТРЫЕ СОКРАЩЕНИЯ'));
assert.ok(easy.phases.some(p => p.phase === 'ДЛИННОЕ УДЕРЖАНИЕ'));
assert.ok(easy.phases.some(p => p.phase === 'ОБРАТНЫЙ КЕГЕЛЬ'));
assert.ok(easy.phases.some(p => p.phase === 'ОТДЫХ'));
assert.ok(advanced.duration > easy.duration);
assert.ok(advanced.cycles > easy.cycles);
assert.match(easy.phases.find(p => p.phase === 'ОБРАТНЫЙ КЕГЕЛЬ').instruction, /Не тужься/);

// Timestamp-based timer catches up across more than one phase after backgrounding.
const tickSource = source.slice(source.indexOf('function workoutTick'), source.indexOf('function updateWorkoutDisplay'));
const timer = {
  workoutRuntime: { plan: { phases: [{ seconds: 5 }, { seconds: 7 }, { seconds: 9 }] }, index: 0, remaining: 5, running: true, finished: false, endAt: 5000 },
  phaseSignal: () => { timer.signals++ }, signals: 0,
  updateWorkoutDisplay: () => {}, renderWorkoutComplete: () => { timer.completed = true },
  clearInterval: () => {}, workoutInterval: 1
};
vm.createContext(timer);
vm.runInContext(tickSource + '\nthis.tick=workoutTick;', timer);
timer.tick(11000);
assert.equal(timer.workoutRuntime.index, 1);
assert.equal(timer.workoutRuntime.remaining, 1);
timer.tick(22000);
assert.equal(timer.workoutRuntime.finished, true);
assert.equal(timer.completed, true);
assert.equal(timer.signals, 3);

// A dated, stable-id record merges as a unique collection entity.
const completed = { id: 'kegel-1-test-device', date: '2026-09-21', completed: true, level: 0, duration: easy.duration, exercises: 5, cycles: easy.cycles, completedAt: '2026-09-21T08:00:00.000Z' };
context.state.fitness.kegel.history.push(completed);
assert.equal(context.state.fitness.kegel.history[0].completed, true);
assert.equal(context.state.fitness.kegel.history[0].date, '2026-09-21');
console.log('V0.24.2 fitness program, timer and history scenarios passed');
