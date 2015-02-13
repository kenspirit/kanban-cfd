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

        $scope.toolTipContentFunction = function(key, x, y, e/*, graph*/) {
          var tips = '<div>' + x + '</div>' +
            key + ': <span style="font-weight: bold"> ' + y + '</span>';
          if (e.point[2]) {
            tips += ' Blocked <span style="font-weight: bold">'
              + (e.point[2] / (24.0 * 3600 * 1000)).toFixed(1)
              + '</span> days for reason: ' + e.point[3];
          }
          return tips;
        };
      },

      getLeadTimeChartData: function($scope, displayStatus, itemDetails) {
        var itemLeadTime = [];

        for (var i = 0; i < displayStatus.length; i++) {
          var status = displayStatus[i],
              data = {
                key: status,
                values: []
              };

          for (var j = 0; j < itemDetails.length; j++) {
            var item = itemDetails[j],
                // durationInHour = (item.statusDuration[i] / 24.0).toFixed(1);
                durationInHour = item.statusDuration[i] / 24.0,
                result = [item.name, durationInHour];

            if (!_.isEmpty(item.blockLog) && !_.isEmpty(item.blockLog[status])) {
              var blocked = item.blockLog[status];
              result.push(blocked[0]);
              result.push(blocked[1] ? blocked[1] : 'None');
            }
            data.values.push(result);
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

        var statusBlockedStatistics = {};

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
      }
    };
  }]);
