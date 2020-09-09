/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable consistent-return */
require('../init');
const winston = require('winston');
const express = require('express');
const formidable = require('formidable');
const URI = require('urijs');
const async = require('async');
const uuid5 = require('uuid/v5');

const router = express.Router();
const mcsd = require('../mcsd')();
const hfr = require('../hfr')();
const config = require('../config');
const mixin = require('../mixin')();

const topOrgId = config.getConf('mCSD:fakeOrgId');

router.post('/addService', (req, res) => {
  winston.info('Received a request to add a new service');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    mcsd.addService(fields, (error) => {
      if (error) {
        res.status(400).send(error);
      } else {
        winston.info('New Jurisdiction added successfully');
        res.status(200).send();
      }
    });
  });
});
router.post('/addJurisdiction', (req, res) => {
  winston.info('Received a request to add a new Jurisdiction');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const defaultDB = config.getConf('hapi:defaultDBName');
    fields.database = defaultDB;
    mcsd.addJurisdiction(fields, (error, id) => {
      if (error) {
        winston.error(error);
        res.status(500).send(error);
        return;
      }
      const requestsDB = config.getConf('hapi:requestsDBName');
      fields.database = requestsDB;
      fields.id = id;
      mcsd.addJurisdiction(fields, (error) => {
        if (error) {
          winston.error(error);
          res.status(500).send(error);
        } else {
          winston.info('New Jurisdiction added successfully');
          res.status(200).send();
        }
      });
    });
  });
});

router.post('/addBuilding', (req, res) => {
  winston.info('Received a request to add a new Building');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    mcsd.addBuilding(fields, (error) => {
      if (error) {
        res.status(500).send(error);
      } else {
        winston.info('New Building added successfully');
        res.status(200).send();
      }
    });
  });
});

router.post('/changeBuildingRequestStatus', (req, res) => {
  winston.info('Received a request to change building request status');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const {
      id,
      status,
      requestType,
    } = fields;
    mcsd.changeBuildingRequestStatus({
      id,
      status,
      requestType,
    }, (error) => {
      if (error) {
        winston.error('An error has occured while changing request status');
        res.status(500).send(error);
      } else {
        winston.info('Building Request Status Changed Successfully');
        res.status(200).send();
      }
    });
  });
});

router.get('/getLocationNames', (req, res) => {
  const {
    ids,
  } = req.query;
  const names = [];
  async.each(
    ids,
    (id, nxtId) => {
      mcsd.getLocationByID('', id, false, (location) => {
        if (location && location.entry && location.entry.length > 0) {
          names.push({
            id: location.entry[0].resource.id,
            name: location.entry[0].resource.name,
          });
          return nxtId();
        }
        return nxtId();
      });
    },
    () => {
      res.status(200).json(names);
    },
  );
});

router.get('/getServices', (req, res) => {
  winston.info('Received a request to get list of service offered by facilities');
  const {
    id,
    getResource,
  } = req.query;
  const filters = {
    id,
  };

  function getResourceLocationNames(resource, callback) {
    if (!resource || !resource.location || !Array.isArray(resource.location)) {
      return callback(resource);
    }
    async.eachOf(
      resource.location,
      (id, index, nxtId) => {
        mcsd.getLocationByID('', id.reference, false, (location) => {
          if (location && location.entry && location.entry.length > 0) {
            resource.location[index].name = location.entry[0].resource.name;
            return nxtId();
          }
          return nxtId();
        });
      },
      () => {
        callback(resource);
      },
    );
  }

  mcsd.getServices(filters, (mcsdServices) => {
    if (getResource) {
      if (mcsdServices && mcsdServices.entry && mcsdServices.entry.length > 0) {
        getResourceLocationNames(mcsdServices.entry[0].resource, () => res.status(200).json(mcsdServices));
      } else {
        res.status(200).json(mcsdServices);
      }
      return;
    }
    const services = [];
    async.each(mcsdServices.entry, (service, nxtService) => {
      const srv = {};
      srv.id = service.resource.id;
      srv.name = service.resource.name;
      const ident = service.resource.identifier && service.resource.identifier.find(
        identifier => identifier.system === 'https://digitalhealth.intrahealth.org/code',
      );
      if (ident) {
        srv.code = ident.value;
      }
      if (!service.resource.location) {
        srv.locations = 0;
      } else {
        srv.locations = service.resource.location.length;
      }
      srv.type = [];
      if (service.resource.type) {
        service.resource.type.forEach((type) => {
          srv.type.push(type.text);
        });
      }
      if (service.resource.active) {
        srv.active = 'Yes';
      } else {
        srv.active = 'No';
      }
      services.push(srv);
      return nxtService();
    });
    res.status(200).json(services);
  });
});

