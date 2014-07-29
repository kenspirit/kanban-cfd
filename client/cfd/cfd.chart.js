/* global _, moment */

angular.module('Kanban.chart', ['Kanban.config', 'Kanban.service'])
  .factory('ChartConfigFactory', ['SYS_CONFIG', function(SYS_CONFIG) {
    return {
      getAreaConfig: function(title) {
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
      },
      getStackedColumnConfig: function(displayStatus) {
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
    };
  }])
  .factory('GoogleChartDataTransformer', function() {
    return {
      transformCFD: function(seriesByDate) {
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
      },
      transformItemDetail: function(itemDetails) {
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
    };
  });
