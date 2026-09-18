const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadSync(localState, online = true) {
  const storage = new Map([['myos03', JSON.stringify(localState)]]);
  const source = fs.readFileSync('app.js', 'utf8');
  const end = source.indexOf('async function readCloud');
  const context = {
    console,
    document: { querySelector: () => ({}), getElementById: () => null },
    window: { MYOS_CONFIG: {} },
    navigator: { onLine: online },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(0, end) + '\nthis.api={mergeStates,prepareSyncMerge,repairMigrationComplete,save,getState:()=>state};', context);
  return { ...context.api, storage };
}

function book(id, name, page, history) {
  return { id, name, page, total: 500, daily: 10, history };
}

// Android + iPhone + partial cloud: every unique book and every dated reading
// value survives. The current page and same-day legacy counter never go backwards.
{
  const engine = loadSync({ books: [] });
  const android = {
    books: [book(1, 'A', 40, { '2026-09-17': 5 }), book(2, 'B', 20, {})],
    _updatedAt: 100
  };
  const iphone = {
    books: [book(1, 'A', 35, { '2026-09-18': 7 }), book(3, 'C', 12, { '2026-09-18': 3 })],
    _updatedAt: 200
  };
  const cloud = { books: [book(1, 'A', 30, { '2026-09-16': 2 })], _updatedAt: 50 };
  const afterAndroid = engine.mergeStates(android, cloud);
  const merged = engine.mergeStates(iphone, afterAndroid);
  assert.deepEqual(Array.from(merged.books, x => x.name).sort(), ['A', 'B', 'C']);
  const a = merged.books.find(x => x.id === 1);
  assert.equal(a.page, 40);
  assert.deepEqual({ ...a.history }, { '2026-09-16': 2, '2026-09-17': 5, '2026-09-18': 7 });
}

// Per-field clocks allow edits made later on different devices to converge
// without an unrelated whole-state timestamp replacing either edit.
{
  const engine = loadSync({ books: [] });
  const base = engine.mergeStates(
    { goals: [{ id: 'g1', title: 'Goal', progress: 10 }], mode: 'Home', _updatedAt: 10 },
    { goals: [], tasks: [{ id: 't1', title: 'Task' }], _updatedAt: 5 }
  );
  const deviceA = structuredClone(base);
  deviceA.goals[0].progress = 25;
  deviceA._sync.clocks['goals.#g1.progress'] = 300;
  const deviceB = structuredClone(base);
  deviceB.tasks[0].title = 'Updated task';
  deviceB._sync.clocks['tasks.#t1.title'] = 400;
  const merged = engine.mergeStates(deviceA, deviceB);
  assert.equal(merged.goals[0].progress, 25);
  assert.equal(merged.tasks[0].title, 'Updated task');
}

// Identical legacy entries receive stable occurrence IDs and are not collapsed.
{
  const engine = loadSync({ books: [] });
  const meal = { name: 'Coffee', kcal: 5 };
  const merged = engine.mergeStates(
    { nutrition: { days: { '2026-09-18': { meals: [meal, meal] } } } },
    { nutrition: { days: { '2026-09-18': { meals: [meal, meal] } } } }
  );
  assert.equal(merged.nutrition.days['2026-09-18'].meals.length, 2);
  assert.notEqual(merged.nutrition.days['2026-09-18'].meals[0]._syncId, merged.nutrition.days['2026-09-18'].meals[1]._syncId);
}

// Offline save remains local-first and retains the historical storage key.
{
  const engine = loadSync({ books: [book(1, 'A', 1, {})] }, false);
  engine.getState().books[0].page = 9;
  engine.save();
  assert.equal(JSON.parse(engine.storage.get('myos03')).books[0].page, 9);
}

// V0.24.1 repair: a tablet's pre-existing book is uploaded, then pulled by
// iPhone without replacing its own book. Repeating repair is idempotent.
{
  const tablet = loadSync({
    books: [book('shared', 'Shared', 20, { '2026-09-17': 2 }), book('P', 'Tablet P', 80, { '2026-09-18': 8 })],
    _sync: { version: 24, clocks: {} }, _updatedAt: 100
  });
  const cloudBefore = { books: [book('shared', 'Shared', 15, { '2026-09-16': 1 })], _updatedAt: 90 };
  const tabletRepair = tablet.prepareSyncMerge(tablet.getState(), cloudBefore);
  assert.equal(tabletRepair.needsRepair, true);
  assert.deepEqual(Array.from(tabletRepair.merged.books, x => x.id).sort(), ['P', 'shared']);
  assert.equal(tablet.repairMigrationComplete(tabletRepair.merged), true);

  const iphone = loadSync({
    books: [book('shared', 'Shared', 18, { '2026-09-19': 3 }), book('I', 'iPhone I', 12, {})],
    _sync: { version: 24, clocks: {} }, _updatedAt: 110
  });
  const iphoneRepair = iphone.prepareSyncMerge(iphone.getState(), tabletRepair.merged);
  assert.deepEqual(Array.from(iphoneRepair.merged.books, x => x.id).sort(), ['I', 'P', 'shared']);
  const shared = iphoneRepair.merged.books.find(x => x.id === 'shared');
  assert.equal(shared.page, 20);
  assert.deepEqual({ ...shared.history }, { '2026-09-16': 1, '2026-09-17': 2, '2026-09-19': 3 });

  const repeated = iphone.prepareSyncMerge(iphoneRepair.merged, iphoneRepair.merged);
  assert.equal(repeated.needsRepair, false);
  assert.equal(repeated.merged.books.filter(x => x.id === 'P').length, 1);
  assert.equal(repeated.merged.books.filter(x => x.id === 'I').length, 1);
}

console.log('V0.24.1 sync and repair scenarios passed');