router.get('/getFacilityMissingFromHFR', (req, res) => {
  winston.info('Received a request to get list of buildings');
  const database = config.getConf('hapi:requestsDBName');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('fhir')
    .segment('Location')
    .addQuery('type', 'urn:ihe:iti:mcsd:2019:facility')
    .toString();
  mcsd.executeURL(url, (buildings) => {
    const buildingsTable = [];
    async.each(buildings.entry, (building, nxtBuilding) => {
      const row = {};
      row.id = building.resource.id;
      row.name = building.resource.name;
      if (building.resource.alias) {
        row.alt_name = building.resource.alias;
      }
      let code;
      if (building.resource.identifier) {
        code = building.resource.identifier.find(
          identifier => identifier.system === 'https://digitalhealth.intrahealth.org/code',
        );
      }
      if (code) {
        row.code = code.value;
      }
      if (building.resource.type) {
        row.type = {};
        building.resource.type.forEach((type) => {
          const coding = type.coding.find(
            coding => coding.system === 'http://hfrportal.ehealth.go.tz/facilityType',
          );
          if (coding) {
            row.type.code = coding.code;
            row.type.text = coding.code;
          }
        });
      }
      if (building.resource.status) {
        row.status = {};
        const {
          status,
        } = building.resource;
        if (status === 'active') {
          row.status.text = 'Functional';
          row.status.code = status;
        } else if (status === 'inactive') {
          row.status.text = 'Not Functional';
          row.status.code = status;
        } else if (status === 'suspended') {
          row.status.text = 'Suspended';
          row.status.code = status;
        }
      }
      if (building.resource.position) {
        if (building.resource.position.latitude) {
          row.lat = building.resource.position.latitude;
        }
        if (building.resource.position.longitude) {
          row.long = building.resource.position.longitude;
        }
      }
      const phone = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'phone');
      if (phone) {
        row.phone = phone.value;
      }
      const email = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'email');
      if (email) {
        row.email = email.value;
      }
      const fax = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'fax');
      if (fax) {
        row.fax = fax.value;
      }
      const website = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'url');
      if (website) {
        row.website = website.value;
      }
      row.description = building.resource.description;
      const adminDiv = building.resource.meta.tag.find(tag => tag.code === 'Admin_div');
      let hfrcode;
      let hfrid;
      for (const identifier of building.resource.identifier) {
        if (identifier.type.text === 'id') {
          hfrid = identifier.value;
        }
        if (identifier.type.text === 'Fac_IDNumber') {
          hfrcode = identifier.value;
        }
      }
      row.hfrcode = hfrcode;
      row.hfrid = hfrid;
      row.parent = adminDiv.display;
      async.series({
        getOrgType: (callback) => {
          row.ownership = {};
          if (
            building.resource.managingOrganization
            && building.resource.managingOrganization.reference
          ) {
            const orgId = building.resource.managingOrganization.reference.split('/').pop();
            mcsd.getOrganizationByID({
              id: orgId,
              database,
            }, (orgDt) => {
              if (orgDt.entry && orgDt.entry.length > 0) {
                if (orgDt.entry[0].resource.type) {
                  orgDt.entry[0].resource.type.forEach((type) => {
                    const coding = type.coding.find(
                      coding => coding.system === 'https://digitalhealth.intrahealth.org/orgType',
                    );
                    if (coding) {
                      row.ownership.code = coding.code;
                      row.ownership.text = coding.display;
                    }
                  });
                  return callback(null);
                }
                return callback(null);
              }
              return callback(null);
            });
          } else {
            return callback(null);
          }
        },
      }, () => {
        buildingsTable.push(row);
        return nxtBuilding();
      });
    }, () => {
      res.status(200).send(buildingsTable);
    });
  });
});

