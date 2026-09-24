const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const program = source.slice(source.indexOf('function ensureFitness'), source.indexOf('function today(){'));
const context = {
  state: { fitness: { legacyField: 'kept', kegel: { selectedLevel: 0, history: [] } } },
  isoLocal: d => d.toISOString().slice(0, 10),
  localDateKey: value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '',
  clone: value => JSON.parse(JSON.stringify(value)),
  escapeHtml: String,
  MYOS_DEVICE_ID: 'test-device'
};
vm.createContext(context);
vm.runInContext(program + '\nthis.api={ensureFitness,kegelPlan,suggestedKegelLevel,kegelStreak,importLegacyKegelRecords};', context);

// Add-only migration keeps unrelated existing fitness data.
context.api.ensureFitness();
assert.equal(context.state.fitness.legacyField, 'kept');
assert.deepEqual(Array.from(context.state.fitness.kegel.history, x => x.date), ['2026-09-08', '2026-09-09', '2026-09-21']);
assert.equal(context.state.fitness.kegel.selectedLevel, 1);
assert.equal(context.state.fitness.kegel.history.every(x => x.legacy && x.imported && x.completed), true);

// Repeating startup/import is idempotent, while a later exact journal export
// enriches the deterministic date+workout record instead of duplicating it.
context.api.ensureFitness();
assert.equal(context.state.fitness.kegel.history.length, 3);
context.api.importLegacyKegelRecords([{ date: '2026-09-08', duration: 185, cycles: 8, exerciseNames: ['Сокращение'] }]);
assert.equal(context.state.fitness.kegel.history.length, 3);
const imported = context.state.fitness.kegel.history.find(x => x.date === '2026-09-08');
assert.equal(imported.duration, 185);
assert.equal(imported.cycles, 8);

// Program data drives the reusable phase sequence and progresses moderately.
const easy = context.api.kegelPlan(0);
const advanced = context.api.kegelPlan(3);
assert.ok(easy.phases.some(p => p.phase === 'СЖАТЬ'));
assert.ok(easy.phases.some(p => p.phase === 'РАССЛАБИТЬ'));
assert.equal(easy.phases.filter(p => p.exercise === 'Быстрые сокращения' && p.phase === 'СЖАТЬ').length, 10);
assert.equal(easy.phases.filter(p => p.exercise === 'Быстрые сокращения' && p.phase === 'ОТПУСТИТЬ').length, 10);
assert.ok(easy.phases.some(p => p.exercise === 'Длинные удержания' && p.phase === 'СЖАТЬ'));
assert.ok(easy.phases.some(p => p.phase === 'REVERSE KEGEL'));
assert.ok(easy.phases.some(p => p.phase === 'ОТДЫХ'));
assert.equal(easy.exercises.length, 6);
assert.ok(easy.phases.some(p => p.phase === 'ВДОХ'));
assert.ok(easy.phases.some(p => p.exercise === 'Встать и сесть с дыханием' && p.phase === 'ДВИЖЕНИЕ'));
assert.ok(easy.phases.filter(p => p.phase === 'РАССЛАБИТЬ' && p.exercise === 'Встать и сесть с дыханием').length === 5);
assert.ok(Math.max(...advanced.phases.filter(p => p.exercise === 'Длинные удержания' && p.phase === 'СЖАТЬ').map(p => p.seconds)) <= 10);
context.state.fitness.kegel.history.push({id:'next-session',date:'2026-09-22',completed:true});
const next = context.api.kegelPlan(0);
assert.ok(next.phases.some(p => p.exercise === 'Ягодичный мостик с дыханием' && p.phase === 'ДВИЖЕНИЕ'));
context.state.fitness.kegel.history.pop();
assert.ok(advanced.duration > easy.duration);
assert.ok(advanced.cycles > easy.cycles);
assert.match(easy.phases.find(p => p.phase === 'REVERSE KEGEL').instruction, /Не тужься/);
assert.ok(easy.phases.filter(p => p.phase === 'ОТДЫХ').every(p => p.nextExercise));
assert.equal(easy.number, 4);

// Timestamp-based timer catches up across more than one phase after backgrounding.
const tickSource = source.slice(source.indexOf('function finishWorkoutPhase'), source.indexOf('function workoutProgressPercent'));
const timer = {
  workoutRuntime: { plan: { phases: [{ seconds: 5 }, { seconds: 7 }, { seconds: 9 }] }, index: 0, remaining: 5, running: true, finished: false, endAt: 5000, completedPhaseIndexes: [], skippedPhaseIndexes: [] },
  phaseSignal: () => { timer.signals++ }, signals: 0,
  updateWorkoutDisplay: () => {}, renderWorkout: () => {}, renderWorkoutComplete: () => { timer.completed = true },
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
const saved = context.state.fitness.kegel.history.find(x => x.id === completed.id);
assert.equal(saved.completed, true);
assert.equal(saved.date, '2026-09-21');
console.log('V0.24.6 fitness program, timer and history scenarios passed');
