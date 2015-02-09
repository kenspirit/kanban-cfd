var DateUtil = require('../../../dateUtil').DateUtil,
    blockedStart = '2015-01-24T02:25:20.587Z',
    blockedEnd = '2015-01-24T14:25:20.587Z',
    reason = 'Priority shifted',
    fixture = {
      blockLog: [
        {
          'blocked': false,
          'stage': 'Prioritized',
          'time': '2015-01-23T02:25:20.587Z'
        },
        {
          'blocked': true,
          'stage': 'Prioritized',
          'reason': reason,
          'time': blockedStart,
        },
        {
          'blocked': false,
          'stage': 'Prioritized',
          'time': blockedEnd
        }
      ]
    };

module.exports = {
  src: fixture,
  result: {
    Prioritized: [DateUtil.diff(blockedEnd, blockedStart), reason]
  }
};
