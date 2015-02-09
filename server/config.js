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
  defaultBlockedDuration: 1, // Default value for blocked statistics graph filtering,
  ignoreWeekend: true // Whether weekend should be used to count as valid duration.  Impacts schedule job as well.
};
