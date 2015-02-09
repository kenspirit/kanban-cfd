/* global _, moment */

angular.module('Kanban.chart', ['Kanban.config', 'Kanban.service'])
  .factory('GoogleChartBuilder', ['SYS_CONFIG', 'SnapshotService',
      function(SYS_CONFIG, SnapshotService) {
    function getAreaConfig(title) {
      var cols = [{
        'id': 'date',
        'label': 'Date',
        'type': 'string'
      }];

      SYS_CONFIG.kanbanStatusNames.forEach(function(status) {
        cols.push({
          id: status,
          label: status,
          type: 'number'
        });
      });

      return {
        'type': 'AreaChart',
        'displayed': false,
        'data': {
          'cols': cols,
          'rows': []
        },
        'options': {
          'title': 'Kanban CFD (' + title + ')',
          'isStacked': 'true',
          'fill': 20,
          'displayExactValues': true,
          'vAxis': {
            'title': 'WIP Count',
            'format': '#',
            'gridlines': {
              'count': 10
            }
          },
          'hAxis': {
            'title': 'Date',
            'showTextEvery': 4
          }
        },
        'formatters': {}
      };
    }

    function getStackedColumnConfig(displayStatus) {
      var cols = [{
        'id': 'date',
        'label': 'Date',
        'type': 'string'
      }];

      displayStatus.forEach(function(status) {
        cols.push({
          id: status,
          label: status,
          type: 'number'
        });
      });

      return {
        'cssStyle': 'height:800px; width:100%;',
        'type': 'BarChart',
        'displayed': false,
        'data': {
          'cols': cols,
          'rows': []
        },
        'options': {
          'title': 'Kanban Item Cycle',
          'isStacked': 'true',
          'fill': 20,
          'displayExactValues': true,
          'vAxis': {
            'title': 'Item',
            'gridlines': {
              'count': 10
            },
            'textPosition': 'none'
          },
          'hAxis': {
            'title': 'Kanban Cycle Duration'
          },
          'tooltip': {
            'isHtml': true
          }
        },
        'view': {}
      };
    }

    function transformCFD(seriesByDate) {
      var dates = _.keys(seriesByDate).sort();

      return dates.map(function(date) {
        var chartData = {
          c: [{
              v: moment(date).format('MMM-DD')
            }]
        };

        chartData.c = chartData.c.concat(
          _.values(seriesByDate[date]).map(function(i) {
            return {
              v: i
            };
          }));

        return chartData;
      });
    }

    function transformItemDetail(itemDetails) {
      return itemDetails.map(function(item) {
        var chartData = {
          c: [{
            v: item.name
          }]
        };

        chartData.c = chartData.c.concat(
          item.statusDuration.map(function(i) {
            return {
              v: (i / 24.0).toFixed(1) // In Days
            };
          }));

        chartData.c.push(null);
        return chartData;
      });
    }

    return {
      initCFDChartData: function($scope) {
        $scope.cfdChartConfig = getAreaConfig('All');
        $scope.ownerChartConfigs = {};
      },

      loadCFDChartData: function($scope, cfdSeries) {
        $scope.cfdChartConfig.data.rows = transformCFD(cfdSeries);
        $scope.ownerChartConfigs = {};
      },

      loadCFDByOwner: function($scope) {
        if (_.keys($scope.ownerChartConfigs).length !== 0) {
          return; // Data has been initialized already
        }

        _.keys(SYS_CONFIG.owners).forEach(function(owner) {
          var snapshotByOwner = $scope.snapshots.filter(function(snapshot) {
            return snapshot.owner == owner;
          });

          var ownerChartConfig = getAreaConfig(SYS_CONFIG.owners[owner]);

          ownerChartConfig.data.rows = transformCFD(
            SnapshotService.buildSnapshotSeriesByDate(
              $scope.snapshotDates, snapshotByOwner));

          $scope.ownerChartConfigs[owner] = ownerChartConfig;
        });
      },

      initKanbanCycleChartData: function() {
      },

      loadKanbanCycleChartData: function($scope, displayStatus, itemDetails) {
        $scope.itemChartConfig = getStackedColumnConfig(displayStatus);
        $scope.itemChartConfig.data.rows = transformItemDetail(itemDetails);
      }
    };
  }])
  .factory('Nvd3ChartBuilder', ['SYS_CONFIG', 'SnapshotService',
      function(SYS_CONFIG, SnapshotService) {

    function tranformCFDData(cfdSeries) {
      var cfdData = _.map(SYS_CONFIG.kanbanStatusNames, function(status) {
        return {
          key: status,
          values: []
        };
      });

      var dates = _.keys(cfdSeries).sort();

      _.forEach(dates, function(date) {
        var dateLabel = moment(date).valueOf();

        _.forEach(cfdData, function(cfdPerStatus) {
          var status = cfdPerStatus.key;
          cfdPerStatus.values.push([dateLabel, cfdSeries[date][status] ? cfdSeries[date][status] : 0]);
        });
      });

      return cfdData;
    }

    return {
      initCFDChartData: function($scope) {
        $scope.cfdData = tranformCFDData([]);

        $scope.cfdDataByOwner = {};

        $scope.formatDateLabel = function(date) {
          return moment(date).format('MMM-DD');
        };

        $scope.formatCountLabel = function(count) {
          return parseInt(count);
        };
      },

      loadCFDChartData: function($scope, cfdSeries) {
        $scope.cfdData = tranformCFDData(cfdSeries);
        $scope.cfdDataByOwner = {};
      },

      loadCFDByOwner: function($scope) {
        if (_.keys($scope.cfdDataByOwner).length !== 0) {
          return; // Data has been initialized already
        }

        _.keys(SYS_CONFIG.owners).forEach(function(owner) {
          var snapshotByOwner = $scope.snapshots.filter(function(snapshot) {
            return snapshot.owner == owner;
          });

          $scope.cfdDataByOwner[owner] = tranformCFDData(
            SnapshotService.buildSnapshotSeriesByDate(
              $scope.snapshotDates, snapshotByOwner));
        });
      },

      initKanbanCycleChartData: function($scope) {
        $scope.toolTipContentFunction = function(key, x, y/*, e, graph*/) {
          return '<div>' + x + '</div>' +
            key + ': <span style="font-weight: bold"> ' + y + '</span>';
        };
      },

      loadKanbanCycleChartData: function($scope, displayStatus, itemDetails) {
        var itemKanbanCycle = [];

        for (var i = 0; i < displayStatus.length; i++) {
          var data = {
            key: displayStatus[i],
            values: []
          };

          for (var j = 0; j < itemDetails.length; j++) {
            var item = itemDetails[j],
                // durationInHour = (item.statusDuration[i] / 24.0).toFixed(1);
                durationInHour = item.statusDuration[i] / 24.0;

            data.values.push([item.name, durationInHour]);
          }
          itemKanbanCycle.push(data);
        }

        $scope.itemKanbanCycle = itemKanbanCycle;
      },

      initBlockedStatisticsChartData: function($scope) {
        $scope.toolTipContentFunction = function(key, x, y/*, e, graph*/) {
          return '<h4>' + key + '</h4>' +
            '<span style="font-weight: bold"> ' + y + '</span>';
        };

        $scope.itemToolTipContentFunction = function(key, x, y, e/*, graph*/) {
          return '<h4>' + key + '</h4>' +
            '<span style="font-weight: bold"> ' + y + '</span> for ' +
            (e.point[2] ? e.point[2] : 'None');
        };
      },

      loadBlockedStatisticsChartData: function($scope, displayStatus, itemDetails) {
        // Item blocked log sample
        // "blockLog": {
        //   Prioritized: [ 43200000, 'Priority shifted' ]
        // }

        var statusBlockedStatistics = {},
            itemBlockedStatistics = [];

        _.forEach(itemDetails, function(item) {
          if (_.isEmpty(item.blockLog)) {
            return;
          }

          _.forEach(_.keys(item.blockLog), function(blockStatus) {
            if (displayStatus.indexOf(blockStatus) < 0) {
              return;
            }

            var reason = item.blockLog[blockStatus][1];
            if (!reason) {
              reason = 'None';
            }

            if (!statusBlockedStatistics[reason]) {
              statusBlockedStatistics[reason] = {};
              statusBlockedStatistics[reason][blockStatus] = 0;
            }
            statusBlockedStatistics[reason][blockStatus] += item.blockLog[blockStatus][0];
          });

          _.forEach(displayStatus, function(status, index) {
            if (itemBlockedStatistics.length === index) {
              // Statistics for this status not initialized yet
              itemBlockedStatistics[index] = {
                key: status,
                values: []
              };
            }

            var blockStatus = [item.name.substring(0, item.name.indexOf(':'))];
            if (!item.blockLog[status]) {
              blockStatus.push(0);
              blockStatus.push('None');
            } else {
              blockStatus.push(item.blockLog[status][0]);
              blockStatus.push(item.blockLog[status][1] ? item.blockLog[status][1] : 'None');
            }

            itemBlockedStatistics[index].values.push(blockStatus);
          });
        });

        statusBlockedStatistics = _.map(_.keys(statusBlockedStatistics), function(reason) {
          var values = _.map(displayStatus, function(status) {
            var duration = 0;
            if (statusBlockedStatistics[reason][status]) {
              duration = statusBlockedStatistics[reason][status];
            }
            return [status, duration];
          });

          return {
            key: reason,
            values: values
          };
        });

        $scope.statusBlockedStatistics = statusBlockedStatistics;
        $scope.itemBlockedStatistics = itemBlockedStatistics;
      }
    };
  }]);
