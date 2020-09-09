require('./init');
const winston = require('winston');
const request = require('request');
const URI = require('urijs');
const fs = require('fs');

// fs.readFile('/home/ally/Desktop/bundle.json', 'utf8', (err, data) => {
//   JSON.parse(data);
//   // winston.error(data.substr(99600, 1000));
// });
const bundle = require('/home/ally/Desktop/bundle.json');
const url = 'http://localhost:8081/gofr_empty/fhir';
const options = {
  url,
  headers: {
    'Content-Type': 'application/json',
  },
  json: bundle,
};
request.post(options, (err, res, body) => {
  winston.error(body);
});
