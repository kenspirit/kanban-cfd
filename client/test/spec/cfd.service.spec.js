/* global _, afterEach */
var expect = chai.expect;

function getDateFromISODateString(dateString) {
  return dateString.substring(0, 'YYYY-MM-DD'.length);
}

describe('Unit Test: CFD Services', function() {

  beforeEach(function() {
    angular.mock.module('Kanban.service');
  });


  describe('SnapshotService', function() {
    var SnapshotService;

    beforeEach(inject(function($injector) {
      SnapshotService = $injector.get('SnapshotService');
    }));

    describe('#getSnapshotDatesFromSnapshot', function() {
      it('should have distinct date in result', function() {
        var snapshots = [], dates;

        dates = SnapshotService.getSnapshotDatesFromSnapshot(snapshots);
        expect(dates.length).to.equal(0);

        snapshots = [{
          'date': '2014-04-29T08:21:10.578Z'
        },
        {
          'date': '2014-04-29T18:21:10.578Z'
        }];

        dates = SnapshotService.getSnapshotDatesFromSnapshot(snapshots);
        expect(dates.length).to.equal(1);
        expect(dates[0]).to.equal('2014-04-29');
       });

      it('should have date sorted in result', function() {
        var snapshots = [{
          'date': '2014-04-29T08:21:10.578Z'
        },
        {
          'date': '2014-04-28T18:21:10.578Z'
        },
        {
          'date': '2014-04-29T18:21:10.578Z'
        },
        {
          'date': '2014-04-27T08:21:10.578Z'
        }];

        var dates = SnapshotService.getSnapshotDatesFromSnapshot(snapshots),
            expectedDates = ['2014-04-27','2014-04-28','2014-04-29'];

        expect(dates.length).to.equal(expectedDates.length);
        expect(dates).to.deep.equal(expectedDates);
      });
    });

    describe('#buildSnapshotSeriesByDate', function() {
      var baseSnapshots = [{
        'status': 'Prioritized',
        'date': '2014-04-29T08:21:10.578Z'
      },
      {
        'status': 'Req',
        'date': '2014-04-30T08:21:10.578Z'
      },
      {
        'status': 'Design',
        'date': '2014-05-01T08:21:10.578Z'
      },
      {
        'status': 'In Dev',
        'date': '2014-05-02T08:21:10.578Z'
      },
      {
        'status': 'Ready for Test',
        'date': '2014-05-03T08:21:10.578Z'
      },
      {
        'status': 'Prioritized',
        'date': '2014-04-30T08:21:10.578Z'
      },
      {
        'status': 'In Dev',
        'date': '2014-05-02T18:21:10.578Z'
      }];

      var baseSeries = {
        '2014-04-29': {
          'Prioritized': 1
        },
        '2014-04-30': {
          'Prioritized': 1,
          'Req': 1
        },
        '2014-05-01': {
          'Design': 1
        },
        '2014-05-02': {
          'In Dev': 2
        },
        '2014-05-03': {
          'Ready for Test': 1
        }
      };

      var baseDates = baseSnapshots.reduce(function(allDates, log) {
        var date = getDateFromISODateString(log.date);

        if (allDates.indexOf(date) === -1) {
          allDates.push(date);
        }

        return allDates;
      }, []);

      it('should group data by Date & Status correctly', function() {
        var dates = SnapshotService.getSnapshotDatesFromSnapshot(baseSnapshots),
            series = SnapshotService.buildSnapshotSeriesByDate(dates, baseSnapshots);

        expect(dates).to.deep.equal(baseDates);

        _.keys(series).forEach(function(date) {
          _.keys(series[date]).forEach(function(status) {
            if (baseSeries[date] && baseSeries[date][status]) {
              expect(series[date][status]).to.equal(baseSeries[date][status]);
            } else {
              expect(series[date][status]).to.equal(0);
            }
          });
        });
      });

      it('should has 0 value entry if snapshots\' dates are subset of ' +
          'provided series dates', function() {

        var dates = baseDates.concat(['2014-05-11', '2014-06-04']),
            series = SnapshotService.buildSnapshotSeriesByDate(dates, baseSnapshots);

        expect(_.keys(series)).to.deep.equal(dates);

        _.keys(series).forEach(function(date) {
          _.keys(series[date]).forEach(function(status) {
            if (baseSeries[date] && baseSeries[date][status]) {
              expect(series[date][status]).to.equal(baseSeries[date][status]);
            } else {
              expect(series[date][status]).to.equal(0);
            }
          });
        });
      });

    });

  });

  describe('ItemDetailService', function() {
    describe('#loadItemDetail', function() {
      var $httpBackend;

      beforeEach(inject(function($injector) {
        $httpBackend = $injector.get('$httpBackend');
      }));

      afterEach(function() {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
      });

      it('should calculate the duration correctly.', inject(function(ItemDetailService) {
        var statusList = ItemDetailService.getItemDetailStatusList();

        $httpBackend.when('GET', '/itemDetail').respond({
          status: true,
          errMsg: '',
          result: [{
            'kanbanizedOn': new Date(),
            'name': 'Sample Item',
            'objectID': 1,
            'owner': 2,
            'statusChangeLog': [
              {
                'from': '2014-05-13T01:29:38.724Z',
                'status': 'Prioritized',
                'to': '2014-05-13T05:45:59.310Z' // 4 hours
              }, // Req stage is missing here
              {
                'from': '2014-05-13T05:45:59.310Z',
                'status': 'Design',
                'to': '2014-05-14T15:45:59.310Z' // 34 hours
              },
              {
                'from': '2014-05-14T15:45:59.310Z',
                'status': 'In Dev',
                'to': '2014-05-15T15:45:59.310Z' // 24 hours
              },
              {
                'from': '2014-05-15T15:45:59.310Z',
                'status': 'In Dev',
                'to': '2014-05-19T15:45:59.310Z' // 24 * 4 - 24 * 2 (weekend) hours
              },
              {
                'from': '2014-05-19T15:45:59.310Z',
                'status': 'Ready for Test',
                'to': '2014-05-21T04:45:59.310Z' // 37 hours
              },// In Test stage is missing here
              {
                'from': '2014-05-21T04:45:59.310Z',
                'status': 'Accepted', // Should be ignore in calculated result
                'to': '9999-01-01T00:00:00.000Z'
              }
            ],
            'type': 'HierarchicalRequirement'
          }]
        });

        ItemDetailService.loadItemDetail({}, function(items) {
          var item = items[0];

          expect(_.keys(item)).to.have.members(
            ['name', 'type', 'statusDuration', 'totalDuration']);

          expect(item.statusDuration.length).to.equal(statusList.length);
          expect(item.totalDuration).to.equal(4 + 34 + 24 + 24 * 2 + 37);
        });

        $httpBackend.flush();
      }));



    });
  });
});
