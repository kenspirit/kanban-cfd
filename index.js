var express = require('express'),
    app = express(),
    _ = require('lodash'),
    http = require('http'),
    server = http.createServer(app),
    io = require('socket.io').listen(server),
    EventEmitter = require('events').EventEmitter,
    config = require('./server/config'),
    schedule = require('node-schedule'),
    DateUtil = require('./server/dateUtil').DateUtil,
    KanbanItemDataMassager = require('./server/kanbanItemDataMassager').KanbanItemDataMassager,
    KanbanStorage = require('./server/kanbanStorage'),
    kanbanProvider = require('./server/dataprovider/' + config.kanbanProvider);

app.configure(function() {
  app.use(express.urlencoded());
  app.use(express.json());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/client/'));
  app.use(app.router);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

server.listen(config.port);

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/client/cfd/cfd.html');
});

function responseConstructor(res, isSuccess, result) {
  var responseData = {
    status: isSuccess,
    errMsg: isSuccess ? '' : result.message,
    result: result
  };

  if (isSuccess) {
    res.json(200, responseData);
  } else {
    res.json(500, responseData);
  }
}

var kanbanStorage = new KanbanStorage();

app.post('/initHistoricalData', function(req, res) {
  var startDate = DateUtil.getDate(req.param('startDate'));

  kanbanProvider.getHistoricalKanbanStatus(startDate)
    .then(function(kanbanItems) {
      return kanbanStorage.initHistoricalData(kanbanItems, startDate);
    })
    .then(function(result) {
      responseConstructor(res, true, result.snapshots);
    })
    .catch(responseConstructor.bind(this, res, false));
});

app.get('/snapshot', function(req, res) {
  var startDate = DateUtil.getDate(req.param('startDate')),
      endDate = DateUtil.getDate(req.param('endDate'));

  kanbanStorage.getSnapshot({
      startDate: startDate,
      endDate: endDate
    })
    .then(responseConstructor.bind(this, res, true))
    .catch(responseConstructor.bind(this, res, false));
});

app.get('/itemDetail', function(req, res) {
  var startDate = DateUtil.getDate(req.param('startDate')),
      endDate = DateUtil.getDate(req.param('endDate'));

  kanbanStorage.getItems({
      startDate: startDate,
      endDate: endDate
    })
    .then(function(items) {
      return _.map(items, function(item) {
        item.blockLog = KanbanItemDataMassager.massageBlockLog(item);
        return item;
      });
    })
    .then(responseConstructor.bind(this, res, true))
    .catch(responseConstructor.bind(this, res, false));
});

var statusEmitter = new EventEmitter();
statusEmitter.on('error', function(err) {
  console.error('Something wrong happened.');
  console.error(err);
});

// Run on scheduled time to collect today's kanban item status
var rule = new schedule.RecurrenceRule();
if (config.ignoreWeekend) {
  rule.dayOfWeek = [new schedule.Range(1, 5)]; // Just week day
}
rule.hour = [config.dataCollectTime];
rule.minute = 0;

schedule.scheduleJob(rule, function() {
  // Only need to capture the change happen today as it is supposed that
  // previous item detail has described the Kanban status correctly.
  kanbanProvider.getHistoricalKanbanStatus()
    .then(function(kanbanItems) {
      return kanbanStorage.initHistoricalData(
        kanbanItems, DateUtil.getDate(), true);
    })
    .then(function(result) {
      statusEmitter.emit('dailyUpdate', result.snapshots);
      return result;
    })
    .catch(function(e) {
      console.log('Daily capture failed.');
      console.log(e);
    });
});

io.sockets.on('connection', function(socket) {
  statusEmitter.on('dailyUpdate', function(snapshots) {
    socket.emit('dailyUpdate', snapshots);
  });
});
