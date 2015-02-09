var KanbanStorage = require('../../kanbanStorage'),
    moment = require('moment-range'),
    _ = require('lodash'),
    expect = require('chai').expect,
    config = require('../../config'),
    DateUtil = require('../../dateUtil').DateUtil;

var storage = new KanbanStorage('./server/test/storage/'); // relative to main dir

/**
 * Helper functions for testing
 */
function verifyCount(expectedItems, actualItems) {
  expect(typeof actualItems === 'object' ? actualItems.length : actualItems)
    .to.equal(expectedItems.length);
  return null;
}

function collectObjectIdsAndSmallestDate(items, dateField) {
  var objectIDs = [],
      smallestDate = DateUtil.getDate();

  items.forEach(function(item) {
    objectIDs.push(item.objectID);

    var itemDate = DateUtil.getDate(item[dateField]);
    item[dateField] = itemDate.utc().toDate(); // convert to Date before saving

    if (itemDate.isBefore(smallestDate)) {
      smallestDate = itemDate;
    }
  });

  return {
    ids: objectIDs,
    smallestDate: smallestDate
  };
}

function buildStartDateCriteria(date) {
  return {
    startDate: date.format(config.dateFormat)
  };
}

function getBasicCRDTestFn(dataFile, dsDateField, saveFn, readFn, delFn) {
  return function() {

    before(cleanup);

    var sampleData = require('../fixtures/' + dataFile + '.json');
    var idsAndSmallestDate = collectObjectIdsAndSmallestDate(
      sampleData, dsDateField);
    var sampleVerifyCount = verifyCount.bind(this, sampleData);

    it('# CRD functionalities should be working', function(done) {
      saveFn(sampleData) // Verify Save data
        .then(sampleVerifyCount)
        .then(function() {
          // Verify read by date field
          return readFn(buildStartDateCriteria(idsAndSmallestDate.smallestDate));
        })
        .then(sampleVerifyCount)
        .then(function() {
          // Verify delete data by object id
          return delFn({objectID: {$in: idsAndSmallestDate.ids}}, {multi: true});
        })
        .then(sampleVerifyCount)
        .then(function() {
          return saveFn(sampleData);
        })
        .then(function() {
          // Verify delete data by date field
          var criteria = {};
          criteria[dsDateField] = {$gte: idsAndSmallestDate.smallestDate};
          return delFn(criteria, {multi: true});
        })
        .then(sampleVerifyCount)
        .then(function() {
          return readFn({});
        })
        .then(function(records) {
          expect(records.length).to.equal(0);
          return null;
        })
        .then(done)
        .catch(done);
    });
  };
}

function cleanup(done) {
  return storage.removeSnapshot({}, {multi: true})
    .then(function() {
      return storage.removeItems({}, {multi: true});
    })
    .then(function() {
      done();
      return null;
    })
    .catch(done);
}

function getDayFromUTCDateString(utcDate) {
  return utcDate.split('T')[0];
}

function collectLogSummary(item) {
  var sortedLogs = storage.sortItemStatusChangeLog(item),
      logSummary = {
        earliestTime: sortedLogs[0].from,
        earliestDay: getDayFromUTCDateString(sortedLogs[0].from),
        latestDay: getDayFromUTCDateString(sortedLogs[sortedLogs.length - 1].from),
        dailyLogs: []
      };

  sortedLogs.forEach(function(log) {
    var startDate = getDayFromUTCDateString(log.from),
        endDate = moment(getDayFromUTCDateString(log.to), config.dateFormat),
        nextDate = moment(startDate, config.dateFormat),
        today = DateUtil.getDate();

    while (!nextDate.isAfter(endDate, 'day') &&
        !nextDate.isAfter(today, 'day')) {
      logSummary.dailyLogs.push({date: nextDate.format(config.dateFormat), status: log.status});
      nextDate = nextDate.add(1, 'day');
    }
  });

  return logSummary;
}

