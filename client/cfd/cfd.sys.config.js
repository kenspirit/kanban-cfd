!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.CFD=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
module.exports = {
  server: 'localhost', // For browser to connect to
  port: 3000,
  dataCollectTime: 17, // 5PM
  dataFileLocation: './data/',
  kanbanProvider: 'rally', // Must match the JS file name
  dateFormat: 'YYYY-MM-DD', // Date format for browser & server communication
  kanbanItemTypes: {
    'HierarchicalRequirement': 'Story',
    'Defect': 'Defect'
  }, // Key is the id used in data provider system.  Value is for display purpose
  kanbanStatusNames: [
    'Accepted',
    'In Test',
    'Ready for Test',
    'In Dev',
    'Design',
    'Req',
    'Prioritized'
  ], // sequence matters for CFD calculation.  Earlier stage is put at the end
  owners: {
    1: 'Ken',
    2: 'Winnie',
    3: 'Sam',
    4: 'Lincoln',
    5: 'Jimmy'
  }, // Key is the id used in data provider system.  Value is for display
  needItemDetailGraph: true, // Requires functionality to show Kanban Item Detail or not
  defaultKanbanCycleDuration: 5, // Default value for kanban item detail graph filtering,
  ignoreWeekend: true // Whether weekend should be used to count as valid duration.  Impacts schedule job as well.
};

},{}]},{},[1])
(1)
});
