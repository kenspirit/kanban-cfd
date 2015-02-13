var DateUtil = require('../../../dateUtil').DateUtil,
    blockedStart = '2015-01-24T02:25:20.587Z',
    reason = 'Priority shifted',
    fixture = {
      blockLog: [
        {
          'blocked': true,
          'stage': 'Prioritized',
          'reason': reason,
          'time': blockedStart,
        }
      ]
    };

module.exports = {
  src: fixture,
  result: {
    Prioritized: [DateUtil.diff(DateUtil.nowInUTCString(), blockedStart), reason]
  }
};
