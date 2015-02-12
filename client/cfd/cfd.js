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
    $scope.$broadcast('initHistory');
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
    // And the change on "open" attribute which is not needed for refreshing data
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

        $scope.$broadcast('refresh', null, $scope.itemTypes);
      });
  };

  $scope.reloadData();

  var socket = io.connect('/');

  socket.on('dailyUpdate', function (snapshots) {
    $scope.$broadcast('dailyUpdate', snapshots);
  });

  $scope.$on('initHistory', function() {
    var HistoricalDataService = $resource('/initHistoricalData', {},
      {'init':  {method:'POST', isArray: false}});

    HistoricalDataService.init(QueryBuilder.getQueryParam($scope),
      function() {
        $scope.reloadData();
      });
  });

  // $scope.$on('dailyUpdate', function($event, snapshots) {
  //   SnapshotService.processSnapshots(snapshots,
  //       function(snapshots, cfdSeries) {

  //     $scope.snapshots.push.apply($scope.snapshots, snapshots);

  //     Nvd3ChartBuilder.loadCFDChartData($scope, cfdSeries);
  //     Nvd3ChartBuilder.loadCFDByOwner($scope);

  //     $scope.$apply();
  //   });
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

    var retainedSnapshots = SnapshotService.filterSnapshot($scope.snapshots,
      $scope.ownerId, $scope.getSelected(itemTypes));

    Nvd3ChartBuilder.loadCFDChartData($scope,
      SnapshotService.processSnapshots(retainedSnapshots));
  }

  $scope.$on('refresh', refreshCFDGraph);
}])
.controller('LeadTimeCtrl', ['$scope', 'SYS_CONFIG', 'ItemDetailService', 'Nvd3ChartBuilder',
  function($scope, SYS_CONFIG, ItemDetailService, Nvd3ChartBuilder) {

  $scope.leadTimeDuration = SYS_CONFIG.defaultLeadTimeDuration;
  $scope.fromStatus = SYS_CONFIG.defaultLeadTimeStartStatus;
  $scope.toStatus = SYS_CONFIG.defaultLeadTimeEndStatus;
  $scope.ownerId = null;
  $scope.medianLeadTime = 0;

  $scope.$on('refresh', function($event, ownerId, itemTypes) {
    $scope.refreshLeadTimeGraph(ownerId, $scope.getSelected(itemTypes));
  });

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

    function filterItemByDuration(items) {
      return items.filter(function(item) {
        if (item.totalDuration <= $scope.leadTimeDuration * 24) {
          return false;
        }

        return true;
      });
    }

    function itemDetailComparator(item1, item2) {
      return item2.totalDuration - item1.totalDuration; // sort desc
    }

    var itemsRetained = ItemDetailService.filterItem($scope.kanbanItems,
      $scope.ownerId, itemTypes);

    itemsRetained = filterItemByDuration(itemsRetained)
      .sort(itemDetailComparator);

    Nvd3ChartBuilder.getLeadTimeChartData(
      $scope, $scope.itemStatus, itemsRetained);
  };

}])
.controller('BlockedStatisticsCtrl', ['$scope', 'SYS_CONFIG', 'Nvd3ChartBuilder',
  'ItemDetailService',
    function($scope, SYS_CONFIG, Nvd3ChartBuilder, ItemDetailService) {

  $scope.ownerId = null;
  $scope.blockedDuration = SYS_CONFIG.defaultBlockedDuration;

  Nvd3ChartBuilder.initBlockedStatisticsChartData($scope);

  $scope.$on('refresh', function($event, ownerId, itemTypes) {
    $scope.refreshBlockedStatisticsGraph(ownerId, $scope.getSelected(itemTypes));
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
            blockedDuration = item.blockLog[status][0] / (24.0 * 3600 * 1000);
            reason = item.blockLog[status][1];

            if (blockedDuration > duration) {
              cloneItem.blockLog[status] = [blockedDuration, reason ? reason : 'None'];
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
