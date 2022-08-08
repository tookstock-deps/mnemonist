/**
 * Mnemonist LRUCacheWithExpiry
 * =============================
 *
 * An extension of LRUCache with time expiry
 */

var LRUCacheWithDelete = require('./lru-cache-with-delete.js'),
    forEach = require('obliterator/foreach'),
    // typed = require('./utils/typed-arrays.js'),
    iterables = require('./utils/iterables.js');

// Besides the other ledgers of the backing cache, on every write operation
// the update time is saved in a fixed-sized array. No other speed or memory
// overhead is required for regular operations: most importantly, that means
// there is no age verification on read. You must periodically call the expire
// method, which evicts items older than the time-to-keep.
//
// Limitations:
//
// * The time-to-live (maximum age of any record returned in a read operation)
//   has the weak guarantee of `(time-to-keep + maximum-delay-between-expires)`.
//
// * The expire operation must be done as a whole, and this does not
//   offer to do it in a separate thread or make any attempt to be
//   thread safe. However, the benchmarks in `benchmark/lru-cache` show
//   that a full delete of every item in a 30,000 element cache runs in
//   less than 5ms on a 2019 Macbook Pro.
//
// * Having two expire operations scheduled in the same thread should
//   be harmless but would give no speedup, so if you found yourself
//   in a situation where the expire was taking significant time it
//   could be big trouble.
//
// * Due to floating-point shenanigans a custom clock returning
//   fractional times may behave unexpectedly; why do you need them?
//
// Alternatives considered and discarded:
//
// * The expire operation of this class walks the full length of the
//   age ledger, rather than having say a heap to reveal only the
//   expirable record. This seems like a bad tradeoff.
//
// * Could maintain two or more generations of cached items, rotating
//   then at ttl/2. (write to both, read from the new generation
//   falling back to the old generation, and on each expire discard
//   the oldest generation and add a new empty cache). This would make
//   expiry O(1), with low impact on individual operations but a
//   notable tradeoff in cache efficiency.
//
// Potential Opportunities for improvement:
//
// * Minimize the memory footprint of the age ledger by chunking the
//   timestamps to bytes or words. In the case of byte (256 age bins)
//   a 10-minute ttl and otherwise default parameters, an expire
//   operation would discard everything older than (ttk - ttk/64)
//   (guaranteeing the ttk but reaping an additional 1.5% of records).
//   Expire must be called at least once every `2 * ttk` (20 minutes)
//   or the newest records would be indistinguishable from the oldest
//   records. (Everything would work but it would be a damn shame for
//   cache efficiency). A word-sized (64k bins) ledger makes this
//   pretty trivial, and offering both choices shouldn't be a problem.
//
// * For every record it expires we independently doctor the read-age
//   linked list. It may make more sense to walk the linked list.
//
// When the expire() method is called, it deletes every
// record that is older than the time-to-keep (ttk) cutoff.
//
// By default the monitor
//   runs every (1 / 32)th of the TTK; for the default one-hour TTK, that is about
//   every two minutes. Expiring a 100_000-entry cache takes ?? milliseconds.
// When a write happens we record ((getTime() - lastExpireTime()) / (ttk / 32))
//

/**
 *
 * LRU cache with time-to-keep expiration
 *
 * Trades fast read/writes for guarantees on timely expiration or fast
 * expiration loops.
 *
 * @param  {Iterable} iterable - Target iterable.
 * @param  {function} Keys     - Array class for storing keys.
 * @param  {function} Values   - Array class for storing values.
 * @param  {number}   capacity - Cache's capacity.
 * @param  {object}   capacity - Configuration
 * @param  {function} [options.getTime = Date.now] - replaces the meaning of time (for mocking and to allow eg a vector clock). Will be called with the object and action as parameters.
 * @param  {number}   [options.ttk = 15 minutes] - when expire is called all items whose update time is older than ttk milliseconds will be deleted. Other items may be as well, depending on implementation.
 *
 * @return {LRUCacheWithExpiry}
 */
function LRUCacheWithExpiry(Keys, Values, capacity, options = {}) {
  if (arguments.length <= 1) {
    options = {}; capacity = Keys;
    LRUCacheWithDelete.call(this, capacity);
  }
  else if (arguments.length <= 2) {
    options = Values; capacity = Keys;
    LRUCacheWithDelete.call(this, capacity);
  }
  else {
    LRUCacheWithDelete.call(this, Keys, Values, capacity);
  }
  if (options.ttl || options.ttl === 0) {
    throw new Error('Please supply options.ttk (time-to-**keep**), not ttl (and understand the difference)');
  }
  this.getTime = options.getTime || Date.now;
  this.ttk = options.ttk || LRUCacheWithExpiry.minutes(15);
  this.ages = new Float64Array(this.capacity);
  //
  this.initT = this.getTime('init', this);
  this.lastT = this.initT;
}

// FIXME: remove?
LRUCacheWithExpiry.prototype.investigate = function(...args) {
  // eslint-disable-next-line no-console
  console.log(this.inspect({all: true}), ...args);
};

/**
 * LRUCacheWithExpiry inherits from LRUCacheWithDelete
 */

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
Object.defineProperty(LRUCacheWithExpiry.prototype, 'summary', Object.getOwnPropertyDescriptor(LRUCacheWithDelete.prototype, 'summary'));

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
  this.ages[pointer] = this.getTime('set', this);
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
  this.ages[pointer] = this.getTime('set', this);
  return result;
};

/**
 * All items written before this time are due for expiry
 */
Object.defineProperty(LRUCacheWithExpiry.prototype, 'curfew', {
  get() { return this.getTime('check', this) - this.ttk; }
});

/**
 * Delete all cached items older than this.ttk
 */
LRUCacheWithExpiry.prototype.expire = function() {
  this.getTime('startExpire', this);
  var curfew = this.curfew;
  var ii;
  for (ii = 0; ii < this.capacity; ii++) {
    if (this.ages[ii] <= curfew) {
      this.delete(this.K[ii]);
    }
  }
  this.lastT = this.getTime('doneExpire', this);
};

// /**
//  * Delete all cached items older than this.ttk
//  */
// LRUCacheWithExpiry.prototype.expireUsingLinkedList = function() {
//   var currT = this.getTime('startExpire', this);
//   var curfew = this.curfew
//   // TODO: are there savings from unwinding the delete op into this?
//   var pointer = this.head;
//   while ((pointer !== this.tail) && (this.size > 1)) {
//     if (this.ages[pointer] < curfew) {
//       console.log('del', pointer, this.V[pointer], this.ages[pointer]);
//       this.delete(this.K[pointer]);
//     } else {
//       this.pointer = this.backward[pointer]
//     }
//   }
// };

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
    options = {};
  }

  var cache = new LRUCacheWithExpiry(Keys, Values, capacity, options);

  forEach(iterable, function(value, key) {
    cache.set(key, value);
  });

  return cache;
};

module.exports = LRUCacheWithExpiry;
