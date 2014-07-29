/* global _, moment, io */

var app = angular.module('Kanban', ['ngResource', 'ui.bootstrap', 'googlechart',
  'Kanban.config', 'Kanban.service', 'Kanban.chart']);

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

  // $scope.refreshGraph();

  var socket = io.connect('/');

  socket.on('dailyUpdate', function (snapshots) {
    $scope.$broadcast('dailyUpdate', snapshots);
  });
}])
.controller('CumulativeFlowDiagramCtrl', ['$scope', '$resource', 'SYS_CONFIG',
    'ChartConfigFactory', 'QueryBuilder', 'SnapshotService', 'GoogleChartDataTransformer',
   function($scope, $resource, SYS_CONFIG, ChartConfigFactory, QueryBuilder,
     SnapshotService, GoogleChartDataTransformer) {

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
  $scope.cfdChartConfig = ChartConfigFactory.getAreaConfig('All');
  $scope.ownerChartConfigs = {};

  function buildCFDChart(snapshots, snapshotDates, cfdSeries) {
    $scope.snapshotDates = [];
    $scope.ownerChartConfigs = {};

    $scope.snapshots = snapshots;
    $scope.snapshotDates = snapshotDates;
    $scope.cfdChartConfig.data.rows =
      GoogleChartDataTransformer.transformCFD(cfdSeries);

    $scope.byOwner();
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
      $scope.cfdChartConfig.data.rows.push.apply(
        $scope.cfdChartConfig.data.rows,
        GoogleChartDataTransformer.transformCFD(cfdSeries));

      if (_.keys($scope.ownerChartConfigs).length === 0) {
        return; // Shown by owner is not enabled yet.
      }

      _.keys(SYS_CONFIG.owners).forEach(function(owner) {
        var snapshotByOwner = snapshots.filter(function(snapshot) {
          return snapshot.owner == owner;
        });

        var ownerChartConfig =
          ChartConfigFactory.getAreaConfig(SYS_CONFIG.owners[owner]);

        var cfdSeriesByOwner =
          SnapshotService.buildSnapshotSeriesByDate(snapshotDates, snapshotByOwner);

        ownerChartConfig.data.rows.push.apply(
          ownerChartConfig.data.rows,
          GoogleChartDataTransformer.transformCFD(cfdSeriesByOwner));
      });

      $scope.$apply();
    });
  });

  $scope.byOwner = function() {
    if (_.keys($scope.ownerChartConfigs).length !== 0) {
      return; // Data has been initialized already
    }

    _.keys(SYS_CONFIG.owners).forEach(function(owner) {
      var snapshotByOwner = $scope.snapshots.filter(function(snapshot) {
        return snapshot.owner == owner;
      });

      var ownerChartConfig = ChartConfigFactory.getAreaConfig(
        SYS_CONFIG.owners[owner]
      );

      ownerChartConfig.data.rows = GoogleChartDataTransformer.transformCFD(
        SnapshotService.buildSnapshotSeriesByDate(
          $scope.snapshotDates, snapshotByOwner));

      $scope.ownerChartConfigs[owner] = ownerChartConfig;
    });
  };

  showCFD();
}])
.controller('KanbanItemDetailCtrl', ['$scope', 'SYS_CONFIG', 'ItemDetailService',
    'QueryBuilder', 'ChartConfigFactory', 'GoogleChartDataTransformer',
  function($scope, SYS_CONFIG, ItemDetailService, QueryBuilder,
    ChartConfigFactory, GoogleChartDataTransformer) {

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
    if (!itemTypes || !itemStatus) {
      // Initial page loading stage and they are not ready yet
      return;
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

    function filterItemByType(itemTypes, items) {
      var retainedTypes = itemTypes.reduce(function(retained, type) {
        if (type.selected) {
          retained.push(type.id);
        }
        return retained;
      }, []);

      var itemsRetained = items.filter(function(item) {
        if (retainedTypes.indexOf(item.type) === -1) {
          return false;
        }

        return true;
      });

      return itemsRetained;
    }

    function filterItemByDuration(items) {
      var itemsRetained = items.filter(function(item) {
        if (item.totalDuration <= $scope.kanbanCycleDuration * 24) {
          return false;
        }

        return true;
      });

      return itemsRetained;
    }

    function itemDetailComparator(item1, item2) {
      return item2.totalDuration - item1.totalDuration; // sort desc
    }

    var itemsRetained = filterItemByType(itemTypes, $scope.kanbanItems);

    // To remove status duration for those not-shown status
    // Clone is needed as item duration will be changed.
    itemsRetained = cloneItems(itemsRetained);
    var retainedStatus = itemStatus.map(function(status) {
      return status.selected;
    });

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

    $scope.itemChartConfig = ChartConfigFactory.getStackedColumnConfig(
      itemStatus.reduce(function(retained, status) {
        if (status.selected) {
          retained.push(status.name);
        }
        return retained;
      }, []));

    $scope.itemChartConfig.data.rows =
       GoogleChartDataTransformer.transformItemDetail(itemsRetained);
  };
}]);
