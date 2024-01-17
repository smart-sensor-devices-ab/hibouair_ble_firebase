import * as my_dongle from 'bleuio';
// Import the functions you need from the SDKs you need
//import { initializeApp } from "firebase/app";
import 'firebase/database';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
function getUrlParams() {
  const urlParams = {};
  const queryString = window.location.search.substring(1);
  const params = queryString.split('&');

  for (const param of params) {
    const pair = param.split('=');
    const key = decodeURIComponent(pair[0]);
    const value = decodeURIComponent(pair[1]);

    // Store the key-value pairs in the urlParams object
    urlParams[key] = value;
  }

  return urlParams;
}
const urlParams = getUrlParams();
// Your web app's Firebase configuration
const thefirebaseConfig = {
  apiKey: urlParams.apiKey,
  authDomain: urlParams.authDomain,
  projectId: urlParams.projectId,
  storageBucket: urlParams.storageBucket,
  messagingSenderId: urlParams.messagingSenderId,
  appId: urlParams.appId,
  ref: urlParams.ref,
  databaseURL: urlParams.databaseurl,
};

console.log(thefirebaseConfig);
// Initialize Firebase
firebase.initializeApp(thefirebaseConfig);

document.getElementById('connect').addEventListener('click', function () {
  my_dongle.at_connect().then(() => {
    document.getElementById('connect').style.display = 'none';
    document.getElementById('sendDataTCloudBtn').style.display = 'inline-block';
    document.getElementById('stopSendingData').style.display = 'inline-block';
    my_dongle.at_central();
  });
});

const parseSensorData = (data) => {
  let pos = data.indexOf('5B0705');
  let dt = new Date();
  let currentTs =
    dt.getFullYear() +
    '/' +
    (dt.getMonth() + 1).toString().padStart(2, '0') +
    '/' +
    dt.getDate().toString().padStart(2, '0') +
    ' ' +
    dt.getHours().toString().padStart(2, '0') +
    ':' +
    dt.getMinutes().toString().padStart(2, '0') +
    ':' +
    dt.getSeconds().toString().padStart(2, '0');
  let tempHex = parseInt(
    '0x' +
      data
        .substr(pos + 22, 4)
        .match(/../g)
        .reverse()
        .join('')
  );
  if (tempHex > 1000) tempHex = (tempHex - (65535 + 1)) / 10;
  else tempHex = tempHex / 10;
  return {
    boardID: data.substr(pos + 8, 6),
    type: parseInt('0x' + data.substr(pos + 6, 2)),
    noise: -parseInt('0x' + data.substr(pos + 14, 4)),

    pressure:
      parseInt(
        '0x' +
          data
            .substr(pos + 18, 4)
            .match(/../g)
            .reverse()
            .join('')
      ) / 10,
    temp: tempHex,
    hum:
      parseInt(
        '0x' +
          data
            .substr(pos + 26, 4)
            .match(/../g)
            .reverse()
            .join('')
      ) / 10,
    voc: parseInt(
      '0x' +
        data
          .substr(pos + 30, 4)
          .match(/../g)
          .reverse()
          .join('')
    ),
    pm1:
      parseInt(
        '0x' +
          data
            .substr(pos + 34, 4)
            .match(/../g)
            .reverse()
            .join('')
      ) / 10,
    pm25:
      parseInt(
        '0x' +
          data
            .substr(pos + 38, 4)
            .match(/../g)
            .reverse()
            .join('')
      ) / 10,
    pm10:
      parseInt(
        '0x' +
          data
            .substr(pos + 42, 4)
            .match(/../g)
            .reverse()
            .join('')
      ) / 10,
    co2: parseInt('0x' + data.substr(pos + 46, 4)),
    //"vocType":parseInt('0x'+data.substr(pos+50,2)),
    advData: data,
    ts: currentTs,
  };
};

let i = 1;
var ref;
const sendDataToCloud = async () => {
  my_dongle.at_findscandata('5B07050', 5).then(async (data) => {
    let theAdvData = data.filter((element) => element.includes('ADV'));
    if (theAdvData && theAdvData.length > 0) {
      //console.log('theAdvData', theAdvData);
      const uniqueDeviceMacAddresses = new Set();
      try {
        ref = firebase.database().ref(thefirebaseConfig.ref);
      } catch (error) {
        console.error(error);
      }

      for (const item of theAdvData) {
        const match = item.match(/\[([^\]]+)\]/);
        if (match) {
          const deviceMacAddress = match[1];

          if (!uniqueDeviceMacAddresses.has(deviceMacAddress)) {
            uniqueDeviceMacAddresses.add(deviceMacAddress);

            // Splitting the string and extracting the last part
            const parts = item.split(' ');
            const lastPart = parts[parts.length - 1];

            // Pushing to Firebase with a delay
            await new Promise((resolve) => {
              setTimeout(() => {
                try {
                  ref.push(parseSensorData(lastPart));
                  console.log(parseSensorData(lastPart));
                  if (i == 15) {
                    document.getElementById('log').innerHTML = '';
                    i = 1;
                  } else {
                    document.getElementById('log').innerHTML +=
                      '<br/>' + JSON.stringify(parseSensorData(lastPart));
                  }
                } catch (error) {
                  console.log(error);
                  document.getElementById('log').innerHTML =
                    'Could not send data to the cloud. Make sure Firebase configurations are correct.';
                }
                i++;

                resolve();
              }, 1000);
            });
          }
        }
      }
    }
  });
};
var intervalId;
document
  .getElementById('sendDataTCloudBtn')
  .addEventListener('click', function () {
    sendDataToCloud();
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(sendDataToCloud, 15000);
    document.getElementById('log').innerHTML =
      'Sending data to cloud. Click stop sending data to stop the process.';
  });
document
  .getElementById('stopSendingData')
  .addEventListener('click', function () {
    clearInterval(intervalId);
    document.getElementById('log').innerHTML = 'Sending data stopped.';
  });