router.get('/getJurisdictionsMissingFromHFR', (req, res) => {
  winston.info('Received a request to get list of buildings');
  const database = config.getConf('hapi:requestsDBName');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('fhir')
    .segment('Location')
    .addQuery('type:not', 'urn:ihe:iti:mcsd:2019:facility')
    .toString();
  mcsd.executeURL(url, (jurisdictions) => {
    const jurisdictionsTable = [];
    async.each(jurisdictions.entry, (jurisdiction, nxtJurisdiction) => {
      const row = {};
      row.id = jurisdiction.resource.id;
      row.name = jurisdiction.resource.name;
      let code;
      if (jurisdiction.resource.identifier) {
        code = jurisdiction.resource.identifier.find(
          identifier => identifier.system === 'http://hfrportal.ehealth.go.tz' && identifier.type.text === 'code',
        );
      }
      if (code) {
        row.code = code.value;
      }
      if (jurisdiction.resource.status) {
        row.status = {};
        const {
          status,
        } = jurisdiction.resource;
        if (status === 'active') {
          row.status.text = 'Functional';
          row.status.code = status;
        } else if (status === 'inactive') {
          row.status.text = 'Not Functional';
          row.status.code = status;
        } else if (status === 'suspended') {
          row.status.text = 'Suspended';
          row.status.code = status;
        }
      }
      const adminDiv = jurisdiction.resource.meta.tag.find(tag => tag.code === 'parentName');
      row.parent = adminDiv.display;
      jurisdictionsTable.push(row);
      return nxtJurisdiction();
    }, () => {
      res.status(200).send(jurisdictionsTable);
    });
  });
});

router.get('/getBuildings', (req, res) => {
  winston.info('Received a ;request to get list of buildings');
  const {
    jurisdiction,
    action,
    requestType,
    requestCategory,
    requestedUser,
  } = req.query;
  let database;
  if (action === 'request' && requestCategory === 'requestsList') {
    database = config.getConf('hapi:requestsDBName');
  }
  const filters = {
    parent: jurisdiction,
    database,
    action,
    requestType,
  };
  mcsd.getBuildings(filters, (err, buildings) => {
    if (err) {
      res.status(500).send(err);
    } else {
      winston.info('Returning a list of facilities');
      const buildingsTable = [];
      async.each(buildings, (building, nxtBuilding) => {
        let requestExtension;
        if (action === 'request'
          && (requestCategory === 'requestsList' || requestedUser)
          && (!building.resource.extension || !Array.isArray(building.resource.extension))) {
          return nxtBuilding();
        }
        if (action === 'request' && requestType === 'add' && requestCategory === 'requestsList') {
          requestExtension = mixin.getLatestFacilityRequest(building.resource.extension, 'add', requestedUser);
          if (!requestExtension) {
            return nxtBuilding();
          }
        }
        if (action === 'request' && requestType === 'update' && requestCategory === 'requestsList') {
          requestExtension = mixin.getLatestFacilityRequest(building.resource.extension, 'update', requestedUser);
          if (!requestExtension) {
            return nxtBuilding();
          }
        }
        const row = {};
        row.id = building.resource.id;
        row.name = building.resource.name;
        if (building.resource.alias) {
          row.alt_name = building.resource.alias;
        }
        let code;
        if (building.resource.identifier) {
          code = building.resource.identifier.find(
            identifier => identifier.system === 'https://digitalhealth.intrahealth.org/code',
          );
        }
        if (code) {
          row.code = code.value;
        }
        if (building.resource.type) {
          row.type = {};
          building.resource.type.forEach((type) => {
            const coding = type.coding.find(
              coding => coding.system === 'http://hfrportal.ehealth.go.tz/facilityType',
            );
            if (coding) {
              row.type.code = coding.code;
              row.type.text = coding.code;
            }
          });
        }
        if (building.resource.status) {
          row.status = {};
          const {
            status,
          } = building.resource;
          if (status === 'active') {
            row.status.text = 'Functional';
            row.status.code = status;
          } else if (status === 'inactive') {
            row.status.text = 'Not Functional';
            row.status.code = status;
          } else if (status === 'suspended') {
            row.status.text = 'Suspended';
            row.status.code = status;
          }
        }
        if (building.resource.position) {
          if (building.resource.position.latitude) {
            row.lat = building.resource.position.latitude;
          }
          if (building.resource.position.longitude) {
            row.long = building.resource.position.longitude;
          }
        }
        const phone = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'phone');
        if (phone) {
          row.phone = phone.value;
        }
        const email = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'email');
        if (email) {
          row.email = email.value;
        }
        const fax = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'fax');
        if (fax) {
          row.fax = fax.value;
        }
        const website = building.resource.telecom && building.resource.telecom.find(telecom => telecom.system === 'url');
        if (website) {
          row.website = website.value;
        }
        row.description = building.resource.description;
        if (action === 'request' && requestExtension) {
          const status = requestExtension.find(ext => ext.url === 'status');
          row.requestStatus = mixin.toTitleCaseSpace(status.valueString);
        }
        row.parent = {};
        async.series({
          getParent: (callback) => {
            if (building.resource.partOf) {
              row.parent.id = building.resource.partOf.reference.split('/').pop();
              row.parent.name = building.resource.partOf.display;
              mcsd.getLocationByID(database, row.parent.id, false, (parDt) => {
                if (parDt.entry && parDt.entry.length > 0) {
                  row.parent.name = parDt.entry[0].resource.name;
                }
                return callback(null);
              });
            } else {
              return callback(null);
            }
          },
          getOrgType: (callback) => {
            row.ownership = {};
            if (
              building.resource.managingOrganization
              && building.resource.managingOrganization.reference
            ) {
              const orgId = building.resource.managingOrganization.reference.split('/').pop();
              mcsd.getOrganizationByID({
                id: orgId,
                database,
              }, (orgDt) => {
                if (orgDt.entry && orgDt.entry.length > 0) {
                  if (orgDt.entry[0].resource.type) {
                    orgDt.entry[0].resource.type.forEach((type) => {
                      const coding = type.coding.find(
                        coding => coding.system === 'https://digitalhealth.intrahealth.org/orgType',
                      );
                      if (coding) {
                        row.ownership.code = coding.code;
                        row.ownership.text = coding.display;
                      }
                    });
                    return callback(null);
                  }
                  return callback(null);
                }
                return callback(null);
              });
            } else {
              return callback(null);
            }
          },
        }, () => {
          buildingsTable.push(row);
          return nxtBuilding();
        });
      }, () => {
        res.status(200).send(buildingsTable);
      });
    }
  });
});

