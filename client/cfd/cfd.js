/* global _, moment, io */

var app = angular.module('Kanban', ['ngResource', 'ui.bootstrap',
  // 'googlechart', 'nvd3',
  'nvd3ChartDirectives', 'Kanban.config', 'Kanban.service', 'Kanban.chart']);

app.controller('KanbanCtrl', ['$scope', function($scope) {

  $scope.dateFormat = 'yyyy-MM-dd';
  $scope.calendarStatus = {};
  $scope.dateOptions = {};
  $scope.startDate = moment().subtract(1, 'months').toDate();
  $scope.endDate = moment().toDate();

  $scope.activeTab = {};

  $scope.openCalendar = function($event, field) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.calendarStatus[field] = true;
  };

  $scope.initHistoricalData = function() {
    $scope.$broadcast('initHistory');
  };

  $scope.refreshGraph = function() {
    $scope.$broadcast('refresh');
  };

  var socket = io.connect('/');

  socket.on('dailyUpdate', function (snapshots) {
    $scope.$broadcast('dailyUpdate', snapshots);
  });
}])
.controller('CumulativeFlowDiagramCtrl', ['$scope', '$resource', 'SYS_CONFIG',
    'QueryBuilder', 'SnapshotService', 'Nvd3ChartBuilder',
   function($scope, $resource, SYS_CONFIG, QueryBuilder,
     SnapshotService, Nvd3ChartBuilder) {

  $scope.activeTab.cfd = true;

  $scope.allOwners = _.keys(SYS_CONFIG.owners).map(function(ownerId) {
    return {
      id: ownerId,
      name: SYS_CONFIG.owners[ownerId],
      open: true
    };
  });

  $scope.showByOwner = false;
  $scope.snapshots = [];
  $scope.snapshotDates = [];

  Nvd3ChartBuilder.initCFDChartData($scope);

  function buildCFDChart(snapshots, snapshotDates, cfdSeries) {
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

    $scope.snapshots = snapshots;
    $scope.snapshotDates = snapshotDates;

    Nvd3ChartBuilder.loadCFDChartData($scope, cfdSeries);
    Nvd3ChartBuilder.loadCFDByOwner($scope);
  }

  function showCFD() {
    if ($scope.activeTab.cfd) {
      SnapshotService.loadAndProcessSnapshots(
        QueryBuilder.getQueryParam($scope), buildCFDChart);
    }
  }

  $scope.$on('refresh', showCFD);

  $scope.$on('initHistory', function() {
    var HistoricalDataService = $resource('/initHistoricalData', {},
      {'init':  {method:'POST', isArray:false}});

    HistoricalDataService.init(QueryBuilder.getQueryParam($scope),
      function(response) {
        SnapshotService.processSnapshots(response.result || [], buildCFDChart);
      });
  });

  $scope.$on('dailyUpdate', function($event, snapshots) {
    SnapshotService.processSnapshots(snapshots,
        function(snapshots, snapshotDates, cfdSeries) {

      $scope.snapshots.push.apply($scope.snapshots, snapshots);
      $scope.snapshotDates.push.apply($scope.snapshotDates, snapshotDates);

      Nvd3ChartBuilder.loadCFDChartData($scope, cfdSeries);
      Nvd3ChartBuilder.loadCFDByOwner($scope);

      $scope.$apply();
    });
  });

  showCFD();
}])
.controller('KanbanItemDetailCtrl', ['$scope', 'SYS_CONFIG', 'ItemDetailService',
    'QueryBuilder',
  function($scope, SYS_CONFIG, ItemDetailService, QueryBuilder) {

  $scope.showKanbanCycle = true;
  $scope.activeTab.item = false;

  $scope.needItemDetailGraph = SYS_CONFIG.needItemDetailGraph;
  $scope.kanbanCycleDuration = SYS_CONFIG.defaultKanbanCycleDuration;

  $scope.kanbanItems = [];
  $scope.itemTypes = _.keys(SYS_CONFIG.kanbanItemTypes)
    .map(function(type) {
      return {
        id: type,
        name: SYS_CONFIG.kanbanItemTypes[type],
        selected: true
      };
    });
  $scope.itemStatus = ItemDetailService.getItemDetailStatusList()
    .map(function(status) {
      return {
        name: status,
        selected: true
      };
    });

  $scope.$watch('itemTypes', function(newValue/*, oldValue*/) {
    $scope.refreshKanbanItemGraph(newValue, $scope.itemStatus);
  }, true);

  $scope.$watch('itemStatus', function(newValue/*, oldValue*/) {
    $scope.refreshKanbanItemGraph($scope.itemTypes, newValue);
  }, true);

  $scope.$on('refresh', function() {
    if ($scope.activeTab.item) {
      $scope.kanbanItems.length = 0;
      $scope.showKanbanItemGraph();
    }
  });

  $scope.showKanbanItemGraph = function() {
    if (!$scope.kanbanCycleDuration) {
      return; // When the value is removed from input field
    }

    if ($scope.kanbanItems.length === 0) {
      ItemDetailService.loadItemDetail(
        QueryBuilder.getQueryParam($scope), function(items) {
          $scope.kanbanItems = items;
          $scope.refreshKanbanItemGraph($scope.itemTypes, $scope.itemStatus);
        });
    }
  };

  $scope.refreshKanbanItemGraph = function(itemTypes, itemStatus) {
    $scope.$broadcast('refreshItem', itemTypes, itemStatus);
  };

  $scope.getSelectedStatus = function(itemStatus) {
    return itemStatus.map(function(status) {
      return status.selected;
    });
  };

  $scope.getSelectedStatusName = function(itemStatus) {
    return itemStatus.reduce(function(retained, status) {
      if (status.selected) {
        retained.push(status.name);
      }
      return retained;
    }, []);
  };

  $scope.getSelectedType = function(itemTypes) {
    return itemTypes.reduce(function(retained, type) {
      if (type.selected) {
        retained.push(type.id);
      }
      return retained;
    }, []);
  };

}])
.controller('KanbanCycleCtrl', ['$scope', 'SYS_CONFIG', 'ItemDetailService',
  'Nvd3ChartBuilder',
    function($scope, SYS_CONFIG, ItemDetailService, Nvd3ChartBuilder) {

  Nvd3ChartBuilder.initKanbanCycleChartData($scope);

  $scope.$on('refreshItem', function($event, itemTypes, itemStatus) {
    $scope.refreshKanbanCycleGraph(itemTypes, itemStatus);
  });

  $scope.refreshKanbanCycleGraph = function(itemTypes, itemStatus) {
    if (!itemTypes || !itemStatus) {
      // Initial page loading stage and they are not ready yet
      return;
    }

    function filterItemByDuration(items) {
      return items.filter(function(item) {
        if (item.totalDuration <= $scope.kanbanCycleDuration * 24) {
          return false;
        }

        return true;
      });
    }

    function itemDetailComparator(item1, item2) {
      return item2.totalDuration - item1.totalDuration; // sort desc
    }

    function cloneItems(items) {
      return items.map(function(item) {
        return {
          name: item.name,
          totalDuration: item.totalDuration,
          type: item.type,
          statusDuration: item.statusDuration.map(function(dur) {
            return dur;
          })
        };
      });
    }

    var retainedStatus = $scope.getSelectedStatus(itemStatus);
    var itemsRetained = ItemDetailService.filterItemByType(
      $scope.getSelectedType(itemTypes), $scope.kanbanItems);

    // To remove status duration for those not-shown status
    // Clone is needed as item's statusDuration will be changed.
    itemsRetained = cloneItems(itemsRetained);

    itemsRetained.forEach(function(item) {
      item.statusDuration = item.statusDuration.reduce(
        function(durations, dur, index) {
          if (retainedStatus[index]) {
            durations.push(dur);
          }
          return durations;
        }, []);

      item.totalDuration = item.statusDuration.reduce(function(sum, dur) {
        return sum + dur;
      }, 0);
    });

    itemsRetained = filterItemByDuration(itemsRetained)
      .sort(itemDetailComparator);

    Nvd3ChartBuilder.loadKanbanCycleChartData($scope,
      $scope.getSelectedStatusName(itemStatus), itemsRetained);
  };
}])
.controller('BlockedStatisticsCtrl', ['$scope', 'SYS_CONFIG', 'Nvd3ChartBuilder',
  'ItemDetailService',
    function($scope, SYS_CONFIG, Nvd3ChartBuilder, ItemDetailService) {
  $scope.blockedDuration = SYS_CONFIG.defaultBlockedDuration;

  Nvd3ChartBuilder.initBlockedStatisticsChartData($scope);

  $scope.$on('refreshItem', function($event, itemTypes, itemStatus) {
    $scope.refreshBlockedStatisticsGraph(itemTypes, itemStatus);
  });

  $scope.refreshBlockedStatisticsGraph = function(itemTypes, itemStatus) {
    if (!itemTypes || !itemStatus) {
      // Initial page loading stage and they are not ready yet
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

    var retainedStatus = $scope.getSelectedStatusName(itemStatus);
    var itemsRetained = ItemDetailService.filterItemByType(
      $scope.getSelectedType(itemTypes), $scope.kanbanItems);

    // Item is cloned with filtered log
    itemsRetained = filterItemBlockLogByStatusAndDuration(itemsRetained,
      retainedStatus, $scope.blockedDuration);

    Nvd3ChartBuilder.loadBlockedStatisticsChartData($scope,
      $scope.getSelectedStatusName(itemStatus), itemsRetained);
  };

}]);
