var Promise = require('bluebird'),
    rest = require('restler'),
    _ = require('underscore'),
    config = require('../config'),
    DateUtil = require('../dateUtil').DateUtil;

// Rally config
var rallyUser = '';
var rallyPassword = '';
var lookbackPageSize = 2000;
var wsPageSize = 100; // Max is 100
var workspace = 0;
var project = 0;
var kanbanFieldName = 'c_KanbanState';
// https://rally1.rallydev.com/slm/webservice/v2.0/user?query=(UserName = userName)&fetch=ObjectID

function getRallyAuthHeader() {
  var headers = {'Authorization': 'Basic ' +
    new Buffer(rallyUser + ':' + rallyPassword).toString('base64')};
  return headers;
}

function resolveRestResult(resolver, result, response) {
  var isSuccess = true,
      errMsg = '';

  if (result instanceof Error) {
    errMsg = result.valueOf();
    isSuccess = false;
  } else {
    if (result.error) {
      isSuccess = false;
      errMsg = result.error.valueOf();
    } else if (response.statusCode >= 400) {
      var msg = result.toString();
      if (typeof result === 'object') {
        msg = JSON.stringify(result);
      }

      isSuccess = false;
      errMsg = 'HTTP status: ' + response.statusCode +
        ' Msg: ' + msg;
    }
  }

  if (isSuccess) {
    resolver.resolve(JSON.parse(result));
  } else {
    resolver.reject(errMsg);
  }
}

function restPromise(url, options) {
  var resolver = Promise.defer();
  rest.request(url, options || {})
    .on('complete', resolveRestResult.bind(this, resolver));

  return resolver.promise;
}

