var _ = require('lodash'),
    DateUtil = require('./dateUtil').DateUtil;

module.exports.KanbanItemDataMassager = {
  massageBlockLog: function(item) {
    var massagedLogs = {}, blockLog = item.blockLog;

    if (_.isEmpty(blockLog)) {
      return massagedLogs;
    }

    // block log format:
    // [
    //   {
    //     'blocked': false,
    //     'stage': 'Prioritized',
    //     'time': '2015-01-23T02:25:20.587Z'
    //   },
    //   {
    //     'blocked': true,
    //     'stage': 'Prioritized',
    //     'reason': reason,
    //     'time': blockedStart,
    //   },
    //   {
    //     'blocked': false,
    //     'stage': 'Prioritized',
    //     'time': blockedEnd
    //   }
    // ]
    //
    // expected format:
    // {
    //   Prioritized: [ 43200000, 'Priority shifted' ]
    // }

    function completeBlockedRecord(massagedLogs, blockedStage, blockedStart, blockedEnd, reason) {
      // Normal case and item unblocked
      if (!massagedLogs[blockedStage]) {
        massagedLogs[blockedStage] = [0];
      }
      massagedLogs[blockedStage][0] += DateUtil.diff(blockedEnd, blockedStart);

      if (!_.isEmpty(reason)) {
        if (_.isEmpty(massagedLogs[blockedStage][1])) {
          massagedLogs[blockedStage][1] = '';
        } else {
          massagedLogs[blockedStage][1] += '\n';
        }
        massagedLogs[blockedStage][1] +=  reason;
      }
    }

    var blockedStage = '',
        blockedStart = '',
        blockedReason = '';

    _.forEach(blockLog, function(log) {
      if (!log.blocked) {
        if (!blockedStage) {
          // skipping item starting with non-blocking status if no blocking found before
          return;
        } else if (log.stage === blockedStage) {
          // Normal case and item unblocked
          completeBlockedRecord(
            massagedLogs, blockedStage, blockedStart, log.time, blockedReason);

          blockedStage = '';
          blockedStart = '';
        }
      } else {
        if (!_.isEmpty(blockedStage) && blockedStage !== log.stage) {
          // Switch to another stage but still blocked
          completeBlockedRecord(
            massagedLogs, blockedStage, blockedStart, log.time, blockedReason);
        }

        blockedStage = log.stage;
        blockedStart = log.time;
        blockedReason = log.reason;
      }
    });

    return massagedLogs;
  }
};
