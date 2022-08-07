/**
 * Mnemonist LRUCache Unit Tests
 * ==============================
 */
var assert = require('assert'),
LRUCacheCohort = require('../lru-cache.js');
// LRUCacheCohort = require('../lru-cache-cohort.js');

function timeFaker({initT, units = 60 * 1000}) {
  var fakeTime = {
    initT,
    units,
    currT: initT,
    advance(val) { this.currT += (val * this.units); },
    setTo(val) { this.currT = initT + (val * this.units); },
  };
  fakeTime.getTime = () => fakeTime.currT; // detachable from `this`
  return fakeTime;
}
// function sleep(millis) { return new Promise((yay, _boo) => { setTimeout(yay, millis); }); };

function makeTests(Cache, name) {
  describe(name, function() {

      var clockTimes = [
        Date.UTC(2020, 0, 1, 14, 0),
        // date.UTC(2020, 0, 1, 14, 14),
        // Date.UTC(2020, 0, 1, 14, 15),
        // Date.UTC(2020, 0, 1, 14, 16),
        // Date.UTC(2020, 0, 1, 14, 59),
        // Date.UTC(2020, 0, 1, 15,  0),
        // Date.UTC(2020, 0, 1, 15,  1),
        // Date.UTC(2020, 0, 1, 15, 59),
        // Date.UTC(2020, 0, 1, 16,  0),
        // Date.UTC(2020, 0, 1, 16,  1),
      ];

      // describe('construction', function() {
      //   it('uses pleasant defaults', function () {
      //     var cache = new Cache(6)
      //     bork
      //   })
      //   it('allows reasonable configurability', function () {
      //     var cache = new Cache(null, null, 6, {
      //       getTime: fakeTime.getTime, ttl: Cache.minutes(10), agebins: 2**16,
      //     })
      //     bork
      //   })
      // })

      describe.skip('time expiration', function () {
        it('keeps last-written-time in units of fractional ttl', function () {
          var fakeTime = timeFaker({initT: clockTimes[0]});
          var cache = new Cache(null, null, 6, {
            getTime: fakeTime.getTime, ttl: Cache.minutes(10), agebins: 100,
          });
          //
          cache.set(1, 't00');
          //
          fakeTime.setTo(0.001);
          cache.set(2, 't0pl'); cache.set(3, 't0pl');
          //
          fakeTime.setTo(8);
          cache.set(60, 't06');
          cache.set(61, 'evictme'); cache.set(62, 't06OftenRead');
          cache.get(1); cache.get(2); cache.get(3); cache.get(60);
          console.log(cache, fakeTime, fakeTime.getTime(), fakeTime.getTime() - fakeTime.initT);
          assert.deepStrictEqual(Array.from(cache.keys()), [60, 3, 2, 1, 62, 61]);
          assert.deepStrictEqual(cache.ages, [31, 3, 2, 1, 13]);

          cache.set(14, 'wave2a');
          cache.get(2);
          //
          fakeTime.setTo(8);
          //
          cache.set(21, 'wave3a'); cache.set(22, 'wave3b');
          cache.set(1, 'updatedW3');
          cache.get(11); cache.get(1); cache.get(2);
          //
          fakeTime.setTo(9.9);
          console.log('pt1', [...cache.values()], cache.beats);
          cache.expire();
          console.log('pt1', [...cache.values()], cache.beats);
          //
          fakeTime.setTo(10.01);
          assert.deepStrictEqual(cache.size, 6);
          cache.expire();
          console.log('pt1', [...cache.values()], cache.beats);
          assert.deepStrictEqual(cache.size, 5);

          // assert.deepStrictEqual(Array.from(cache.beats), []);
        });
      });

      describe('self-monitoring', function () {
        it('calls #expire on a regular interval', function(done) {
          //
          var cache = new Cache(4);
          //
          // clobber this cache's expire method with a spy
          var expireWasCalled = 0;
          cache.expire = function() { expireWasCalled++; };
          // sleep while the monitor call expire about nloops times
          var monitorT = 200, nloops = 5;
          var timer = cache.monitor(monitorT);
          //
          setTimeout(function() {
            cache.stopMonitor();
            try {
              assert.strictEqual(expireWasCalled >= nloops, true);
              done();
            } catch (err) { done(err); } finally { clearInterval(timer); }
          }, (monitorT * (nloops + 1)));
        });

        // it('enjoys a healthy workout', async function() {
        //   var cache = new Cache(null, null, 4, { ttl: 200 })
        //   cache.set(0, 'cero'); cache.set(1, 'uno'); cache.set(2, 'dos'); cache.remove(1);
        // })

      });

    describe.only('hi', function() {

      function powRand(ii) {
        var rand = Math.random()
        var yy = 80 * (((1 - rand)**(-0.5)) - 1)
        // var dist = Math.floor(100 * (yy))
        return Math.floor(yy)
      }
      function powRandArr() {
        var arr = []
        for (var ii = 0; ii < 1000; ii++) {
          arr.push(powRand(ii))
        }
        return arr
      }
      it('random variate', () => {
        var res = powRandArr()
        var counts = []
        for (var item of res) {
          if (item > 100) { item = 101 }
          if (! counts[item]) { counts[item] = 0 }
          counts[item]++
        }
        console.warn(counts, res.slice(0,20), res.slice(100, 120), res.slice(-20))
      })
    })
  });
}

makeTests(LRUCacheCohort, 'LRUCacheCohort');