router.post('/addFromHFR', (req, res) => {
  winston.info('Received a request to add HFR');
  let errorOccured = false;
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields) => {
    const { id, parent } = fields;
    const database = config.getConf('hapi:requestsDBName');
    mcsd.getLocationByID(database, id, false, (location) => {
      let deletedIndex = 0;
      const total = location.entry[0].resource.meta.tag.length;
      for (let index = 0; index < total; index++) {
        if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'Admin_div') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentName') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentID') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'details') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
        }
        deletedIndex += 1;
      }
      location.entry[0].resource.partOf = {
        reference: `Location/${parent}`,
      };
      const bundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [{
          resource: location.entry[0].resource,
          request: {
            method: 'PUT',
            url: `Location/${id}`,
          },
        }],
      };
      mcsd.saveLocations(bundle, '', (err, body) => {
        winston.error(JSON.stringify(bundle, 0, 2));
        if (err) {
          winston.error(err);
          errorOccured = true;
          return res.status(500).send();
        }
        winston.info('Location saved successfully');
        winston.info('Deleting location from HFR cache');
        mcsd.deleteResource({
          database,
          resource: 'Location',
          id,
        }, () => {
          winston.info('Delete operation completed');
          res.status(201).send();
        });
      });
    });
  });
});

router.post('/addCodeSystem', (req, res) => {
  winston.info('Received a request to add code system');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    mcsd.addCodeSystem(fields, (error) => {
      if (error) {
        res.status(500).send(error);
      } else {
        winston.info('New code system added successfully');
        res.status(200).send();
      }
    });
  });
});

router.get('/getCodeSystem', (req, res) => {
  winston.info('Received a request to get code system');
  const {
    codeSystemType,
  } = req.query;
  const codeSyst = mixin.getCodesysteURI(codeSystemType);
  let codeSystemURI;
  if (codeSyst) {
    codeSystemURI = codeSyst.uri;
  } else {
    winston.warn(`Codesystem URI ${codeSystemType} was not found on the configuration`);
    return res.status(401).send();
  }
  mcsd.getCodeSystem({
    codeSystemURI,
  },
  (codeSystem) => {
    let codeSystemResource = [];
    if (codeSystem.entry.length > 0 && codeSystem.entry[0].resource.concept) {
      codeSystemResource = codeSystem.entry[0].resource.concept;
    }
    res.status(200).send(codeSystemResource);
  });
});

