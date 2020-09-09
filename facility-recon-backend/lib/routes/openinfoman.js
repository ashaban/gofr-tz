require('../init');
const winston = require('winston');
const async = require('async');
const request = require('request');
const URI = require('urijs');
const express = require('express');
const config = require('../config');
const mcsd = require('../mcsd')();

const router = express.Router();

router.get('/syncOIM', (req, res) => {
  const baseURL = config.getConf('openinfoman:baseURL');
  const username = config.getConf('openinfoman:username');
  const password = config.getConf('openinfoman:password');
  const oimdoc = config.getConf('openinfoman:registryDoc');
  winston.info('Received a request to sync FHIR server with OIM');
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const url = URI(baseURL).segment(oimdoc).segment('mcsd').segment('Location')
    .toString();
  const options = {
    url,
    headers: {
      Authorization: auth,
    },
  };
  request.get(options, (err, res, body) => {
    try {
      body = JSON.parse(body);
    } catch (error) {
      throw error;
    }
    const resourceBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [],
    };
    async.eachSeries(body.entry, (entry, nxtEntry) => {
      if (entry.resource.name === 'Tanzania') {
        entry.resource.partOf = {};
        entry.resource.partOf.reference = `Location/${config.getConf('mCSD:fakeOrgId')}`;
      }
      resourceBundle.entry.push(entry);
      if (resourceBundle.entry.length >= 250) {
        winston.info('Saving updates into FHIR server');
        mcsd.saveLocations(resourceBundle, '', () => {
          winston.info('Saved');
          resourceBundle.entry = [];
          return nxtEntry();
        });
      } else {
        return nxtEntry();
      }
    }, () => {
      if (resourceBundle.entry.length > 0) {
        winston.info('Saving updates into FHIR server');
        mcsd.saveLocations(resourceBundle, '', () => {
          winston.info('Done');
        });
      } else {
        winston.info('Done');
      }
    });
  });
});

module.exports = router;
