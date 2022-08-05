var randomString = require('pandemonium/random-string');
var choice = require('pandemonium/choice');
var reservoirSample = require('pandemonium/reservoir-sample');
var Benchmark = require('benchmark')
var SetHelpers = require('../../set.js');

var sizes = { sm: 10, md: 1000, lg: 100000 };
var szKey, typeKey;

function randStringF() { return randomString(3, 10) }
function randNumberF() { return Math.floor(Math.random() * 1e12) }

function buildRandSet(sz, itemFactory) {
  var result = new Set([]);
  for (i = 0; i < sz; i++)
    result.add(itemFactory())
  return result
}

function mostlyOverlappingSameishSizedSet(setA, itemFactory) {
  var nToRemove = Math.ceil(0.05 * setA.size)
  var allA  = [...setA]
  var items = reservoirSample(nToRemove, allA);
  var setB  = new Set(allA);
  var i;
  for (i = 0; i < nToRemove; i++) {
    setB.delete(items[i])
    setB.add(itemFactory())
  }
  return setB
}

// modifies A to ensure that frac * setA.size elements are in both A and B,
// with A remaining approximately the same size.
function ensureOverlapFraction(setA, setB, frac) {
  var nOverlap = Math.floor(frac * setA.size);
  var itemsA = reservoirSample(nOverlap, [...setA]);
  var itemsB = reservoirSample(nOverlap, [...setB]);
  var i;
  // console.log(setA.size, setB.size, frac, nOverlap, itemsA)
  for (i = 0; i < nOverlap; i++) {
    setA.delete(itemsA[i]);
    setA.add(itemsB[i]);
  }
}

function mostlyDisjointSet(setB, sizeA, itemFactory) {
  var setA = buildRandSet(sizeA, itemFactory)
  ensureOverlapFraction(setA, setB, 0.05)
  return setA
}

function testSets(sizeMid, sizeSm, itemFactory) {
  var center     = buildRandSet(sizeMid, itemFactory);
  var sameishA   = mostlyOverlappingSameishSizedSet(center, itemFactory);
  var sameishB   = mostlyOverlappingSameishSizedSet(center, itemFactory);
  var disjointD  = mostlyDisjointSet(center, sizeMid, itemFactory);
  var smallish   = buildRandSet(sizeSm, itemFactory);
  ensureOverlapFraction(smallish, center, 0.05)
  return { center, sameishA, sameishB, disjointD, smallish }
}

var sets = testSets(10000, 200, randNumberF);

function scenario1(testMethod, sizeMd, sizeSm, itemFactory) {
  // var sets = testSets(sizeMd, sizeSm, itemFactory)
  // return testMethod(sets.center, sets.smallish, sets.sameishA, sets.sameishB);
  // return testMethod(sets.disjointD, sets.center, sets.smallish, sets.sameishA, sets.sameishB);
  // return testMethod(sets.smallish, sets.disjointD, sets.center, sets.sameishA, sets.sameishB);
  return testMethod(sets.center, sets.sameishA, sets.sameishB, sets.disjointD);

}

Benchmark.options.minSamples = 200;
var suite = new Benchmark.Suite('Testing sets')

const tt = Date.now()

console.log(scenario1(SetHelpers.intersection))

suite.on('cycle', event => {
  const benchmark = event.target;
  console.log(benchmark.toString(), Math.round((Date.now() - tt)/1000));
}).on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').map('name'), Math.round((Date.now() - tt)/1000));
});

suite
  .add('intersectionNew', () => scenario1(SetHelpers.intersection,    10000, 800, randNumberF))
  .add('intersectionOld', () => scenario1(SetHelpers.intersectionOld, 10000, 800, randNumberF))
  // .add('noop', () => scenario1((() => {}), 10000, 800, randNumberF))
  .run();

// for (szi1 = 0; szi1 < sizes.length; szi1++) {
//   var sz1  = sizes[szi1]
//   var set1 = buildStringSet(sz1)
//
// var OBJECTS = new Array(N);
// var KEYS = new Array(K);
//
// var i, j, o;
//
// for (i = 0; i < K; i++)
//   KEYS[i] = randomString(5, 15);
//
// for (i = 0; i < N; i++) {
//   o = {};
//
//   for (j = 0; j < S; j++)
//     o[choice(KEYS)] = Math.random();
//
//   OBJECTS[i] = o;
// }
//
// var o1, o2, o3;
//
// console.time('assign');
// for (i = 0; i < N; i++) {
//   o1 = choice(OBJECTS);
//   o2 = choice(OBJECTS);
//
//   o3 = Object.assign({}, o1, o2);
// }
// console.timeEnd('assign');
//
// console.time('spread');
// for (i = 0; i < N; i++) {
//   o1 = choice(OBJECTS);
//   o2 = choice(OBJECTS);
//
//   o3 = {
//     ...o1,
//     ...o2
//   };
// }
// console.timeEnd('spread');