router.get('/getTree', (req, res) => {
  winston.info('Received a request to get location tree');
  let {
    sourceLimitOrgId,
    includeBuilding,
    recursive,
  } = req.query;
  if (!sourceLimitOrgId) {
    sourceLimitOrgId = topOrgId;
  }
  if (includeBuilding && typeof includeBuilding === 'string') {
    includeBuilding = JSON.parse(includeBuilding);
  }
  if (recursive && typeof recursive === 'string') {
    recursive = JSON.parse(recursive);
  }
  winston.info('Fetching FR Locations');
  async.parallel({
    locationChildren(callback) {
      mcsd.getLocationChildren({
        parent: sourceLimitOrgId,
        recursive,
      },
      (mcsdData) => {
        winston.info('Done Fetching FR Locations');
        return callback(false, mcsdData);
      });
    },
    parentDetails(callback) {
      if (sourceLimitOrgId === topOrgId) {
        return callback(false, false);
      }
      mcsd.getLocationByID('', sourceLimitOrgId, false, details => callback(false, details));
    },
  }, (error, response) => {
    winston.info('Creating FR Tree');
    mcsd.createTree(response.locationChildren, sourceLimitOrgId, includeBuilding, recursive, (tree) => {
      if (sourceLimitOrgId !== topOrgId && response.parentDetails.entry && recursive) {
        tree = {
          text: response.parentDetails.entry[0].resource.name,
          id: sourceLimitOrgId,
          children: tree,
        };
      }
      winston.info('Done Creating FR Tree');
      res.status(200).json(tree);
    });
  });
});

