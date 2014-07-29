var Promise = require('bluebird'),
    _ = require('underscore'),
    moment =require('moment-range'),
    config = require('./config'),
    Datastore = require('nedb'),
    DateUtil = require('./dateUtil').DateUtil;

Promise.longStackTraces();
Promise.onPossiblyUnhandledRejection(function(e/*, promise*/){ throw e; });

function constructDateCriteria(dateFieldName, value, operator) {
  var dateCriteria = {};
  dateCriteria[dateFieldName] = {};
  dateCriteria[dateFieldName][operator] = DateUtil.getDate(value).toDate();
  return dateCriteria;
}

function constructCriteria(query, dateFieldName) {

  var criteria = [];
  if (!query) {
    return criteria;
  }

  if (query.objectID) {
    criteria.push({objectID: {$in: [].concat(query.objectID)}});
  }
  if (query.owner) {
    criteria.push({owner: query.owner});
  }
  if (query.startDate) {
    criteria.push(constructDateCriteria(dateFieldName, query.startDate, '$gte'));
  }
  if (query.endDate) {
    criteria.push(constructDateCriteria(
      dateFieldName, DateUtil.getDate(query.endDate).add(1, 'days'), '$lt'));
  }

  return criteria;
}

function getData(query, dateFieldName, dbMethod) {
  var criteria = constructCriteria(query, dateFieldName);

  if (criteria.length === 0) {
    return dbMethod({});
  }

  return dbMethod({$and: criteria});
}

