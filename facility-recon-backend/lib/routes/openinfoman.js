require('../init');
const winston = require('winston');
const async = require('async');
const request = require('request');
const URI = require('urijs');
const express = require('express');
const config = require('../config');

const mixin = require('../mixin')();
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
  let facilityTypes = [];
  mcsd.getCodeSystem({
    id: 'hfr-facility-types',
  }, (facTypes) => {
    facilityTypes = facTypes;
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
        for (const tpIndex in entry.resource.type) {
          const type = entry.resource.type[tpIndex];
          for (const cdIndex in type.coding) {
            const coding = type.coding[cdIndex];
            if (coding.system === 'http://hfrportal.ehealth.go.tz/facilityType') {
              const display = mixin.getCodeSystemDisplay(coding.code, facilityTypes.entry[0].resource.concept);
              entry.resource.type[tpIndex].coding[cdIndex].display = display;
            }
          }
        }
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
});

module.exports = router;
