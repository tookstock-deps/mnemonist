/**
 * Mnemonist LRUCacheWithExpiry
 * =============================
 *
 * An extension of LRUCache with time expiry
 */

var LRUCacheWithDelete = require('./lru-cache-with-delete.js'),
    forEach = require('obliterator/foreach'),
    typed = require('./utils/typed-arrays.js'),
    iterables = require('./utils/iterables.js');


// Besides the other ledgers of the backing cache, on every write operation
// the update time is saved in a fixed-sized array. No other speed or memory
// overhead is required for regular operations: most importantly, that means
// there is no age verification on read. You must periodically call the expire
// method, which evicts items older than the time-to-keep.
//
// Limitations:
//
// * The time-to-live (maximum age of any record returned in a read operation
//   is `(time-to-keep + maximum-delay-between-expires)`. By default the monitor
//   runs every (1 / 32)th of the TTK; for the default one-hour TTK, that is about
//   every two minutes. Expiring a 100_000-entry cache takes ?? milliseconds.
// * ...
//
// When the expire() method is called, it deletes every
// record that is older than the time-to-keep (ttk) cutoff.
//
// When a write happens we record ((getTime() - lastExpireTime()) / (ttk / 32))
//
function LRUCacheWithExpiry(Keys, Values, capacity, options = {}) {
  if (arguments.length < 2) {
    LRUCacheWithDelete.call(this, Keys);
  }
  else {
    LRUCacheWithDelete.call(this, Keys, Values, capacity);
  }
  this.getTime = options.getTime || Date.now;
  this.ttk = options.ttk || 60 * 60 * 1000; // one hour
  this.keepTtk = options.keepTtk || Math.floor((7 / 8) * this.ttk);
  this.agebins = options.agebins || 1000;
  this.horizon = 100; // number of bins in a ttk.

  // We invalidate (modulo agebins) all bins in whichever range is larger:
  //    the (currentBin - horizon)th bin to the currentBin, or
  //    the lastExpiredBin to the current Bin.
  //
  // As long as you call expire more frequently than the TTK, no item
  // older than the TTK will ever be read. Some items older than
  // `TTK - (horizon/TTK)` will be expired early.
  //
  // If you delay for longer than (agebins/horizon - 1) * ttk --
  // by default 3x the TTK -- we cannot tell the difference between
  // recently-written and very very old entries.


  // this.resolution = options.resolution || (this.agebins / 8)
  this.ttbin = this.ttk / this.agebins;
  var AgesBox = typed.getPointerArray(this.agebins);
  this.ages = new AgesBox(this.capacity);

  //
  this.initT = this.getTime();
  this.lastT = this.initT;
  // if (options.beatsSince) { this.beatsSince = options.beatsSince }
}

LRUCacheWithExpiry.prototype.numberOfTTKsBeforeRecentEntriesAreExpired = function () {
  return (this.agebins / this.horizon) - 1;
};

for (var k in LRUCacheWithDelete.prototype)
  LRUCacheWithExpiry.prototype[k] = LRUCacheWithDelete.prototype[k];

/**
 * If possible, attaching the
 * * #.entries method to Symbol.iterator (allowing `for (const foo of cache) { ... }`)
 * * the summaryString method to Symbol.toStringTag (allowing `\`${cache}\`` to work)
 * * the inspect method to Symbol.for('nodejs.util.inspect.custom') (making `console.log(cache)` liveable)
 */
if (typeof Symbol !== 'undefined') {
  LRUCacheWithExpiry.prototype[Symbol.iterator] = LRUCacheWithDelete.prototype[Symbol.iterator];
  Object.defineProperty(LRUCacheWithExpiry.prototype, Symbol.toStringTag, {
    get: function () { return `${this.constructor.name}:${this.size}/${this.capacity}`; },
  });
  LRUCacheWithExpiry.prototype[Symbol.for('nodejs.util.inspect.custom')] = LRUCacheWithDelete.prototype.inspect;
}

