/* global _, moment, io */

var app = angular.module('Kanban', ['ngResource', 'ui.bootstrap',
  // 'googlechart', 'nvd3',
  'nvd3ChartDirectives', 'Kanban.config', 'Kanban.service', 'Kanban.chart']);

app.controller('KanbanCtrl', ['$scope', 'SYS_CONFIG',
  'ItemDetailService', 'SnapshotService', 'QueryBuilder', '$q', '$resource',
    function($scope, SYS_CONFIG, ItemDetailService, SnapshotService, QueryBuilder, $q,
      $resource) {

  $scope.dateFormat = 'yyyy-MM-dd';
  $scope.calendarStatus = {};
  $scope.dateOptions = {};
  $scope.startDate = moment().subtract(1, 'months').toDate();
  $scope.endDate = moment().toDate();

  $scope.graph = {
    cfd: [],
    leadtime: [],
    blocked: []
  };
  $scope.showByOwner = false;

  $scope.kanbanItems = [];
  $scope.snapshots = [];

  $scope.owners = [{id: 'ALL', name: 'ALL', selected: true}].concat(
    _.map(SYS_CONFIG.owners, function(ownerName, ownerId) {
      return {
        id: ownerId,
        name: ownerName,
        selected: true
      };

      return result;
    }));

  _.forEach($scope.owners, function(owner, i) {
    $scope.graph.cfd[i] = true;
    $scope.graph.leadtime[i] = true;
    $scope.graph.blocked[i] = true;

    owner.active = i === 0;
  });

  $scope.itemTypes = _.keys(SYS_CONFIG.kanbanItemTypes)
    .map(function(type) {
      return {
        id: type,
        name: SYS_CONFIG.kanbanItemTypes[type],
        selected: true
      };
    });

  $scope.itemStatus = ItemDetailService.getItemDetailStatusList();

  $scope.openCalendar = function($event, field) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.calendarStatus[field] = true;
  };

  $scope.initHistoricalData = function() {
    var HistoricalDataService = $resource('/initHistoricalData', {},
      {'init':  {method:'POST', isArray: false}});

    HistoricalDataService.init(QueryBuilder.getQueryParam($scope),
      function() {
        $scope.reloadData();
      });
  };

  $scope.isTabShown = function(owner) {
    var isShown = owner.selected;
    if (isShown && owner.id !== 'ALL') {
      isShown = isShown && $scope.showByOwner;
    }
    return isShown;
  };

  $scope.getSelected = function(items) {
    return _.reduce(items, function(ids, item) {
      if (item.selected) {
        ids.push(item.id);
      }
      return ids;
    }, []);
  }

  $scope.$watch('owners', function(newValue, oldValue) {
    // Change detected to prevent unexpected change for initial loading time
    // And the change on 'open' attribute which is not needed for refreshing data
    var selectedOwner = null;

    if (newValue.length === oldValue.length) {
      selectedOwner = _.find(newValue, function(owner, index) {
        return owner.selected !== oldValue[index].selected
          && owner.selected;
      });

      if (selectedOwner && (selectedOwner.id !== 'ALL' || !$scope.showByOwner)) {
        selectedOwner = null;
      }
    }

    if (selectedOwner != null) {
      // Only refresh data for the changed & shown owner
      $scope.$broadcast('refresh', selectedOwner.id, $scope.getSelected($scope.itemTypes));
    }
  }, true);

  $scope.$watch('itemTypes', function(newValue/*, oldValue*/) {
    $scope.$broadcast('refresh', null, $scope.getSelected(newValue));
  }, true);

  $scope.reloadData = function() {
    var params = QueryBuilder.getQueryParam($scope);

    var itemPromise = ItemDetailService.loadItems(params),
        snapshotsPromise = SnapshotService.loadSnaptshots(params);

    $q.all([itemPromise, snapshotsPromise])
      .then(function(result) {
        $scope.kanbanItems = result[0];
        $scope.snapshots = result[1];

        $scope.$broadcast('refresh', null, $scope.getSelected($scope.itemTypes));
      });
  };

  $scope.reloadData();

  // var socket = io.connect('/');

  // socket.on('dailyUpdate', function (result) {
  //   $scope.snapshots.push.apply($scope.snapshots, result.snapshots);

  //   $scope.$broadcast('refresh', null, $scope.getSelected($scope.itemTypes));
  // });
}])
.controller('CumulativeFlowDiagramCtrl', ['$scope', 'SYS_CONFIG',
    'QueryBuilder', 'SnapshotService', 'Nvd3ChartBuilder',
   function($scope, SYS_CONFIG, QueryBuilder, SnapshotService, Nvd3ChartBuilder) {

  $scope.ownerId = null;

  Nvd3ChartBuilder.initCFDChartData($scope);

  function refreshCFDGraph($event, ownerId, itemTypes) {
    if (ownerId !== null && ownerId != $scope.ownerId) {
      return;
    }

    $scope.itemTypeCount = _.reduce(itemTypes, function(itemTypeCount, type) {
      var name = _.result(_.find($scope.itemTypes, {id: type}), 'name');

      itemTypeCount[type] = {
        name: name,
        startCount: 0,
        endCount: 0
      };

      return itemTypeCount;
    }, {});

    var retainedSnapshots = SnapshotService.filterSnapshot($scope.snapshots,
      $scope.ownerId, itemTypes);
    retainedSnapshots = _.sortBy(retainedSnapshots, 'date');

    var snapshotsDates = SnapshotService.getSnapshotDatesFromSnapshot(retainedSnapshots);

    if (snapshotsDates.length > 0) {
      var startDate = snapshotsDates[0],
          endDate = snapshotsDates[snapshotsDates.length - 1];

      _.forEach($scope.itemTypeCount, function(type) {
        type.startCount = 0;
        type.endCount = 0;
      });

      for (var i = 0; i < retainedSnapshots.length; i++) {
        var snapshot = retainedSnapshots[i],
            snapshotDate = SnapshotService.getSnapshotDate(snapshot);
        if (snapshotDate !== startDate) {
          break;
        }
        $scope.itemTypeCount[snapshot.type].startCount++;
      }

      for (var i = retainedSnapshots.length - 1; i > -1; i--) {
        var snapshot = retainedSnapshots[i],
            snapshotDate = SnapshotService.getSnapshotDate(snapshot);
        if (snapshotDate !== endDate) {
          break;
        }
        $scope.itemTypeCount[snapshot.type].endCount++;
      }
    }

    Nvd3ChartBuilder.loadCFDChartData($scope,
      SnapshotService.buildSnapshotSeriesByDate(snapshotsDates, retainedSnapshots));
  }

  $scope.$on('refresh', refreshCFDGraph);
}])
.controller('LeadTimeCtrl', ['$scope', 'SYS_CONFIG', 'ItemDetailService', 'Nvd3ChartBuilder',
    'UnitConverter',
  function($scope, SYS_CONFIG, ItemDetailService, Nvd3ChartBuilder, UnitConverter) {

  $scope.leadTimeDuration = SYS_CONFIG.defaultLeadTimeDuration;
  $scope.fromStatus = SYS_CONFIG.defaultLeadTimeStartStatus;
  $scope.toStatus = SYS_CONFIG.defaultLeadTimeEndStatus;
  $scope.ownerId = null;
  $scope.totalTime = 0;
  $scope.medianLeadTime = 0;
  $scope.meanLeadTime = 0;

  $scope.$on('refresh', function($event, ownerId, itemTypes) {
    $scope.refreshLeadTimeGraph(ownerId, itemTypes);
  });

  $scope.$watch('fromStatus', function(newValue/*, oldValue*/) {
    $scope.refreshLeadTimeGraph($scope.ownerId, $scope.getSelected($scope.itemTypes));
  }, true);

  $scope.$watch('toStatus', function(newValue/*, oldValue*/) {
    $scope.refreshLeadTimeGraph($scope.ownerId, $scope.getSelected($scope.itemTypes));
  }, true);

  Nvd3ChartBuilder.initLeadTimeChartData($scope);

  $scope.onLeadTimeDurationChange = function() {
    if (!$scope.leadTimeDuration) {
      return; // When the value is removed from input field
    }

    $scope.refreshLeadTimeGraph(
      $scope.ownerId, $scope.getSelected($scope.itemTypes))
  }

  $scope.refreshLeadTimeGraph = function(ownerId, itemTypes) {
    if (ownerId !== null && ownerId !== $scope.ownerId) {
      // If not refreshing all or selected owner's tab
      return;
    }

    var fromStatusIdx = $scope.itemStatus.indexOf($scope.fromStatus),
        toStatusIdx = $scope.itemStatus.indexOf($scope.toStatus),
        statusList = [];

    if (fromStatusIdx > toStatusIdx) {
      var tmp = fromStatusIdx;
      toStatusIdx = fromStatusIdx;
      fromStatusIdx = toStatusIdx;
    }

    function filterStatus(fromStatusIdx, toStatusIdx) {
      return _.filter($scope.itemStatus, function(status, index) {
        return fromStatusIdx <= index && index <= toStatusIdx;
      });
    }

    statusList = filterStatus(fromStatusIdx, toStatusIdx);

    function filterItemStatus(fromStatusIdx, toStatusIdx, items) {
      return _.reduce(items, function(retainedItems, item) {
        if (_.isEmpty(item.statusDuration)) {
          return retainedItems;
        }

        var cloneItem = {
          name: item.name,
          estimate: item.estimate,
          statusDuration: [],
          totalDuration: 0,
          blockedDuration: 0,
          blockLog: {}
        };

        _.forEach(item.blockLog, function(log, status) {
          if (statusList.indexOf(status) > -1) {
            cloneItem.blockLog[status] = log;
            cloneItem.blockedDuration += log[0];
          }
        });

        _.forEach(item.statusDuration, function(duration, index) {
          if (index >= fromStatusIdx && index <= toStatusIdx) {
            cloneItem.statusDuration.push(duration);
            cloneItem.totalDuration += duration;
          }
        });

        retainedItems.push(cloneItem);

        return retainedItems;
      }, []);
    }

    function filterItemByDuration(items) {
      return _.filter(items, function(item) {
        return item.totalDuration >= $scope.leadTimeDuration * 24;
      });
    }

    function itemDetailComparator(item1, item2) {
      return item2.totalDuration - item1.totalDuration; // sort desc
    }

    var itemsRetained = ItemDetailService.filterItem($scope.kanbanItems,
      $scope.ownerId, itemTypes);

    itemsRetained = filterItemStatus(fromStatusIdx, toStatusIdx, itemsRetained);

    if (!_.isEmpty(itemsRetained)) {
      var totalDuration = _.pluck(itemsRetained, 'totalDuration');

      $scope.totalTime = UnitConverter.inDay(
        _.reduce(totalDuration, function(sum, n) {return sum + n;})
      );
      $scope.meanLeadTime = UnitConverter.inDay(math.mean(totalDuration));
      $scope.medianLeadTime = UnitConverter.inDay(math.median(totalDuration));
    } else {
      $scope.totalTime = 0;
      $scope.meanLeadTime = 0;
      $scope.medianLeadTime = 0;
    }

    // filtering by duration must be after mean & median calculation
    itemsRetained = filterItemByDuration(itemsRetained)
      .sort(itemDetailComparator);

    Nvd3ChartBuilder.getLeadTimeChartData($scope, statusList, itemsRetained);

    var leadTimeEstimateData = [
       {
         'key': 'Estimate',
         'values': []
       },
       {
         'key': 'Lead Time',
         'values': []
       },
       {
         'key': 'Lead Time w/o Block',
         'values': []
       }
     ];

     var sortedItems = _.sortBy(itemsRetained, function(item) {
       return item.totalDuration;
     });

     _.forEach(sortedItems, function(item, index) {
       var itemId = index, name = item.name;

       leadTimeEstimateData[0].values.push([itemId, item.estimate, name]);
       leadTimeEstimateData[1].values.push(
         [itemId, item.totalDuration / 24.0, name]);
       leadTimeEstimateData[2].values.push(
         [itemId, (item.totalDuration - item.blockedDuration) / 24.0, name]);
     });

     $scope.leadTimeEstimateData = leadTimeEstimateData;
  };

}])
.controller('BlockedStatisticsCtrl', ['$scope', 'SYS_CONFIG', 'Nvd3ChartBuilder',
  'ItemDetailService',
    function($scope, SYS_CONFIG, Nvd3ChartBuilder, ItemDetailService) {

  $scope.ownerId = null;
  $scope.blockedDuration = SYS_CONFIG.defaultBlockedDuration;

  Nvd3ChartBuilder.initBlockedStatisticsChartData($scope);

  $scope.$on('refresh', function($event, ownerId, itemTypes) {
    $scope.refreshBlockedStatisticsGraph(ownerId, itemTypes);
  });

  $scope.onBlockedDurationChange = function() {
    if (!$scope.blockedDuration) {
      return; // When the value is removed from input field
    }

    $scope.refreshBlockedStatisticsGraph(
      $scope.ownerId, $scope.getSelected($scope.itemTypes))
  }

  $scope.refreshBlockedStatisticsGraph = function(ownerId, itemTypes) {
    if (ownerId !== null && ownerId !== $scope.ownerId) {
      // If not refreshing all or selected owner's tab
      return;
    }

    function filterItemBlockLogByStatusAndDuration(items, statusNames, duration) {
      return items.reduce(function(retainedItems, item) {
        if (_.isEmpty(item.blockLog)) {
          return retainedItems;
        }

        var cloneItem = {
          name: item.name,
          blockLog: {}
        };

        _.forEach(statusNames, function(status) {
          var blockedDuration = 0, reason;

          if (item.blockLog[status]) {
            // In Days
            blockedDuration = item.blockLog[status][0] / 24.0;
            reason = item.blockLog[status][1];

            if (blockedDuration > duration) {
              cloneItem.blockLog[status] = [
                blockedDuration,
                reason ? reason : 'None'
              ];
            }
          }
        });

        if (_.isEmpty(cloneItem.blockLog)) {
          return retainedItems;
        }
        retainedItems.push(cloneItem);

        return retainedItems;
      }, []);
    }

    var itemsRetained = ItemDetailService.filterItem($scope.kanbanItems,
      $scope.ownerId, itemTypes);

    // Item is cloned with filtered log
    itemsRetained = filterItemBlockLogByStatusAndDuration(itemsRetained,
      $scope.itemStatus, $scope.blockedDuration);

    Nvd3ChartBuilder.loadBlockedStatisticsChartData($scope,
      $scope.itemStatus, itemsRetained);
  };

}]);
