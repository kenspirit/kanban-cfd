/* global moment */

angular.module('Kanban.service', ['Kanban.config', 'ngResource'])
  .factory('UnitConverter', function() {
    return {
      inDay: function(durationInHour) {
        return (durationInHour / 24.0).toFixed(1);
      }
    };
  })
  .factory('QueryBuilder', ['SYS_CONFIG', function(SYS_CONFIG) {
    return {
      getQueryParam: function($scope) {
        function getDateParam(date) {
          return moment(date).format(SYS_CONFIG.dateFormat);
        }

        var ownerIds = _.reduce($scope.owners, function(ids, owner) {
          if (owner.selected) {
            ids.push(owner.id);
          }

          return ids;
        }, []);

        return {
          startDate: getDateParam($scope.startDate),
          endDate: getDateParam($scope.endDate),
          owners: ownerIds
        };
      }
    };
  }])
  .factory('SnapshotService', ['SYS_CONFIG', '$resource',
      function(SYS_CONFIG, $resource) {
    function getSnapshotDate(snapshot) {
      return moment.utc(snapshot.date).format('YYYY-MM-DD');
    }

    function getSnapshotDatesFromSnapshot(snapshots) {
      var snapshotDates = [];

      snapshots.forEach(function(snapshot) {
        var date = getSnapshotDate(snapshot);

        if (snapshotDates.indexOf(date) < 0) {
          snapshotDates.push(date);
        }
      });

      snapshotDates.sort();
      return snapshotDates;
    }

    /**
     * @snapshotDates date in array must be in asc order
     */
    function buildSnapshotSeriesByDate(snapshotDates, snapshots) {
      // cfdSeries format:
      //
      // {
      //   2015-01-12: {
      //     Accepted: 4
      //     Design: 0
      //     In Dev: 1
      //     In Test: 0
      //     Prioritized: 0
      //     Ready for Test: 4
      //     Req: 0
      //   }
      // }
      var seriesByDate = {};

      // Initialize each date's status figure
      snapshotDates.forEach(function(date) {
        seriesByDate[date] = {};

        SYS_CONFIG.kanbanStatusNames.forEach(function(status) {
          seriesByDate[date][status] = 0;
        });
      });

      // Assign each date's status figure based on snapshots
      snapshots.forEach(function(snapshot) {
        var date = getSnapshotDate(snapshot);
        seriesByDate[date][snapshot.status]++;
      });

      return seriesByDate;
    }



    var SnapshotService =
      $resource('/snapshot', {}, {'load':  {method:'GET', isArray: false}});

    return {
      getSnapshotDatesFromSnapshot: getSnapshotDatesFromSnapshot,
      buildSnapshotSeriesByDate: buildSnapshotSeriesByDate,
      getSnapshotDate: getSnapshotDate,
      loadSnaptshots: function(query) {
        return SnapshotService.load(query).$promise
          .then(function(response) {
            return response.result;
          });
      },
      filterSnapshot: function(snapshots, owner, itemTypes) {
        return snapshots.filter(function(snapshot) {
          return (owner === 'ALL' || snapshot.owner == owner)
            && itemTypes.indexOf(snapshot.type) > -1;
        });
      }
    };
  }])
  .factory('ItemDetailService', ['SYS_CONFIG', '$resource',
      function(SYS_CONFIG, $resource) {
    // Last Kanban status doesn't need to show
    var kanbanStatusInAscOrder = SYS_CONFIG.kanbanStatusNames.slice(1).reverse();

    function calculateItemKanbanStatusDuration(item) {
      var result = {
        name: item.name,
        type: item.type,
        owner: item.owner,
        blockLog: item.blockLog,
        estimate: item.estimate,
        statusDuration: [], // In hours
        totalDuration: 0 // In hours
      };

      for (var i = 0; i < kanbanStatusInAscOrder.length; i++) {
        result.statusDuration[i] = 0;
      }
      var today = moment.utc();

      item.statusChangeLog.forEach(function(log) {
        var statusIdx = kanbanStatusInAscOrder.indexOf(log.status);
        if (statusIdx === -1) {
          // Should be the last Kanban status that no need to capture duration
          return;
        }

        var diff = result.statusDuration[statusIdx],
            from = moment.utc(log.from),
            to = moment.utc(log.to),
            weekendCount = 0;

        if (today.isBefore(to, 'day')) {
          to = today;
        }
        diff += to.diff(from, 'hours');

        while (to.diff(from, 'days') > 0) {
          var weekDay = from.day();

          if (SYS_CONFIG.ignoreWeekend && (weekDay === 0 || weekDay === 6)) {
            weekendCount++;
          }
          from = from.add('days', 1);
        }

        result.statusDuration[statusIdx] = diff - (weekendCount * 24);
        if (result.statusDuration[statusIdx] < 0) {
          result.statusDuration[statusIdx] = 0;
        }
      });

      _.forEach(result.blockLog, function(value, status) {
        // Convert to hours unit
        result.blockLog[status][0] = parseInt(
          result.blockLog[status][0] / (3600 * 1000));
      });

      result.totalDuration =
        result.statusDuration.reduce(function(sum, i) {return sum + i;}, 0);

      return result;
    }

    var ItemService =
      $resource('/itemDetail', {}, {'load':  {method:'GET', isArray: false}});

    return {
      loadItems: function(query) {
        return ItemService.load(query).$promise
          .then(function(response) {
            return response.result
              .reduce(function(all, item) {
                all.push(calculateItemKanbanStatusDuration(item));
                return all;
              }, []);
          });
      },
      getItemDetailStatusList: function() {
        return kanbanStatusInAscOrder;
      },
      filterItem: function(items, owner, itemTypes) {
        return items.filter(function(item) {
          return (owner === 'ALL' || item.owner == owner)
            && itemTypes.indexOf(item.type) > -1;
        });
      }
    };
  }]);
