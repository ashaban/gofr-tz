require('../init');
const winston = require('winston');
const async = require('async');
const uuid5 = require('uuid/v5');
const request = require('request');
const URI = require('urijs');
const express = require('express');
const config = require('../config');
const mcsd = require('../mcsd')();

const router = express.Router();

router.get('/syncVIMS', (req, res) => {
  winston.info("Received a request to synchronize vims facilities")
  const baseURL = config.getConf('vims:baseURL');
  const username = config.getConf('vims:username');
  const password = config.getConf('vims:password');
  const tenancyid = config.getConf('vims:tenancyid');
  let errorOccured = false
  async.parallel([
    (callback) => {
      lookup("facilities", "paging=false", (err, body) => {
        if(err) {
          errorOccured = true
        }
        callback(null, body);
      })
    },
    (callback) => {
      lookup("geographic-zones", null, (err, body) => {
        if(err) {
          errorOccured = true
        }
        callback(null, body);
      })
    },
    (callback) => {
      lookup("facility-types", null, (err, body) => {
        if(err) {
          errorOccured = true
        }
        callback(null, body);
      })
    },
  ],
  (err, results) => {
    var facilities = results[0]
    var zones = results[1]
    var facilitytypes = results[2]
    if (err) {
      winston.error(err)
    }
    try {
      facilities = JSON.parse(facilities)
    } catch (error) {
      logger.error(error);
    }
    try {
      zones = JSON.parse(zones)
    } catch (error) {
      logger.error(error);
    }
    try {
      facilitytypes = JSON.parse(facilitytypes)
    } catch (error) {
      logger.error(error);
    }

    let africa = {
      resourceType: 'Location',
      name: 'Africa',
      id: config.getConf("vims:topOrgId"),
      physicalType: {
        coding: [{
          system: 'http://hl7.org/fhir/location-physical-type',
          code: 'jdn',
          display: 'Jurisdiction',
        }],
        text: 'Jurisdiction',
      }
    }
    const resourceBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: [{
        resource: africa,
        request: {
          method: 'PUT',
          url: `Location/${africa.id}`,
        }
      }],
    };
    async.eachSeries(facilities.facilities, (facility, nextFacility) => {
      if(facility.name === 'Duplicate' || facility.name === 'duplicate') {
        return nextFacility()
      }
      let zonename = searchLookup(zones["geographic-zones"], facility.geographicZoneId)
      let ftype = searchLookup(facilitytypes["facility-types"], facility.typeId)
      facility.zonename = zonename
      facility.facilityType = ftype

      let zoneuuid = uuid5(zonename + 'vimsdistrictname', '843f5bd2-7d2a-4990-8e6e-373bd92605b5')
      let zone = {
        id: zoneuuid,
        resourceType: 'Location',
        name: zonename,
        partOf: {
          reference: `Location/${config.getConf("vims:topOrgId")}`
        }
      }
      let uuid = uuid5(facility.id.toString(), '7ee93e32-78da-4913-82f8-49eb0a618cfc')
      let status = 'active'
      if(!facility.active) {
        status = 'inactive'
      }
      let entry = {
        resourceType: 'Location',
        id: uuid,
        name: facility.name,
        identifier: [{
          type: {
            text: 'id',
          },
          system: 'https://vims.moh.go.tz',
          value: facility.id,
          assigner: {
            display: 'https://vims.moh.go.tz',
          }
        }],
        status: status,
        partOf: {
          reference: `Location/${zone.id}`,
          display: zone.name
        },
        physicalType: {
          coding: [
            {
              system: 'http://hl7.org/fhir/location-physical-type',
              code: 'bu',
              display: 'Building',
            },
          ],
          text: 'Building',
        }
      }
      if(facility.typeId) {
        entry.type = [{
          coding: [{
            system: 'urn:ietf:rfc:3986',
            code: 'urn:ihe:iti:mcsd:2019:facility',
            display: 'Facility',
            userSelected: false,
          }],
        }, {
          coding: [{
            system: 'http://hfrportal.ehealth.go.tz/facilityType',
            code: facility.typeId,
            display: facility.facilityType,
          }],
          text: 'Facility Type',
        }]
      }
      if(facility.code) {
        entry.identifier.push({
          type: {
            text: 'code',
          },
          system: 'https://vims.moh.go.tz',
          value: facility.code,
          assigner: {
            display: 'https://vims.moh.go.tz',
          }
        })
      }
      if(facility.latitude | facility.longitude) {
        entry.position = {}
        if(facility.latitude) {
          entry.position.latitude = facility.latitude
        }
        if(facility.longitude) {
          entry.position.longitude = facility.longitude
        }
      }
      resourceBundle.entry.push({
        resource: zone,
        request: {
          method: 'PUT',
          url: `Location/${zone.id}`,
        },
      }, {
        resource: entry,
        request: {
          method: 'PUT',
          url: `Location/${entry.id}`,
        },
      })
      if (resourceBundle.entry.length >= 250) {
        mcsd.saveLocations(resourceBundle, tenancyid, (err, body) => {
          resourceBundle.entry = []
          if (err) {
            winston.error(err);
            errorOccured = true;
          }
          return nextFacility();
        });
      } else {
        return nextFacility();
      }
    }, () => {
      if (resourceBundle.entry.length > 0) {
        mcsd.saveLocations(resourceBundle, tenancyid, (err, body) => {
          winston.info('Done Synchronizing VIMS Facilities!!!')
          if (err) {
            winston.error(err);
            errorOccured = true;
          }
          if (errorOccured) {
            return res.status(500).send();
          }
          return res.status(200).send();
        });
      } else {
        winston.info('Done Synchronizing VIMS Facilities!!!')
        if (errorOccured) {
          return res.status(500).send();
        }
        return res.status(200).send();
      }
    })
  }
  )

  function lookup (type, query, callback) {
    var url = new URI(baseURL).segment('/rest-api/lookup/' + type)
    if(query) {
      url = url + "?" + query
    }
    const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    let options = {
      url: url.toString(),
      headers: {
        Authorization: auth
      }
    }
    request.get(options, function (err, res, body) {
      return callback(err,body)
    })
  }

  function searchLookup(lookupData, id) {
    let found = lookupData.find((data) => {
      return data.id === id
    })
    if(found) {
      return found.name
    }
    return
  }
})

module.exports = router;