function KanbanStorage(dataFileLocation) {
  var dataFileLoc = dataFileLocation || config.dataFileLocation || './data/',
      itemStore = new Datastore({ filename: dataFileLoc + 'kanbanItems.json', autoload: true }),
      snapshotStore = new Datastore({ filename: dataFileLoc + 'snapshot.json', autoload: true });

  var snapshotInsert = Promise.promisify(snapshotStore.insert, snapshotStore),
      snapshotFind = Promise.promisify(snapshotStore.find, snapshotStore),
      snapshotRemove = Promise.promisify(snapshotStore.remove, snapshotStore),
      itemRemove = Promise.promisify(itemStore.remove, itemStore),
      itemInsert = Promise.promisify(itemStore.insert, itemStore),
      itemFind = Promise.promisify(itemStore.find, itemStore),
      itemUpdate = Promise.promisify(itemStore.update, itemStore);

  this.sortItemStatusChangeLog = function(item) {
    function comparator(a, b) {
      if (a.from < b.from) {
        return -1;
      } else if (a.from > b.from) {
        return 1;
      } else {
        return 0;
      }
    }

    return (!item || !item.statusChangeLog) ?
      [] : item.statusChangeLog.sort(comparator);
  };

  this.saveItems = itemInsert;

  this.getItems = function(query) {
    return getData(query, 'kanbanizedOn', itemFind);
  };

  /*
  The expected input is an array containing object with below structure
  {
    objectID:
    name: ,
    type: ,
    owner: ,
    statusChangeLog: [{
      from: ,
      to: ,
      status:
    }],
    kanbanizedOn:
  }
  */
  this.updateItems = function(kanbanItems) {
    var allUpdated = kanbanItems.map(function(item) {
      return itemUpdate({objectID: item.objectID},
          {$addToSet: {statusChangeLog: {$each: item.statusChangeLog}}},
          {$set: {
              owner: item.owner,
              name: item.name
            }
          }
        );
    });

    return Promise.all(allUpdated)
      .then(function(updatedItemCnt) {
        return updatedItemCnt.reduce(function(all, cnt) {
            return all + cnt;
          }, 0);
      });
  };

  this.removeItems = itemRemove;

  this.getSnapshot = function(query) {
    return getData(query, 'date', snapshotFind);
  };

  /**
  The expected input is an array containing object with below structure.
  This data is purely for snapshot construction and so no item specific data like name.
  It should be called daily to capture kanban item status for faster snapshot rendering.

  {
    objectID: ,
    type: '',
    owner: '',
    status: '',
    date:
  }
  */
  this.saveSnapshot = function(snapshotItems) {
    return snapshotInsert(snapshotItems);
  };

  this.removeSnapshot = snapshotRemove;

  this.convertItemDetailToSnapshot = function(kanbanItems, startDate) {
    var start = DateUtil.getDate(startDate),
        end = DateUtil.getDate(),
        nextDay = start.clone().add('days', 1),
        oneDay = moment().range(start, nextDay),
        range = moment().range(start, end),
        snapshotItems = [],
        that = this;

    range.by(oneDay, function(day) {
      var eachDay = day.utc();

      if (config.ignoreWeekend) {
        var weekDay = eachDay.day();

        if (weekDay === 0 || weekDay === 6) {
          return; // Not storing for weekend
        }
      }

      kanbanItems.forEach(function(item) {
        var statusLog = that.sortItemStatusChangeLog(item);
        var status = '';

        for (var i = 0; i < statusLog.length; i++) {
          var log = statusLog[i];
          var from = DateUtil.getDate(log.from);

          if (eachDay.isBefore(from, 'day')) {
            break;
          }

          status = log.status; // Take latest log's status
        }

        if (status) {
          snapshotItems.push({
            objectID: item.objectID,
            type: item.type,
            owner: item.owner,
            status: status,
            date: eachDay.toDate()
          });
        }
      });
    });

    return snapshotItems;
  };

  /**
  The expected input is an array containing object with below structure
  {
    objectID: ,
    type: ,
    name: ,
    owner: ,
    statusChangeLog: [{
      from: , // expected format is '2014-01-27T02:17:13.527Z'
      to: ,
      status:
    }],
    kanbanizedOn:
  }
  */
  this.initHistoricalData = function(kanbanItems, startDate, needItemDetailGraph) {

    function extractItemID(item) {
      return item.objectID;
    }

    function getItemIds(items) {
      var ids = [];
      items.forEach(function(item) {
        var id = extractItemID(item);
        if (ids.indexOf(id) === -1) {
          ids.push(id);
        }
      });

      return ids;
    }

    function filterItemsByID(itemIDs, item) {
      return itemIDs.indexOf(extractItemID(item)) > -1;
    }

    var snapshots = this.convertItemDetailToSnapshot(kanbanItems, startDate),
        allItemIDs = getItemIds(kanbanItems),
        that = this,
        criteria = constructCriteria({startDate: startDate}, 'date');

    var snapshotPromise = this.removeSnapshot({$and: criteria}, {multi: true})
      .then(function() {
        var resolver = Promise.defer();

        snapshotStore.findOne({}).sort({date: -1}).exec(
          function(err, latestSnapshot) {
            if (err) {
              resolver.reject(err);
            } else {
              resolver.resolve(latestSnapshot || null);
            }
          });

        return resolver.promise;
      })
      .then(function(latestSnapshot) {
        if (latestSnapshot !== null) {
          return that.getSnapshot({startDate: latestSnapshot.date});
        } else {
          // No any data in DB
          return [];
        }
      })
      .then(function(snapshotToCumulate) {
        var snapshotByDate = snapshots.reduce(function(grouping, snapshot) {
          var date = moment(snapshot.date).format(config.dateFormat);

          if (!grouping[date]) {
            grouping[date] = [];
          }
          grouping[date].push(snapshot);

          return grouping;
        }, {});

        _.keys(snapshotByDate).sort().forEach(function(date) {
          var snapshotPerDay = snapshotByDate[date],
              remainedCumulate = [];

          function isSameObjectID(s1, s2) {
            return s1.objectID == s2.objectID;
          }

          for (var i = snapshotToCumulate.length - 1; i >= 0; i--) {
            var cumulate = snapshotToCumulate[i],
                existed = snapshotPerDay.some(
                  isSameObjectID.bind(this, cumulate));

            if (!existed) {
              cumulate = _.clone(cumulate);
              cumulate.date = DateUtil.getDate(date).toDate();
              delete cumulate._id;

              remainedCumulate.push(cumulate);
              snapshotPerDay.push(cumulate);
            }
          }

          snapshotToCumulate = remainedCumulate;
        });

        var allSnapshots = _.values(snapshotByDate).reduce(
          function(allSnapshots, snapshotPerDay) {
            return allSnapshots.concat(snapshotPerDay);
          }, []);

        return that.saveSnapshot(allSnapshots);
      });

    if (!needItemDetailGraph) {
      return snapshotPromise;
    }

    return itemFind({objectID: {$in: allItemIDs}})
      .then(function(items) {
        var existedItemIDs = getItemIds(items || []);
        var newItemIDs = _.difference(allItemIDs, existedItemIDs);

        var existedItems = _.filter(kanbanItems,
          filterItemsByID.bind(this, existedItemIDs));
        var newItems = _.filter(kanbanItems,
          filterItemsByID.bind(this, newItemIDs));

        return Promise
          .all([
            that.updateItems(existedItems),
            itemInsert(newItems),
            snapshotPromise
          ])
          .spread(function(updatedItemCnt, newItems, snapshots) {
            return {
              updatedItemCnt: updatedItemCnt,
              newItems: newItems,
              snapshots: snapshots
            };
          });
      });
  };
}


module.exports = KanbanStorage;