LRUCacheWithExpiry.prototype.beatsSince = function(t1, t2) {
  return ((t2 - t1) / this.ttbeat) % this.agebins;
};

LRUCacheWithExpiry.prototype.getBeat = function() {
  var nowT = this.getTime();
  // console.log('getBeat', this.initT, nowT, nowT - this.initT, this.beatsSince(this.initT, nowT));
  return this.beatsSince(this.initT, nowT);
};

/**
 * Method used to set the value for the given key in the cache.
 *
 * @param  {any} key   - Key.
 * @param  {any} value - Value.
 * @return {undefined}
 */
LRUCacheWithExpiry.prototype.set = function(key, value) {
  LRUCacheWithDelete.prototype.set.call(this, key, value);
  var pointer = this.items[key];
  this.ages[pointer] = this.getBeat();
};

/**
 * Method used to set the value for the given key in the cache
 *
 * @param  {any} key   - Key.
 * @param  {any} value - Value.
 * @return {{evicted: boolean, key: any, value: any}} An object containing the
 * key and value of an item that was overwritten or evicted in the set
 * operation, as well as a boolean indicating whether it was evicted due to
 * limited capacity. Return value is null if nothing was evicted or overwritten
 * during the set operation.
 */
LRUCacheWithExpiry.prototype.setpop = function(key, value) {
  var result = LRUCacheWithDelete.prototype.setpop.call(this, key, value);
  var pointer = this.items[key];
  this.ages[pointer] = this.getBeat();
  return result;
};

/**
 * Delete all cached items older than this.ttk
 */
LRUCacheWithExpiry.prototype.expire = function() {
  var currT = this.getTime();
  var currB = this.getBeat();
  console.log('exp', this.V, this.ages, currT, currB);
  var curfew = currB - this.beatsPerTTK;
  var ii;
  for (ii = 0; ii < this.capacity; ii++) {
    if (this.ages[ii] < curfew) {
      console.log('del', ii, this.V[ii], this.ages[ii]);
      this.delete(this.K[ii]);
    }
  }
};

/**
 *
 * Method used to start an asynchronous monitor that calls #expire()
 * on the given interval. Supply an optional callback to receive
 * any errors thrown during expiry.
 */
LRUCacheWithExpiry.prototype.monitor = function(interval, callback) {
  const self = this;
  function doExpire() {
    try { self.expire(); } catch (err) { callback(err); }
  }
  this.stopMonitor();
  this.timer = setInterval(doExpire, interval);
  return this.timer; // lets tests cancel the timer directly; you should use stopMonitor()
};

/*
 * Helper to convert given number of minutes to milliseconds
 */
LRUCacheWithExpiry.minutes = function(mins) { return 1000 * 60 * mins; };

/**
 *
 * Method used to stop the monitor, if any
 */
LRUCacheWithExpiry.prototype.stopMonitor = function() {
  if (this.timer) { clearInterval(this.timer); }
};

/**
 * Static @.from function taking an arbitrary iterable & converting it into
 * a structure.
 *
 * @param  {Iterable} iterable - Target iterable.
 * @param  {function} Keys     - Array class for storing keys.
 * @param  {function} Values   - Array class for storing values.
 * @param  {number}   capacity - Cache's capacity.
 * @return {LRUCacheWithExpiry}
 */
LRUCacheWithExpiry.from = function(iterable, Keys, Values, capacity, options) {
  if (arguments.length < 2) {
    capacity = iterables.guessLength(iterable);

    if (typeof capacity !== 'number')
      throw new Error('mnemonist/lru-cache.from: could not guess iterable length. Please provide desired capacity as last argument.');
  }
  else if (arguments.length === 2) {
    capacity = Keys;
    Keys = null;
    Values = null;
  }

  var cache = new LRUCacheWithExpiry(Keys, Values, capacity, options);

  forEach(iterable, function(value, key) {
    cache.set(key, value);
  });

  return cache;
};

module.exports = LRUCacheWithExpiry;