var KanbanProvider = {
  rallyDailyItemStatus: function(itemType, startCount, allResult) {

    function buildInQuery(keyName, items) {
      return items.reduce(function(query, curValue) {
        var subQuery = '(' + keyName + ' = "' + curValue + '")';
        if (query === '') {
          return subQuery;
        } else {
          return '(' + subQuery + ' OR ' + query + ')';
        }
      }, '');
    }

    var idx = startCount || 1;
    var result = allResult || [];

    var url =
      'https://rally1.rallydev.com/slm/webservice/v2.0/' + itemType;
    var userSubquery = buildInQuery('Owner.Name', _.values(config.owners));
    var kanbanSubQuery = buildInQuery(kanbanFieldName, config.kanbanStatusNames);

    url += '?query=(' + userSubquery + ' AND ' + kanbanSubQuery +
      ')&order=Name&fetch=_type,Name,Owner,ObjectID,FormattedID,' + kanbanFieldName +
      '&pagesize=' + wsPageSize + '&start=' + idx;

    return restPromise(url, {headers: getRallyAuthHeader()})
      .bind(this)
      .then(function(rallyResponse) {
        result = result.concat(rallyResponse.QueryResult.Results);

        if (rallyResponse.QueryResult.Results.length === 0 ||
            result.length < rallyResponse.QueryResult.TotalResultCount) {
          // Recursively call itself to get all snapshot
          return this.rallyDailyItemStatus(itemType, result.length + 1, result);
        } else {
          return result;
        }
      });
  },
  itemSnapshotNow: function() {
    var now = DateUtil.getDate().toDate();

    function convertFormat(rallyItem) {
      var ownerRef = !rallyItem.Owner ? '' : rallyItem.Owner._ref;

      return {
        objectID: rallyItem.ObjectID,
        type: rallyItem._type,
        owner: ownerRef.substring(ownerRef.lastIndexOf('/') + 1),
        status: rallyItem[kanbanFieldName],
        date: now,
        name: rallyItem.FormattedID + ': ' + rallyItem.Name
      };
    }

    var allItems = _.keys(config.kanbanItemTypes).map(this.rallyDailyItemStatus, this);

    return Promise.all(allItems)
      .then(function(result) {
        return result.reduce(function(all, items) {
          return all.concat(items.map(convertFormat));
        }, []);
      });
  },
  getHistoricalKanbanStatus: function(startDate) {
    return this.getRallySnapshot(startDate)
      .then(function(snapshots) {
        var itemStatus = {
          // objectID: {
          //   objectID: ,
          //   type: ,
          //   name: ,
          //   owner: ,
          //   statusChangeLog: [{
          //     from: ,
          //     to: ,
          //     status:
          //   }],
          //   blockLog: [{
          //      blocked: ,
          //      stage: ,
          //      time: ,
          //      reason:
          //   }],
          //   kanbanizedOn: // earliest time put to Kanban
          // }
        };

        snapshots.forEach(function(snapshot) {
          // {
          //     'Name': 'Story name',
          //     'ObjectID': 0,
          //     'Owner': 0,
          //     '_ValidFrom': '2014-01-27T02:17:13.527Z',
          //     '_ValidTo': '2014-01-27T02:17:54.245Z',
          //     'c_KanbanState': 'In Test',
          //     "_TypeHierarchy": [
          //       "PersistableObject",
          //       "DomainObject",
          //       "WorkspaceDomainObject",
          //       "Artifact",
          //       "Defect",
          //       "Defect"
          //     ],
          // }
          var item = itemStatus[snapshot.ObjectID];

          if (!item) {
            itemStatus[snapshot.ObjectID] = {
              objectID: snapshot.ObjectID,
              type: snapshot._TypeHierarchy[snapshot._TypeHierarchy.length - 1],
              statusChangeLog: []
            };
            item = itemStatus[snapshot.ObjectID];
            item.blockLog = [];
          }

          item.owner = snapshot.Owner;
          item.name = snapshot.FormattedID + ': ' + snapshot.Name;
          item.statusChangeLog.push({
            from: snapshot._ValidFrom,
            to: snapshot._ValidTo,
            status: snapshot.c_KanbanState
          });

          if (item.blockLog.length === 0 || item.blockLog[item.blockLog.length - 1].blocked != snapshot.Blocked) {
            item.blockLog.push({
              blocked: snapshot.Blocked,
              stage: snapshot.c_KanbanState,
              time: snapshot._ValidFrom,
              reason: snapshot.BlockedReason
            });
          } else {
            item.blockLog[item.blockLog.length - 1].reason = snapshot.BlockedReason;
          }

          if (!item.kanbanizedOn || item.kanbanizedOn < snapshot._ValidFrom) {
            item.kanbanizedOn = DateUtil.getDate(snapshot._ValidFrom).toDate();
          }
        });

        return _.values(itemStatus);
      });
  },
  getRallySnapshot: function(startDate, startCount, allResult) {
    var start = DateUtil.getDate(startDate),
        idx = startCount || 0,
        result = allResult || [],
        dataUrl =
          'https://rally1.rallydev.com/analytics/v2.0/service/rally/workspace/' +
          workspace + '/artifact/snapshot/query.js';

    var findObj = {};
    findObj[kanbanFieldName] = {'$in': config.kanbanStatusNames};
    findObj._ProjectHierarchy  = project;
    findObj._ValidFrom = {'$gte': start.toISOString()};

    var fields = ['_ValidFrom', '_ValidTo', 'ObjectID', '_TypeHierarchy',
      'Name', 'Owner', 'FormattedID', 'Blocked', 'BlockedReason', kanbanFieldName],
        hydrate = ['_TypeHierarchy'];

    return restPromise(dataUrl + '?find=' + JSON.stringify(findObj) +
          '&fields=' + JSON.stringify(fields) +
          '&hydrate=' + JSON.stringify(hydrate) +
          '&pagesize=' + lookbackPageSize +
          '&start=' + idx, {headers: getRallyAuthHeader()})
      .bind(this)
      .then(function(rallyResponse) {
        result = result.concat(rallyResponse.Results);

        if (result.length < rallyResponse.TotalResultCount) {
          // Recursively call itself to get all snapshot
          return this.getRallySnapshot(start, result.length, result);
        } else {
          return result;
        }
      });
  }
};

module.exports = KanbanProvider;
