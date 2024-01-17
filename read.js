var theVal = [];

var myChart;

function filterData(data, inp) {
  const filteredData = {};
  let selectedDate;

  selectedDate = new Date(
    new Date().getTime() - (inp - 1) * 24 * 60 * 60 * 1000
  );
  // Iterate through each object in the original data
  for (const key in data) {
    const entry = data[key];
    const entryDate = new Date(entry.ts);

    // Compare the entry date with the selected date
    if (
      entryDate.getFullYear() === selectedDate.getFullYear() &&
      entryDate.getMonth() === selectedDate.getMonth() &&
      entryDate.getDate() === selectedDate.getDate()
    ) {
      filteredData[key] = entry;
    }
  }

  return filteredData;
}

function jsonToCsv(jsonData) {
  const csvArray = [];

  // Add header row
  const header = ['ts', ...Object.keys(jsonData[Object.keys(jsonData)[0]])];
  csvArray.push(header.join(','));

  // Add data rows
  for (const key in jsonData) {
    const row = [jsonData[key].ts, ...Object.values(jsonData[key])];
    csvArray.push(row.join(','));
  }

  return csvArray.join('\n');
}
//document.getElementById('getData').addEventListener('click', function () {
document.getElementById('exportData').addEventListener('click', function () {
  let dburl = document.getElementById('database').value;
  let ref = document.getElementById('ref').value;

  if (dburl) {
    fetch(dburl + '/' + ref + '.json')
      .then((response) => response.json())
      .then((jsonData) => {
        // Convert JSON data to CSV format
        const csvData = jsonToCsv(jsonData);

        // Create a Blob with the CSV data
        const blob = new Blob([csvData], { type: 'text/csv' });

        // Create a download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'hibouair_data.csv';

        // Append the link to the document and trigger the download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((error) => console.error('Error fetching data:', error));
  } else {
    document.getElementById('log').innerHTML = 'Database URL missing';
  }
});
document
  .getElementById('formSubmit')
  .addEventListener('submit', function (event) {
    event.preventDefault();
    let inp = parseInt(document.getElementById('date-choose').value);
    let dburl = document.getElementById('database').value;
    let ref = document.getElementById('ref').value;
    fetch(dburl + '/' + ref + '.json')
      .then((response) => response.json())
      .then((rawdata) => {
        let data = [];
        if (inp != 0) data = filterData(rawdata, inp);
        else data = rawdata;

        // Extract timestamps
        const rawTimestamps = Object.values(data).map((item) => item.ts);

        // Group timestamps into intervals less than 5 seconds
        const groupedTimestamps = groupTimestamps(rawTimestamps, 5000); // 5000 milliseconds (5 seconds)

        // Function to group timestamps
        function groupTimestamps(timestamps, interval) {
          const result = [];
          let currentGroup = [timestamps[0]];

          for (let i = 1; i < timestamps.length; i++) {
            const diff = new Date(timestamps[i]) - new Date(timestamps[i - 1]);

            if (diff < interval) {
              currentGroup.push(timestamps[i]);
            } else {
              result.push(currentGroup);
              currentGroup = [timestamps[i]];
            }
          }

          result.push(currentGroup);
          return result;
        }

        // Function to extract the first timestamp from each group
        const groupedLabels = groupedTimestamps.map((group) => group[0]);

        // Extract unique devices
        const uniqueDevices = [
          ...new Set(Object.values(data).map((item) => item.boardID)),
        ];

        // Function to extract values for a parameter for a specific device
        const extractValuesForDevice = (deviceData, parameter) =>
          deviceData.map((item) => item[parameter]);

        // Create datasets for each unique device (temperature, VOC, and either CO2 or PM values)
        const datasets = uniqueDevices.flatMap((deviceID) => {
          const deviceData = Object.values(data).filter(
            (item) => item.boardID === deviceID
          );

          // Determine the type of the device (assuming all data points have the same type for a given device)
          const deviceType = deviceData[0].type;

          let co2Dataset = null;
          let pm1Dataset = null;
          let pm25Dataset = null;
          let pm10Dataset = null;

          if (deviceType === 4) {
            co2Dataset = {
              label: `${deviceID} - CO2`,
              data: extractValuesForDevice(deviceData, 'co2'),
              borderColor: '#4285F4',
              fill: false,
            };
          } else if (deviceType === 3) {
            pm1Dataset = {
              label: `${deviceID} - PM1`,
              data: extractValuesForDevice(deviceData, 'pm1'),
              borderColor: '#DB4437',
              fill: false,
            };
            pm25Dataset = {
              label: `${deviceID} - PM2.5`,
              data: extractValuesForDevice(deviceData, 'pm25'),
              borderColor: '#F4B400',
              fill: false,
            };
            pm10Dataset = {
              label: `${deviceID} - PM10`,
              data: extractValuesForDevice(deviceData, 'pm10'),
              borderColor: '#0F9D58',
              fill: false,
            };
            // Add datasets for PM25 and PM10 if needed
          }

          return [
            {
              label: `${deviceID} - Temperature`,
              data: extractValuesForDevice(deviceData, 'temp'),
              borderColor: '#273c75',
              fill: false,
            },
            {
              label: `${deviceID} - Humidity`,
              data: extractValuesForDevice(deviceData, 'hum'),
              borderColor: '#8c7ae6',
              fill: false,
            },
            {
              label: `${deviceID} - Pressure`,
              data: extractValuesForDevice(deviceData, 'pressure'),
              borderColor: '#6D214F',
              fill: false,
            },
            {
              label: `${deviceID} - VOC`,
              data: extractValuesForDevice(deviceData, 'voc'),
              borderColor: '#F97F51',
              fill: false,
            },
            co2Dataset,
            pm1Dataset,
            pm25Dataset,
            pm10Dataset,
          ].filter(Boolean); // Remove null values from the array
        });

        // Create Chart.js chart
        const ctx = document.getElementById('myChart').getContext('2d');
        if (myChart != undefined) {
          myChart.destroy();
        }
        myChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: groupedLabels,
            datasets: datasets,
          },
          options: {
            // Configure chart options
          },
        });

        // Function to generate random color
      });
  });
