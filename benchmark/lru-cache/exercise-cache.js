var random = require('pandemonium/random');
var Benchmark = require('benchmark')
var Keymaster = require('./key-distributions.js');

var TEST_CAP = 30000

// 400k entries with approx 42k distinct values btwn 0 and 60k, distributed 300k/65k/23k/10k/5k/3k (~97% in the top 30k)
var NumKeys97 = Keymaster.longTailArr(400000, 60000, -0.4);
var StrKeys97 = Keymaster.stringifyArr(NumKeys97);
var intgen97  = Keymaster.longTailIntGen(60000, -0.4);
var strgen97  = Keymaster.longTailStrGen(60000, -0.4);
NumKeys97.note = 'Long-tail pool of 42,000 distinct values, 97% in the top 30k, 75% in the top 10k'; StrKeys97.note = NumKeys97.note;
// 400k entries with approx 50k distinct values btwn 0 and 60k, distributed 230k/80k/40k/22k/15k/10k (~88% in the top 30k)
// var NumKeys88 = Keymaster.longTailArr(400000, 60000, -0.7)
// 400k entries with approx 60k distinct values btwn 0 and 60k, distributed 135k/85k/61k/48k/39k/33k (~70% in the top 30k)
var NumKeys70 = Keymaster.longTailArr(400000, 60000, -10);
var StrKeys70 = Keymaster.stringifyArr(NumKeys70);
var intgen70  = Keymaster.longTailIntGen(60000, -10);
var strgen70  = Keymaster.longTailStrGen(60000, -10);
NumKeys70.note = 'Long-tail pool of ~60,000 distinct values, 70% in the top 30k, 33% in the top 10k'; StrKeys70.note = NumKeys70.note;
// 120k entries with approx 52k distinct values btwn 0 and 60k, distributed evenly
var NumKeysFlat = Keymaster.flatDistArr(120000, 60000);
var StrKeysFlat = Keymaster.stringifyArr(NumKeysFlat);
// 31k entries running 0-31k in order
var NumKeysOrdered = Keymaster.ascendingArr(31000, 31000);
var StrKeysOrdered = Keymaster.stringifyArr(NumKeysOrdered);


function read1(cache, arrA, count) {
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    cache.get(arrA[ii % arrA.length])
  }
}

function write1(cache, arrA, count) {
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
  var boff0 = 0, boff1 = blen * 0.25, boff2 = blen * 0.50, boff3 = blen * 0.75;
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

function delete1(cache, [arrA], count) {
  if (! count) { count = arrA.length; }
  for (var ii = 0; ii < count; ii++) {
    var delme = arrA[ii % arrA.length]
    cache.delete(delme, delme)
  }
}

function makeLoadedCaches(CacheFactories, arrA, count, capacity = TEST_CAP) {
  return CacheFactories.map((CacheFactory) => makeLoadedCache(CacheFactory, arrA, count, capacity));
}

function makeLoadedCache(CacheFactory, arrA, count, capacity = TEST_CAP) {
  if (! count) { count = arrA.length; }
  var cache = new CacheFactory(capacity);
  cache.name = CacheFactory.name;
  write1(cache, arrA, count);
  var capK = Math.round(capacity / 1000);
  cache.note = `Pre-loaded ${cache.name}@${capK}k`;
  return cache;
}

function makeCaches(CacheFactories) {
  return CacheFactories.map((CacheFactory) => {
    var cache = new CacheFactory(TEST_CAP);
    cache.name = CacheFactory.name;
    return cache;
  })
}

function times(count, func, args = {}) {
  for (var ii = 0; ii < count; ii++) {
    func(args, ii, count);
  }
}

function round(val, decimals) {
  chunk = Math.round(Math.pow(10, decimals));
  return Math.round(val * chunk) / chunk;
}

module.exports = {
  NumKeys97, StrKeys97, intgen97, strgen97,
  NumKeys70, StrKeys70, intgen70, strgen70,
  NumKeysFlat, StrKeysFlat,
  NumKeysOrdered, StrKeysOrdered,
  read1, write1, write1Read1, write1Read4, delete1,
  makeLoadedCaches, makeLoadedCache, makeCaches,
  times, round,
}