function verifySnapshotStatus(snapshots, logSummary) {
  snapshots.forEach(function(snapshot) {
    var date = DateUtil.getDate(snapshot.date).format(config.dateFormat);
    if (date < logSummary.earliestDay) {
      // Should not have snapshot before earliest day
      expect(false).to.equal(true);
    }
    if (date > logSummary.latestDay) {
      date = logSummary.latestDay;
    }
    var status = logSummary.dailyLogs.reduce(function(status, log) {
      if (getDayFromUTCDateString(log.date) === date) {
        return log.status;
      }
      return status;
    }, '');

    expect(snapshot.status).to.equal(status);
  });
}

function getDayDiff(recent, before) {
  var d1 = recent.clone(),
      d2 = before.clone(),
      diff = 0;

  if (config.ignoreWeekend) {
    while (!d2.isAfter(d1, 'day')) {
      var weekDay = d2.day();

      if (weekDay !== 0 && weekDay !== 6) {
        diff++;
      }
      d2.add(1, 'd');
    }
  } else {
    diff = d1.diff(d2, 'day') + 1;
  }
  return diff;
}

function getConvertItemDetailToSnapshotVerifier(itemData, offset) {
  return function() {
    itemData.forEach(function(item) {
      var logSummary = collectLogSummary(item),
          earliest = DateUtil.getDate(logSummary.earliestTime),
          today = DateUtil.getDate(),
          dayDiff = getDayDiff(today, earliest),
          startDate;

      if (offset > 0) {
        startDate = earliest.clone().add(offset, 'd');
        dayDiff = getDayDiff(today, startDate);
      } else {
        startDate = earliest.clone().subtract(Math.abs(offset), 'd');
      }

      var snapshots = storage.convertItemDetailToSnapshot(
        [item], startDate.format(config.dateFormat));

      expect(snapshots.length).to.equal(dayDiff);

      verifySnapshotStatus(snapshots, logSummary);
    });
  };
}

/**
 * Test scenarios
 */

describe('Date construction', function() {
  it('format ' + config.dateFormat, function() {
    var testDate = '2014-04-28';
    var date = DateUtil.getDate(testDate);

    expect(date.format(config.dateFormat)).to.equal(testDate);
    expect(date.isSame(moment.utc(testDate, config.dateFormat), 'd')).to.equal(true);
  });

  it('iso format', function() {
    function testISODate(isoDateStr) {
      var testDate = getDayFromUTCDateString(isoDateStr);
      var isoDate = DateUtil.getDate(isoDateStr);

      expect(isoDate.format(config.dateFormat)).to.equal(testDate);
      expect(isoDate.isSame(moment.utc(testDate, config.dateFormat), 'd')).to.equal(true);
    }

    // '2014-04-28T08:21:10.578Z';
    var testDate = '2014-04-28';
    for (var i = 0; i <= 23; i++) {
      var hour = i < 10 ? '0' + i : i;

      testISODate(testDate + 'T' + hour + ':00:00.000Z');
      testISODate(testDate + 'T' + hour + ':59:59.999Z');
    }
  });
});


describe('Snapshot Basic Operation',
  getBasicCRDTestFn('snapshot', 'date', storage.saveSnapshot,
    storage.getSnapshot, storage.removeSnapshot));


describe('Item Basic Operation',
  getBasicCRDTestFn('kanbanItems', 'kanbanizedOn', storage.saveItems,
    storage.getItems, storage.removeItems));


describe('Item Update Operation', function() {

  before(cleanup);

  var itemData = require('../fixtures/kanbanItems.json');
  var singleItemUpdate = require('../fixtures/singleItemUpdate.json');

  it('#updateItems', function(done) {
    storage.saveItems(itemData)
      .then(function() {
        return storage.updateItems(singleItemUpdate);
      })
      .then(function(updatedCnt) {
        expect(updatedCnt).to.equal(1);
        return storage.getItems({owner: singleItemUpdate[0].owner});
      })
      .then(function(dbItems) {
        expect(dbItems.length).to.equal(1);
        expect(dbItems[0].statusChangeLog.length).to.equal(6);

        return null;
      })
      .then(done)
      .catch(done);
  });
});

