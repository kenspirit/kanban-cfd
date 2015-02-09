var KanbanItemDataMassager = require('../../kanbanItemDataMassager').KanbanItemDataMassager,
    expect = require('chai').expect;

describe('Item Data Massage', function() {
  describe('#massageItemBlockLog', function() {
    function verify(path) {
      var fixture = require('../fixtures/itemBlockLog/' + path);

      expect(KanbanItemDataMassager.massageBlockLog(fixture.src))
        .to.eql(fixture.result);
    }

    it('Item without blockLog element.', verify.bind(this, 'null'));

    it('Item with empty blockLog element.', verify.bind(this, 'empty'));

    it('Starting with non-blocking record', verify.bind(this, 'startWithNonBlocked'));
  });
});
