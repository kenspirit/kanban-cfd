/* global _, moment */

angular.module('Kanban.chart', ['Kanban.config', 'Kanban.service'])
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

        $scope.formatDateLabel = function(date) {
          return moment(date).format('MMM-DD');
        };

        $scope.formatCountLabel = function(count) {
          return parseInt(count);
        };
      },

      loadCFDChartData: function($scope, cfdSeries) {
        $scope.cfdData = tranformCFDData(cfdSeries);
      },

      initLeadTimeChartData: function($scope) {
        $scope.leadTimeData = [];

        $scope.toolTipContentFunction = function(key, x, y/*, e, graph*/) {
          return '<div>' + x + '</div>' +
            key + ': <span style="font-weight: bold"> ' + y + '</span>';
        };
      },

      getLeadTimeChartData: function($scope, displayStatus, itemDetails) {
        var itemLeadTime = [];

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
          itemLeadTime.push(data);
        }

        $scope.leadTimeData = itemLeadTime;
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
