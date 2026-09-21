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
  vm.runInContext(source.slice(0, end) + '\nthis.api={mergeStates,prepareSyncMerge,repairMigrationComplete,repairJournal,deleteCollectionItem,save,getState:()=>state};', context);
  return { ...context.api, storage };
}

// V0.24.3 repairs the legacy array shape before defaults can hide it. A
// reload and a merge with an empty cloud journal both retain the answers.
{
  const legacy = [{ date: '2026-09-21', morning: { gratitude: 'Семья', intention: 'Спокойствие', completedAt: '2026-09-21T05:30:00Z' } }];
  const engine = loadSync({ books: [], journal: legacy });
  assert.equal(engine.getState().journal.days['2026-09-21'].morning.gratitude, 'Семья');
  const reloaded = loadSync(JSON.parse(engine.storage.get('myos03')));
  const merged = reloaded.mergeStates(reloaded.getState(), { journal: { days: {} }, _updatedAt: Date.now() + 1000 });
  assert.equal(merged.journal.days['2026-09-21'].morning.intention, 'Спокойствие');
  assert.equal(Object.keys(merged.journal.days).length, 1);
}

// In Asia/Almaty this timestamp is already the next local morning. The old
// UTC key is repaired to the user's calendar day, so Today can find it.
{
  const engine = loadSync({ books: [], journal: { days: {
    '2026-09-20': { date: '2026-09-20', morning: { gratitude: 'Жизнь', completedAt: '2026-09-20T20:30:00Z' }, evening: {} }
  } } });
  assert.equal(engine.getState().journal.days['2026-09-21'].morning.gratitude, 'Жизнь');
  assert.equal(Object.keys(engine.getState().journal.days).length, 1);
}

// Morning and evening are independently recovered from legacy containers;
// repeating the migration does not duplicate dates or discard unknown data.
{
  const engine = loadSync({ books: [], journal: { entries: [
    { date: '2026-09-20', morningRitual: { gratitude: 'Дом', completedAt: '2026-09-20T06:00:00Z' }, custom: 'keep' },
    { date: '2026-09-20', eveningRitual: { goodEvents: 'Прогулка', completedAt: '2026-09-20T19:00:00Z' } }
  ] } });
  engine.repairJournal(engine.getState());engine.repairJournal(engine.getState());
  const day = engine.getState().journal.days['2026-09-20'];
  assert.equal(day.morning.gratitude, 'Дом');
  assert.equal(day.evening.goodEvents, 'Прогулка');
  assert.equal(day.custom, 'keep');
  assert.equal(Object.keys(engine.getState().journal.days).length, 1);
}

function book(id, name, page, history) {
  return { id, name, page, total: 500, daily: 10, history };
}

// A book deletion is an explicit tombstone. A stale device may still carry the
// full book, but neither merge direction can revive it.
{
  const engine = loadSync({ books: [book('old', 'Delete me', 77, { '2026-09-19': 4 }), book('keep', 'Keep me', 21, {})] });
  const stale = structuredClone(engine.getState());
  const doomed = engine.getState().books.find(x => x.id === 'old');
  assert.equal(engine.deleteCollectionItem('books', doomed), true);
  engine.save();
  const deleted = structuredClone(engine.getState());
  assert.deepEqual(Array.from(deleted.books, x => x.id), ['keep']);
  assert.ok(deleted._sync.tombstones['books.#old']);
  assert.deepEqual(Array.from(engine.mergeStates(deleted, stale).books, x => x.id), ['keep']);
  assert.deepEqual(Array.from(engine.mergeStates(stale, deleted).books, x => x.id), ['keep']);
}

// Morning and evening use separate field clocks, so concurrent edits preserve
// both halves of one dated entry.
{
  const engine = loadSync({ books: [] });
  const base = engine.mergeStates({ journal: { days: {} } }, {});
  const phone = structuredClone(base);
  phone.journal.days['2026-09-20'] = { date: '2026-09-20', morning: { gratitude: 'Family', completedAt: '2026-09-20T06:00:00Z' }, evening: {} };
  phone._sync.clocks['journal.days.2026-09-20.morning.gratitude'] = 200;
  phone._sync.clocks['journal.days.2026-09-20.morning.completedAt'] = 200;
  const tablet = structuredClone(base);
  tablet.journal.days['2026-09-20'] = { date: '2026-09-20', morning: {}, evening: { goodEvents: 'Walk', completedAt: '2026-09-20T20:00:00Z' } };
  tablet._sync.clocks['journal.days.2026-09-20.evening.goodEvents'] = 300;
  tablet._sync.clocks['journal.days.2026-09-20.evening.completedAt'] = 300;
  const merged = engine.mergeStates(phone, tablet).journal.days['2026-09-20'];
  assert.equal(merged.morning.gratitude, 'Family');
  assert.equal(merged.evening.goodEvents, 'Walk');
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

// V0.24.2 repair: a tablet's pre-existing book is uploaded, then pulled by
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

// Completed Kegel sessions use stable record IDs. Two offline devices can add
// sessions independently, then both sessions survive either merge direction.
{
  const engine = loadSync({ books: [], fitness: { kegel: { selectedLevel: 0, history: [] } } });
  const base = structuredClone(engine.getState());
  const phone = structuredClone(base);
  phone.fitness.kegel.history.push({ id: 'kegel-phone', date: '2026-09-20', completed: true, level: 0, duration: 120 });
  phone._sync.clocks['fitness.kegel.history.#kegel-phone.completed'] = 200;
  const tablet = structuredClone(base);
  tablet.fitness.kegel.history.push({ id: 'kegel-tablet', date: '2026-09-21', completed: true, level: 1, duration: 180 });
  tablet._sync.clocks['fitness.kegel.history.#kegel-tablet.completed'] = 300;
  assert.deepEqual(Array.from(engine.mergeStates(phone, tablet).fitness.kegel.history, x => x.id).sort(), ['kegel-phone', 'kegel-tablet']);
  assert.deepEqual(Array.from(engine.mergeStates(tablet, phone).fitness.kegel.history, x => x.id).sort(), ['kegel-phone', 'kegel-tablet']);
}

console.log('V0.24.2 sync and repair scenarios passed');
