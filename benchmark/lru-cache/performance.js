var random = require('pandemonium/random');
var Benchmark = require('benchmark')
var Keymaster = require('./key-distributions.js');
var LRUCache = require('../../lru-cache.js'),
    LRUMap = require('../../lru-map.js'),
    LRUCacheWithDelete = require('../../lru-cache-with-delete.js'),
    LRUMapWithDelete = require('../../lru-map-with-delete.js');

var TEST_CAP = 30000

// 400k entries with approx 42k distinct values btwn 0 and 60k, distributed 300k/65k/23k/10k/5k/3k (~97% in the top 30k)
var NumKeys97 = Keymaster.longTailArr(400000, 60000, -0.4);
var StrKeys97 = Keymaster.stringifyArr(NumKeys97);
var intgen97  = Keymaster.longTailIntGen(60000, -0.4);
var strgen97  = Keymaster.longTailStrGen(60000, -0.4);
NumKeys97.note = 'Long-tail pool of 42,000 distinct values, 97% in the top 30k, 75% in the top 10k'; StrKeys97.note = NumKeys97.note;
// 400k entries with approx 50k distinct values btwn 0 and 60k, distributed 230k/80k/40k/22k/15k/10k (~88% in the top 30k)
var NumKeys88 = Keymaster.longTailArr(400000, 60000, -0.7)
// 400k entries with approx 60k distinct values btwn 0 and 60k, distributed 135k/85k/61k/48k/39k/33k (~70% in the top 30k)
var NumKeys70 = Keymaster.longTailArr(400000, 60000, -10);
var StrKeys70 = Keymaster.stringifyArr(NumKeys70);
NumKeys70.note = 'Long-tail pool of ~60,000 distinct values, 70% in the top 30k, 33% in the top 10k'; StrKeys70.note = NumKeys70.note;
// 120k entries with approx 52k distinct values btwn 0 and 60k, distributed evenly
var NumKeysFlat = Keymaster.flatDistArr(120000, 60000);
var StrKeysFlat = Keymaster.stringifyArr(NumKeysFlat);
// 31k entries running 0-31k in order
var NumKeysOrdered = Keymaster.ascendingArr(31000, 31000);
var StrKeysOrdered = Keymaster.stringifyArr(NumKeysOrdered);

const CACHES = [LRUCache, LRUCacheWithDelete, LRUMap, LRUMapWithDelete, LRUCache];

// var emptyCaches = makeCaches();
// scenario(emptyCaches, (cache) => (function() { readAll(cache, StrKeys97); }));

var fullCaches = makeLoadedCaches(StrKeysOrdered);
fullCaches.note = 'Pre-loaded 30k capacity caches';

// console.log(`Pre-loaded 30k capacity caches, 400k reps of
// one write from equally-occurring pool of 60k distinct keys, then
// one read from a long-tail pool of 60k distinct keys (70% in 30k, 33% in 10k)`);
scenario('1x flat writes, 1x gentle spread read', fullCaches, (cache) => (function() {
  write1Read1(cache, [StrKeysFlat, StrKeys70], StrKeys70.length);
}));

console.log(`Pre-loaded 30k capacity caches, 400k reps of
one write from equally-occurring pool of 60k distinct keys,
then four reads from a long-tail pool of 60k distinct keys (70% in 30k, 33% in 10k)`);
scenario('1x flat writes, 4x gentle spread read', fullCaches, (cache) => (function() {
  write1Read4(cache, [StrKeysFlat, StrKeys70], StrKeys70.length);
}));

console.log(`${fullCaches.note}\nRead one value then write one value from the same sharp (97/70) distribution`);
scenario('individual get then set, sharp spread', fullCaches, (cache) => (function() {
  cache.get(strgen97());
  cache.set(strgen97(), 'hi');
}));

console.log(`${fullCaches.note}\nRead one value then write one value from a flat distribution 33% larger than the cache`);
scenario('individual get then set, flat spread', fullCaches, (cache) => (function() {
  cache.get(String(random(0, 40000)));
  cache.set(String(random(0, 40000)), 'hi');
}));

console.log(`Pre-loaded 30k capacity caches, random-order reads (no writes) of 42,000 distinct values.
The top 30k of values occur ~97% of the time and the top 10k values 75% of the time.`);
//
scenario('read-only sharp spread',  fullCaches, (cache) => (function() { readAll(cache, StrKeys97); }));

console.log(`Pre-loaded 30k capacity caches, random-order reads (no writes) of 60,000 distinct values.
The top 30k of values occur ~70% of the time and the top 10k values 33% of the time.`);
//
scenario('read-only gentle spread', fullCaches, (cache) => (function() { readAll(cache, StrKeys70); }));

function readAll(cache, arrA, count) {
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    cache.get(arrA[ii % arrA.length])
  }
}

function writeAll(cache, arrA, count) {
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    var storeme = arrA[ii % arrA.length]
    cache.set(storeme, storeme)
  }
}

function write1Read1(cache, [arrA, arrB], count) {
  var blen = arrB.length;
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    var storeme = arrA[ii % arrA.length]
    cache.set(storeme, storeme)
    cache.get(arrB[ii % blen])
  }
}

function write1Read4(cache, [arrA, arrB], count) {
  var blen = arrB.length;
  var boff0 = 0, boff1 = blen * 0.25, boff2 = blen * 0.50, boff1 = blen * 0.75;
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    var storeme = arrA[ii % arrA.length]
    cache.set(storeme, storeme)
    cache.get(arrB[(ii + boff0) % blen])
    cache.get(arrB[(ii + boff1) % blen])
    cache.get(arrB[(ii + boff2) % blen])
    cache.get(arrB[(ii + boff3) % blen])
  }
}

function decoratedSuite(name) {
  return new Benchmark.Suite('Testing caches')
    .on('cycle', event => {
    const benchmark = event.target;
    console.log(benchmark.toString());
  }) // .on('complete', function() { console.log('Fastest is ' + this.filter('fastest').map('name')); });
}

function makeCaches(factories = CACHES) {
  return factories.map((CacheFactory) => {
    var cache = new CacheFactory(TEST_CAP);
    cache.name = CacheFactory.name;
    return cache;
  })
}

function makeLoadedCaches(arrA, count) {
  if (! count) { count = arrA.length; }
  var caches = makeCaches()
  caches.forEach((cache) => {
    writeAll(cache, arrA, count);
  })
  return caches;
}

function scenario(act, caches, actionsFactory, info) {
  var suite = decoratedSuite(act);
  caches.forEach((cache) => {
    var actions = actionsFactory(cache, info);
    suite.add(`${act} ${cache.name}`, actions);
  })
  suite.run();
}