router.get('/syncHFRFacilities', (req, res) => {
  let errorOccured = false;
  const database = config.getConf('hapi:requestsDBName');
  winston.info('Getting facilities from HFR');
  hfr.getFacilities((facilities) => {
    winston.info(`Received ${facilities.length} from HFR`);
    const fhir = {};
    fhir.entry = [];
    fhir.type = 'batch';
    fhir.resourceType = 'Bundle';
    async.eachSeries(facilities, (facility, nxtFacility) => {
      const identifier = `http://hfrportal.ehealth.go.tz|${facility.id}`;
      mcsd.getLocationByIdentifier('', identifier, (fhirLocation) => {
        if (fhirLocation.entry.length === 0) {
          winston.info(`Facility ${facility.name} missing, adding request`);
          const building = {
            id: uuid5(facility.id.toString(), '7ee93e32-78da-4913-82f8-49eb0a618cfc'),
            resourceType: 'Location',
            meta: {
              tag: [{
                code: 'Admin_div',
                display: facility.properties.Admin_div,
              }],
              profile: [
                'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_Location',
                'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_FacilityLocation',
              ],
            },
            name: facility.name,
            identifier: [{
              type: {
                text: 'id',
              },
              system: 'http://hfrportal.ehealth.go.tz',
              value: facility.id,
              assigner: {
                display: 'http://hfrportal.ehealth.go.tz',
              },
            }, {
              type: {
                text: 'Fac_IDNumber',
              },
              system: 'http://hfrportal.ehealth.go.tz',
              value: facility.properties.Fac_IDNumber,
              assigner: {
                display: 'http://hfrportal.ehealth.go.tz',
              },
            }],
            type: [{
              coding: [{
                system: 'urn:ietf:rfc:3986',
                code: 'urn:ihe:iti:mcsd:2019:facility',
                display: 'Facility',
                userSelected: false,
              }, {
                coding: [{
                  system: 'http://hfrportal.ehealth.go.tz/facilityType',
                  code: facility.properties.Fac_Type,
                }],
                text: 'Facility Type',
              }],
            }],
            physicalType: {
              coding: [
                {
                  system: 'http://hl7.org/fhir/location-physical-type',
                  code: 'bu',
                  display: 'Building',
                },
              ],
              text: 'Building',
            },
          };
          if (facility.lat || facility.long) {
            building.position = {
              latitude: facility.lat,
              longitude: facility.long,
            };
          }
          if (facility.properties.OperatingStatus === 'Operating') {
            building.status = 'active';
          } else {
            building.status = 'inactive';
          }
          fhir.entry.push({
            resource: building,
            request: {
              method: 'PUT',
              url: `Location/${building.id}`,
            },
          });
        }
        if (fhir.entry.length >= 250) {
          mcsd.saveLocations(fhir, database, (err, body) => {
            if (err) {
              winston.error(err);
              errorOccured = true;
            }
            return nxtFacility();
          });
        } else {
          return nxtFacility();
        }
      });
    }, () => {
      if (fhir.entry.length > 0) {
        mcsd.saveLocations(fhir, database, (err, body) => {
          winston.info('HFR Sync is done');
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
        winston.info('HFR Sync is done');
        if (errorOccured) {
          return res.status(500).send();
        }
        return res.status(200).send();
      }
    });
  });
});

router.get('/syncHFRAdminAreas', (req, res) => {
  let errorOccured = false;
  const reqDB = config.getConf('hapi:requestsDBName');
  const database = config.getConf('hapi:defaultDBName');
  winston.info('Getting facilities from HFR');
  hfr.getAdminAreas((err, adminAreas) => {
    if (err) {
      errorOccured = true;
      return res.status(500).send();
    }
    winston.info(`Received ${adminAreas.length} Admin Areas from HFR`);
    const fhir = {};
    fhir.entry = [];
    fhir.type = 'batch';
    fhir.resourceType = 'Bundle';
    async.eachSeries(adminAreas, (adminArea, nxtAdmArea) => {
      const identifier = `http://hfrportal.ehealth.go.tz|${adminArea.id}`;
      const url = URI(config.getConf('mCSD:url'))
        .segment(database)
        .segment('fhir')
        .segment('Location')
        .addQuery('identifier', identifier)
        .addQuery('_include', 'Location:partof')
        .toString();
      mcsd.executeURL(url, (fhirLocation) => {
        if (fhirLocation.entry.length === 0) {
          winston.info(`${adminArea.name} Missing`);
          const jurisdiction = buildJurisdiction(adminArea, 'new');
          fhir.entry.push({
            resource: jurisdiction,
            request: {
              method: 'PUT',
              url: `Location/${jurisdiction.id}`,
            },
          });
        } else if (fhirLocation.entry.length === 2) {
          const parentJur = fhirLocation.entry.find(entry => entry.search.mode === 'include');
          const parIdentifier = parentJur.resource.identifier.find(ident => ident.type && ident.type.text === 'code');
          if (parIdentifier && parIdentifier.value !== adminArea.parentID) {
            winston.info(`${adminArea.name} Parent Changed`);
            const jurisdiction = buildJurisdiction(adminArea, 'parentChanged', parentJur.resource.id);
            fhir.entry.push({
              resource: jurisdiction,
              request: {
                method: 'PUT',
                url: `Location/${jurisdiction.id}`,
              },
            });
          }
        }
        if (fhir.entry.length >= 250) {
          mcsd.saveLocations(fhir, reqDB, (err, body) => {
            if (err) {
              winston.error(err);
              errorOccured = true;
            }
            return nxtAdmArea();
          });
        } else {
          return nxtAdmArea();
        }
      });
    }, () => {
      if (fhir.entry.length > 0) {
        mcsd.saveLocations(fhir, reqDB, (err, body) => {
          winston.info('HFR Sync is done');
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
        winston.info('HFR Sync is done');
        if (errorOccured) {
          return res.status(500).send();
        }
        return res.status(200).send();
      }
    });

    function buildJurisdiction(adminArea, tagDetails, id) {
      if (!id) {
        id = uuid5(adminArea.id.toString(), '7ee93e32-78da-4913-82f8-49eb0a618cfc');
      }
      const level = adminArea.id.split('.').length - 1;
      const jurisdiction = {
        id,
        resourceType: 'Location',
        meta: {
          tag: [{
            code: 'details',
            display: tagDetails,
          }, {
            code: 'parentName',
            display: adminArea.parentName,
          }, {
            code: 'parentID',
            display: adminArea.parentID,
          }],
          profile: [
            'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_Location',
          ],
        },
        name: adminArea.name,
        identifier: [{
          type: {
            text: 'code',
          },
          system: 'http://hfrportal.ehealth.go.tz',
          value: adminArea.id,
          assigner: {
            display: 'http://hfrportal.ehealth.go.tz',
          },
        }, {
          type: {
            text: 'entityID',
          },
          system: 'urn:ihe:iti:csd:2013:entityID',
          value: id,
        }],
        status: 'active',
        type: [
          {
            coding: [
              {
                system: '2.25.123494412831734081331965080571820180508',
                code: level,
              },
            ],
          },
        ],
        physicalType: {
          coding: [
            {
              system: 'http://hl7.org/fhir/location-physical-type',
              code: 'jdn',
              display: 'Jurisdiction',
            },
          ],
          text: 'Jurisdiction',
        },
      };
      return jurisdiction;
    }
  });
});

module.exports = router;
