var random = require('pandemonium/random');
var Benchmark = require('benchmark')
var Keymaster = require('./helpers/key-distributions.js');
var Exerciser = require('./helpers/cache-exercisers.js');
var LRUCache = require('../../lru-cache.js'),
    LRUMap = require('../../lru-map.js'),
    LRUCacheWithDelete = require('../../lru-cache-with-delete.js'),
    LRUMapWithDelete = require('../../lru-map-with-delete.js');

Benchmark.options.minSamples = 30;

var CACHES = [LRUMap, LRUCache, LRUMapWithDelete, LRUMap, LRUCacheWithDelete, LRUCache];

var {
  StrKeys97, StrKeys70, StrKeysFlat, StrKeysOrdered, write1Read1, write1Read4, write1, read1,
} = Exerciser;

// var emptyCaches = makeCaches();
// scenario(emptyCaches, (cache) => (function() { readAll(cache, StrKeys97); }));

var fullCaches = Exerciser.makeLoadedCaches(CACHES, StrKeysOrdered);

// // console.log(`Pre-loaded 30k capacity caches, 400k reps of
// // one write from equally-occurring pool of 60k distinct keys, then
// // one read from a long-tail pool of 60k distinct keys (70% in 30k, 33% in 10k)`);
// scenario('1x flat writes, 1x gentle spread read', fullCaches, (cache) => (function() {
//   write1Read1(cache, [StrKeysFlat, StrKeys70], StrKeys70.length);
// }));

console.log(`\n\nPre-loaded 30k capacity caches, 400k reps of
  one write from equally-occurring pool of 60k distinct keys,
  then four reads from a long-tail pool of 60k distinct keys (70% in 30k, 33% in 10k)\n`);
scenario('1x flat writes, 4x gentle spread read', fullCaches, (cache) => (function() {
  write1Read4(cache, [StrKeysFlat, StrKeys70], StrKeys70.length);
}));

// console.log(`\n\n${fullCaches.note}\nRead one value then write one value from the same sharp (97/70) distribution\n`);
// scenario('individual get then set, sharp spread', fullCaches, (cache) => (function() {
//   cache.get(strgen97());
//   cache.set(strgen97(), 'hi');
// }));
//
// console.log(`\n\n${fullCaches.note}\nRead one value then write one value from a flat distribution 33% larger than the cache\n`);
// scenario('individual get then set, flat spread', fullCaches, (cache) => (function() {
//   cache.get(String(random(0, 40000)));
//   cache.set(String(random(0, 40000)), 'hi');
// }));

// console.log(`\n${fullCaches.note}\nRandom-order reads (no writes) from ${StrKeys97.note}\n`);
// //
// scenario('read-only sharp spread',  fullCaches, (cache) => (function() { readAll(cache, StrKeys97); }));
//
// console.log(`\n${fullCaches.note}\nRandom-order reads (no writes) from ${StrKeys70.note}\n`);
// //
// scenario('read-only gentle spread', fullCaches, (cache) => (function() { readAll(cache, StrKeys70); }));

function scenario(act, caches, actionsFactory, info) {
  var suite = decoratedSuite(act);
  caches.forEach((cache) => {
    var actions = actionsFactory(cache, info);
    suite.add(`${act} ${cache.name}`, actions);
    // console.log(actions())
  })
  suite.run({ minSamples: 36 });
}

function decoratedSuite(name) {
  return new Benchmark.Suite('Testing caches')
    .on('error', (event) => { console.error("error in benchmark", event.target.name, event.target.error) })
    .on('cycle', (event) => {
      const benchmark = event.target;
      console.log(" => ", benchmark.toString());
    }) // .on('complete', function() { console.log('Fastest is ' + this.filter('fastest').map('name')); });
}
