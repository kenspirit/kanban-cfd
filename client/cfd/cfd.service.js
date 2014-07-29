/* global moment */

angular.module('Kanban.service', ['Kanban.config', 'ngResource'])
  .factory('QueryBuilder', ['SYS_CONFIG', function(SYS_CONFIG) {
    return {
      getQueryParam: function($scope) {
        function getDateParam(date) {
          return moment(date).format(SYS_CONFIG.dateFormat);
        }

        return {
          startDate: getDateParam($scope.startDate),
          endDate: getDateParam($scope.endDate)
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

    function processSnapshots(snapshots, cb) {
      var snapshotDates = getSnapshotDatesFromSnapshot(snapshots),
          series = buildSnapshotSeriesByDate(snapshotDates, snapshots);

      cb(snapshots, snapshotDates, series);
    }

    var SnapshotService =
      $resource('/snapshot', {}, {'load':  {method:'GET', isArray: false}});

    return {
      getSnapshotDatesFromSnapshot: getSnapshotDatesFromSnapshot,
      buildSnapshotSeriesByDate: buildSnapshotSeriesByDate,
      processSnapshots: processSnapshots,
      loadAndProcessSnapshots: function(query, cb) {
        SnapshotService.load(query, function(response) {
          processSnapshots(response.result, cb);
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

      result.totalDuration =
        result.statusDuration.reduce(function(sum, i) {return sum + i;}, 0);

      return result;
    }

    var ItemService =
      $resource('/itemDetail', {}, {'load':  {method:'GET', isArray: false}});

    return {
      loadItemDetail: function(query, cb) {
        ItemService.load(query, function(response) {
          var items = response.result
            .reduce(function(all, item) {
              all.push(calculateItemKanbanStatusDuration(item));
              return all;
            }, []);

          cb(items);
        });
      },
      getItemDetailStatusList: function() {
        return kanbanStatusInAscOrder;
      }
    };
  }]);
