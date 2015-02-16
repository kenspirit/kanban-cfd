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
    4697704218: 'Ken',
    7111846346: 'Leo',
    6549512547: 'Johnson',
    7111845788: 'Doris'
  }, // Key is the id used in data provider system.  Value is for display
  defaultLeadTimeDuration: 5, // Default value for kanban item lead time graph filtering,
  defaultLeadTimeStartStatus: 'Req', // Start of Lead Time is based on start time of this status
  defaultLeadTimeEndStatus: 'In Dev', // End of Lead Time is based on start time of this status
  defaultBlockedDuration: 1, // Default value for blocked statistics graph filtering,
  ignoreWeekend: true // Whether weekend should be used to count as valid duration.  Impacts schedule job as well.
};