describe('Snapshot construction', function() {

  before(cleanup);

  var itemData = require('../fixtures/kanbanItems.json');

  describe('#convertItemDetailToSnapshot', function() {
    it('Snapshot schema is valid', function() {
      var snapshotFields = ['objectID', 'type', 'owner', 'status', 'date'],
          snapshots = storage.convertItemDetailToSnapshot(
            itemData, DateUtil.getDate('2014-04-28').format(config.dateFormat));

      snapshots.forEach(function(snapshot) {
          expect(snapshotFields).to.have.members(_.keys(snapshot));
      });
    });

    it('Period exactly starts from item earliest status log',
      getConvertItemDetailToSnapshotVerifier(itemData, 0));

    it('Period starts before item earliest status log',
      getConvertItemDetailToSnapshotVerifier(itemData, -1));

    it('Period starts after item earliest status log',
      getConvertItemDetailToSnapshotVerifier(itemData, 1));
  });

  describe('#initHistoricalData', function() {
    function getSnapshotEarliestDateAndCount(snapshots) {
      return snapshots.reduce(function(result, snapshot) {
        if (result.date > snapshot.date) {
          result.date = snapshot.date;
          result.cnt = 0;
        }
        if (result.date === snapshot.date) {
          result.cnt++;
        }
        return result;
      }, {date: new Date(), cnt: 0});
    }

    function snapshotComparator(s1, s2) {
      var d = s1.date - s2.date;
      if (d !== 0) {
        return d;
      }

      if (s1.objectID < s2.objectID) {
        return -1;
      } else if (s1.objectID > s2.objectID) {
        return 1;
      }
      return 0;
    }

    function deepCompare(s1, s2, comparator) {
      s1.forEach(function(s) {
        delete s._id;
      });

      s2.forEach(function(s) {
        delete s._id;
      });

      s1.sort(comparator);
      s2.sort(comparator);

      expect(s1).to.deep.equal(s2);
    }

    var startDate = '2014-04-20',
        snapshots1 = storage.convertItemDetailToSnapshot(itemData, startDate),
        earliestDateAndCnt = getSnapshotEarliestDateAndCount(snapshots1);

    // For second verification
    var dateAfterEarliest = DateUtil.getDate(earliestDateAndCnt.date)
          .clone().add(1, 'day'),
        snapshots2 = storage.convertItemDetailToSnapshot(itemData, dateAfterEarliest);

    it('Without capturing item detail', function(done) {
      storage.initHistoricalData(itemData, startDate, false)
        .then(function(snapshots) {
          // Step 1: Load all item snapshot because the startDate is earlier than
          // snapshot earliest date.

          // Snapshot data inserted is the same as the converted ones
          deepCompare(snapshots, snapshots1, snapshotComparator);
          return snapshots;
        })
        .then(function(fullSnapshots) {
          // Step 2: re-init the historical data by resetting the startDate
          // to be later than earliest snapshot date
          return storage.initHistoricalData(itemData, dateAfterEarliest, false)
            .then(function(snapshots) {
              // Snapshot data inserted is the same as the converted ones
              deepCompare(snapshots, snapshots2, snapshotComparator);

              // Re-init snapshot data count should be same as full snapshot length
              // minus the count of the snapshot on earliest date
              expect(snapshots.length).to.equal(
                fullSnapshots.length - earliestDateAndCnt.cnt);
              return storage.getSnapshot({});
            })
            .then(function(dbSnapshots) {
              // After Step 2: the DB snapshot total records should be same as
              // the snapshot total records generated in Step 1.
              // deepCompare(dbSnapshots, fullSnapshots, snapshotComparator);
              expect(dbSnapshots.length).to.equal(fullSnapshots.length);
              return true;
            });
        })
        .then(function() {
          // Step 3: there is no item detail records as it's not enabled.
          return storage.getItems({})
            .then(function(items) {
              expect(items.length).to.equal(0); // No item detail is captured in DB
              done();
            });
        })
        .catch(done);
    });

    it('With capturing item detail', function(done) {
      function itemComparator(s1, s2) {
        if (s1.objectID < s2.objectID) {
          return -1;
        } else if (s1.objectID > s2.objectID) {
          return 1;
        }
        return 0;
      }

      storage.initHistoricalData(itemData, startDate, true)
        .then(function(result) {
          // Result should be in such format:
          // {
          //   updatedItemCnt:
          //   newItems:
          //   snapshots:
          // }
          expect(['updatedItemCnt', 'newItems', 'snapshots']).to.have.members(
            _.keys(result));

          // Step 1: Load all item snapshot because the startDate is earlier than
          // snapshot earliest date.

          // Snapshot data inserted is the same as the converted ones
          deepCompare(result.snapshots, snapshots1, snapshotComparator);

          // All items are newly created for the first time.
          expect(result.updatedItemCnt).to.equal(0);
          deepCompare(result.newItems, itemData, itemComparator);

          return null;
        })
        .then(function() {
          // Step 1: Remove one item in storage first.
          var itemToRemove = itemData[0];

          return storage.removeItems({objectID: itemToRemove.objectID})
            .then(function() {
              storage.initHistoricalData(itemData, startDate, true)
                .then(function(result) {
                  // Step 2: Load all item snapshot because the startDate is earlier than
                  // snapshot earliest date.

                  // Snapshot data inserted is the same as the converted ones
                  deepCompare(result.snapshots, snapshots1, snapshotComparator);

                  // Updated items are the ones except the first one
                  expect(result.updatedItemCnt).to.equal(itemData.length - 1);

                  // Newly created item is the one removed in Step 1
                  deepCompare(result.newItems, [].concat(itemToRemove), itemComparator);

                  done();
                  return null;
                });
            });
        })
        .catch(done);
      });

    it('Re-init new items can accumulate previous snapshots', function(done) {

      storage.initHistoricalData(itemData, '2014-04-20', false)
        .then(function(snapshots) {
          // 2014-05-05 is the last day that all sample item in kanbanItems.json
          // having the latest update.  That means snapshots after 2014-05-05
          // for those items should be the same as that day and should be used
          // for accumulation.
          var laterDate = '2014-05-07',
              newItem = [{
                'objectID': 12547,
                'type': 'Story',
                'owner': 'Ken',
                'statusChangeLog': [{
                  'from': '2014-05-07T08:21:10.578Z',
                  'to': '2014-05-08T08:21:10.578Z',
                  'status': 'Prioritized'
                },
                {
                  'from': '2014-05-08T08:21:10.578Z',
                  'to': '2014-05-09T08:21:10.578Z',
                  'status': 'In Dev'
                }],
                'kanbanizedOn': '2014-04-28T08:21:10.578Z'
              }],
              newItemSnapshots = storage.convertItemDetailToSnapshot(newItem, laterDate);

              function getSnapshotOn(snapshots) {
                var result = snapshots.filter(function(snapshot) {
                  var snapshotDate =
                    DateUtil.getDate(snapshot.date).format('YYYY-MM-DD');
                  if (snapshotDate === laterDate) {
                    return true;
                  }
                  return false;
                });
                return result;
              }

              storage.initHistoricalData(newItem, laterDate, false)
                .then(function(allSnapshots) {

                  expect(getSnapshotOn(allSnapshots).length).to.equal(
                    getSnapshotOn(snapshots).length +
                    getSnapshotOn(newItemSnapshots).length);

                  done();
                  return null;
                });
      })
      .catch(done);
    });
  });
});
