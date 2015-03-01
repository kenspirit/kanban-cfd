var expect = require('chai').expect,
    _ = require('lodash'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    config = require('../../config'),
    rally = require('../../dataprovider/rally');

describe('Rally Snapshot', function() {
  it('#getHistoricalKanbanStatus', function(done) {
    // Prepare test data
    var snapshots = require('../fixtures/rally.json').Results;
    var snapshotSummary = snapshots.reduce(function(summary, item) {
      if (!summary[item.ObjectID]) {
        summary[item.ObjectID] = 1;
      } else {
        summary[item.ObjectID]++;
      }
      return summary;
    }, {});

    var itemFields =
      ['objectID', 'type', 'statusChangeLog', 'owner', 'name', 'kanbanizedOn', 'blockLog', 'estimate'];

    // Stub data retrieval method
    var getsnapshotsStub = sinon.stub(rally, 'getRallySnapshot');
    getsnapshotsStub.returns(Promise.cast(snapshots));

    // Verify data conversion
    rally.getHistoricalKanbanStatus()
      .then(function(result) {
        expect(result.length).to.equal(_.keys(snapshotSummary).length);

        result.forEach(function(item) {
          expect(itemFields).to.have.members(_.keys(item));
          expect(item.statusChangeLog.length).to.equal(
            snapshotSummary[item.objectID]);
          expect(config.kanbanItemTypes).to.include.keys(item.type);
        });

        done();
        return null;
      })
      .catch(done);
  });

  it('#itemSnapshotNow', function(done) {
    // Prepare test data
    var itemData = require('../fixtures/rallyWS.json').QueryResult.Results;
    var itemFields =
      ['objectID', 'type', 'owner', 'status', 'date', 'name'];

    // Stub data retrieval method
    var rallyDailyItemStatusStub = sinon.stub(rally, 'rallyDailyItemStatus');
    rallyDailyItemStatusStub.returns(Promise.cast(itemData));

    // Verify data conversion
    rally.itemSnapshotNow()
      .then(function(result) {
        result.forEach(function(item) {
          expect(itemFields).to.have.members(_.keys(item));
          expect(config.kanbanItemTypes).to.include.keys(item.type);
        });

        done();
        return null;
      })
      .catch(done);
  });
});
