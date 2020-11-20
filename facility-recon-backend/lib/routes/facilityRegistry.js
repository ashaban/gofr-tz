/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable consistent-return */
require('../init');
const winston = require('winston');
const express = require('express');
const formidable = require('formidable');
const URI = require('urijs');
const async = require('async');
const lodash = require('lodash');
const uuid5 = require('uuid/v5');
const uuid4 = require('uuid/v4');

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
    const defaultDB = config.getConf('hfr:tenancyid');
    fields.database = defaultDB;
    mcsd.addJurisdiction(fields, (error, id) => {
      if (error) {
        winston.error(error);
        res.status(500).send(error);
        return;
      }
      winston.info('New Jurisdiction added successfully');
      res.status(200).send();
    });
  });
});

router.post('/updateJurisdiction', (req, res) => {
  winston.info('Received a request to update a new Jurisdiction');
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields, files) => {
    const defaultDB = config.getConf('hfr:tenancyid');
    const url = URI(config.getConf('mCSD:url'))
      .segment(defaultDB)
      .segment('Location')
      .segment(fields.id)
      .toString();
    mcsd.executeURL(url, (jurResource) => {
      jurResource.name = fields.name
      jurResource.partOf.reference = 'Location/' + fields.parent
      for(let index in jurResource.identifier) {
        let ident = jurResource.identifier[index]
        if(ident.system === "http://hfrportal.ehealth.go.tz" && ident.type.text === "code") {
          jurResource.identifier[index].value = fields.code.replace(/\s+/g, ' ').trim();
        }
      }
      let codeLength = fields.code.split('.').length;
      let level = codeLength - 1;
      for(let typIndex in jurResource.type) {
        let type = jurResource.type[typIndex];
        for(let codIndex in type.coding) {
          if(type.coding[codIndex].system === '2.25.123494412831734081331965080571820180508') {
            jurResource.type[typIndex].coding[codIndex].code = level
          }
        }
      }
      const fhir = {};
      fhir.entry = [];
      fhir.type = 'batch';
      fhir.resourceType = 'Bundle';
      fhir.entry.push({
        resource: jurResource,
        request: {
          method: 'PUT',
          url: `Location/${jurResource.id}`,
        },
      })
      if(level === 4) {
        let DVSResources = mixin.generateDVS(fields.name, jurResource.id);
        fhir.entry = fhir.entry.concat(DVSResources);
      }
      mcsd.saveLocations(fhir, '', (err, body) => {
        if (err) {
          winston.error(err);
          errorOccured = true;
          return res.status(500).send();
        }
        winston.info('Jurisdiction updated successfully');
        return res.status(200).send();
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

router.get('/getLocationByID/:id', (req, res) => {
  winston.info('Received a request to get location by id')
  const id = req.params.id;
  mcsd.getLocationByID('', id, false, (location) => {
    if (location && location.entry && location.entry.length > 0) {
      parseLocationResource(location.entry[0], config.getConf('hfr:tenancyid'), (data) => {
        return res.json(data)
      });
    } else {
      winston.info('Location with ID ' + id + ' not found')
      return res.status(404).send();
    }
  });
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
  const database = config.getConf('updaterequests:tenancyid');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('Location')
    .addQuery('type', 'urn:ihe:iti:mcsd:2019:facility')
    .addQuery('_tag', 'NewFacility')
    .toString();
  mcsd.executeURL(url, (buildings) => {
    const buildingsTable = [];
    async.each(buildings.entry, (building, nxtBuilding) => {
      parseLocationResource(building, database, (row) => {
        buildingsTable.push(row);
        return nxtBuilding();
      });
    }, () => {
      res.status(200).send(buildingsTable);
    });
  });
});

router.get('/getFacilityUpdatedFromHFR', (req, res) => {
  winston.info('Received a request to get list of buildings updated in HFR');
  const database = config.getConf('updaterequests:tenancyid');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('Location')
    .addQuery('type', 'urn:ihe:iti:mcsd:2019:facility')
    .addQuery('_tag', 'UpdatedFacility')
    .toString();
  mcsd.executeURL(url, (buildings) => {
    const buildingsTable = [];
    async.each(buildings.entry, (building, nxtBuilding) => {
      parseLocationResource(building, database, (row) => {
        let ouidtag = building.resource.meta.tag.find((tag) => {
          return tag.display === 'Original UUID'
        })
        row.ouuid = ouidtag.code
        buildingsTable.push(row);
        return nxtBuilding();
      });
    }, () => {
      res.status(200).send(buildingsTable);
    });
  });
});

router.get('/getJurisdictionsMissingFromHFR', (req, res) => {
  winston.info('Received a request to get HFR missing jurisdictions');
  const database = config.getConf('updaterequests:tenancyid');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('Location')
    .addQuery('type:not', 'urn:ihe:iti:mcsd:2019:facility')
    .addQuery('_tag', 'NewJurisdiction')
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

router.get('/getJurisdictionsUpdatedFromHFR', (req, res) => {
  winston.info('Received a request to get HFR updated jurisdictions');
  const database = config.getConf('updaterequests:tenancyid');
  const url = URI(config.getConf('mCSD:url'))
    .segment(database)
    .segment('Location')
    .addQuery('type:not', 'urn:ihe:iti:mcsd:2019:facility')
    .addQuery('_tag', 'UpdatedJurisdiction')
    .toString();
  mcsd.executeURL(url, (jurisdictions) => {
    const jurisdictionsTable = [];
    async.each(jurisdictions.entry, (jurisdiction, nxtJurisdiction) => {
      const row = {};
      let ouidtag = jurisdiction.resource.meta.tag.find((tag) => {
        return tag.display === 'Original UUID'
      })
      row.ouuid = ouidtag.code
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
      const adminDiv = jurisdiction.resource.meta && jurisdiction.resource.meta.tag.find(tag => tag.code === 'parentName');
      if(adminDiv) {
        row.parent = adminDiv.display;
      }
      if(row.name) {
        jurisdictionsTable.push(row);
      }
      return nxtJurisdiction();
    }, () => {
      res.status(200).send(jurisdictionsTable);
    });
  });
});

router.get('/getBuildings', (req, res) => {
  winston.info('Received a request to get list of buildings');
  let {
    jurisdiction,
    action,
    requestType,
    requestCategory,
    requestedUser,
    onlyDVS
  } = req.query;
  try {
    onlyDVS = JSON.parse(onlyDVS)
  } catch (error) {
    onlyDVS = false
  }
  let database;
  if (action === 'request' && requestCategory === 'requestsList') {
    database = config.getConf('updaterequests:tenancyid');
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
        let isDVS = building.resource.type.find((type) => {
          return type.coding.find((coding) => {
            return coding.system === 'http://hfrportal.ehealth.go.tz/facilityType' && coding.code === 'DVS'
          })
        })
        if(onlyDVS === true && !isDVS) {
          return nxtBuilding()
        }
        if(onlyDVS === false && isDVS) {
          return nxtBuilding()
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
            identifier => identifier.system === 'http://hfrportal.ehealth.go.tz' && identifier.type.text === 'Fac_IDNumber'
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
              row.type.text = coding.display;
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

router.get('/getJurisdictions', (req, res) => {
  winston.info("Received a request to get jurisdictions list")
  const { jurisdiction } = req.query;
  const dbName = config.getConf('hfr:tenancyid');
  mcsd.getLocationChildren({
    parent: jurisdiction
  }, (jurisdictions) => {
    const rows = []
    async.each(jurisdictions.entry, (jur, nxtJur) => {
      let isJurisdiction = false;
      for(let coding of jur.resource.physicalType.coding) {
        if(coding.code === 'jdn') {
          isJurisdiction = true;
        }
      }
      if(!isJurisdiction) {
        return nxtJur();
      }
      parseLocationResource(jur, dbName, (row) => {
        rows.push(row)
        return nxtJur()
      })
    }, () => {
      winston.info("Returning " + rows.length + " jursdictions")
      return res.status(200).json(rows);
    })
  })
});

router.post('/updateFromHFR', (req, res) => {
  winston.info('Received a request to update HFR');
  const bundle = {
    resourceType: 'Bundle',
    type: 'batch',
    entry: [],
  };
  let errorOccured = false;
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields) => {
    const { id, ouuid, parent, parentLevel } = fields;
    const reqDB = config.getConf('updaterequests:tenancyid');
    let originalResource = {}
    let hfrResource = {}
    async.series({
      original: (callback) => {
        const dbName = config.getConf('hfr:tenancyid');
        mcsd.getLocationByID(dbName, ouuid, false, (location) => {
          originalResource = location.entry[0]
          return callback(null);
        })
      },
      hfr: (callback) => {
        mcsd.getLocationByID(reqDB, id, false, (location) => {
          let deletedIndex = 0;
          let total = location.entry[0].resource.meta.tag.length;
          for (let index = 0; index < total; index++) {
            if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'Admin_div') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentName') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentID') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'details') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'NewFacility') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'UpdatedFacility') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'NewJurisdiction') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'UpdatedJurisdiction') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            } else if (location.entry[0].resource.meta.tag[index - deletedIndex].display === 'Original UUID') {
              location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            }
          }

          deletedIndex = 0;
          total = location.entry[0].resource.extension.length;
          for (let index = 0; index < total; index++) {
            if (location.entry[0].resource.extension[index - deletedIndex].url === 'Admin_div') {
              location.entry[0].resource.extension.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            }else if (location.entry[0].resource.extension[index - deletedIndex].url === 'parentName') {
              location.entry[0].resource.extension.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            }else if (location.entry[0].resource.extension[index - deletedIndex].url === 'parentID') {
              location.entry[0].resource.extension.splice(index - deletedIndex, 1);
              deletedIndex += 1;
            }
          }
          hfrResource = location.entry[0];
          return callback(null);
        })
      },
      checkDVS: (callback) => {
        winston.info('Checking if DVS should be created')
        let originalLevel
        for(let type of originalResource.resource.type) {
          for(let coding of type.coding) {
            if(coding.system === '2.25.123494412831734081331965080571820180508') {
              originalLevel = coding.code
            }
          }
        }
        // if level is 3 then check if DVS doesnt exist and create
        if(originalLevel !== (parseInt(parentLevel) + 1) && parseInt(parentLevel) === 3) {
          winston.info('Creating DVS')
          let database = config.getConf('hfr:tenancyid')
          let url = URI(config.getConf('mCSD:url'))
            .segment(database)
            .segment('Location')
            .addQuery('partof', originalResource.resource.id)
            .addQuery('type', 'DVS')
            .toString();
          mcsd.executeURL(url, (fhirDVS) => {
            if(fhirDVS.entry.length === 0) {
              let DVSResources = mixin.generateDVS(hfrResource.resource.name, originalResource.resource.id);
              bundle.entry = bundle.entry.concat(DVSResources)
            } else {
              winston.info('DVS exists, not creating')
            }
            return callback(null);
          })
        } else {
          winston.info('No need of creating DVS')
          return callback(null);
        }
      }
    }, () => {
      let originalID = originalResource.resource.id
      originalResource = lodash.merge(originalResource, hfrResource);
      originalResource.resource.id = originalID

      let isFacility = originalResource.resource.type.find((typ) => {
        return typ.coding && typ.coding.find((coding) => {
          return coding.code === 'urn:ihe:iti:mcsd:2019:facility'
        })
      })
      let parentID = parent
      if(!parent) {
        parentID = originalResource.resource.partOf.reference.split('/')[1]
      }
      getDVS(isFacility, parentID, (dvs) => {
        if(dvs) {
          if(!originalResource.resource.extension) {
            location.entry[0].resource.extension = []
          }
          for(let index in originalResource.resource.extension) {
            if(originalResource.resource.extension[index].url === 'DistrictVaccineStore') {
              originalResource.resource.extension.splice(index, 1)
            }
          }
          originalResource.resource.extension.push({
            url: 'DistrictVaccineStore',
            valueReference: {
              reference: `Location/${dvs.entry[0].resource.id}`
            }
          })
        }
        if(parent) {
          originalResource.resource.partOf = {
            reference: `Location/${parent}`,
          };
        }
        if(parentLevel) {
          originalResource.resource.type = [{
            coding: [{
              system: '2.25.123494412831734081331965080571820180508',
              code: parseInt(parentLevel) + 1,
            }],
          }];
        }
        bundle.entry.push({
          resource: originalResource.resource,
          request: {
            method: 'PUT',
            url: `Location/${originalResource.resource.id}`,
          },
        })
        mcsd.saveLocations(bundle, '', (err, body) => {
          if (err) {
            winston.error(err);
            errorOccured = true;
            return res.status(500).send();
          }
          winston.info('Location saved successfully');
          winston.info('Deleting location from HFR cache');
          mcsd.deleteResource({
            database: reqDB,
            resource: 'Location',
            id,
          }, () => {
            winston.info('Delete operation completed');
            res.status(201).send();
          });
        });
      })
    })
  });

  function getDVS(isFacility, parent, callback) {
    if(!isFacility || !parent) {
      return callback()
    }

    let url = URI(config.getConf('mCSD:url'))
      .segment(config.getConf('hfr:tenancyid'))
      .segment('Location')
      .addQuery('_id', parent)
      .addQuery('_include:recurse', 'Location:partof')
      .toString();
    mcsd.executeURL(url, (parents) => {
      if(!parents.entry) {
        return callback()
      }
      let dvsParent
      for(let entry of parents.entry) {
        if(!entry.resource.type) {
          continue
        }
        for(let type of entry.resource.type) {
          for(let coding of type.coding) {
            if(coding.system === '2.25.123494412831734081331965080571820180508' && coding.code == '4') {
              dvsParent = entry.resource.id
            }
          }
        }
      }
      if(dvsParent) {
        let url = URI(config.getConf('mCSD:url'))
          .segment(config.getConf('hfr:tenancyid'))
          .segment('Location')
          .addQuery('partof', dvsParent)
          .addQuery('type', 'DVS')
          .toString();
        mcsd.executeURL(url, (dvs) => {
          return callback(dvs)
        })
      } else {
        return callback()
      }
    })
  }
});

router.post('/addFromHFR', (req, res) => {
  winston.info('Received a request to add HFR');
  let errorOccured = false;
  const form = new formidable.IncomingForm();
  form.parse(req, (err, fields) => {
    const { id, parent } = fields;
    const database = config.getConf('updaterequests:tenancyid');
    mcsd.getLocationByID(database, id, false, (location) => {
      let deletedIndex = 0;
      let total = location.entry[0].resource.meta.tag.length;
      for (let index = 0; index < total; index++) {
        if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'Admin_div') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentName') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'parentID') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'details') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'NewFacility') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'UpdatedFacility') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'NewJurisdiction') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].code === 'UpdatedJurisdiction') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        } else if (location.entry[0].resource.meta.tag[index - deletedIndex].display === 'Original UUID') {
          location.entry[0].resource.meta.tag.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        }
      }

      deletedIndex = 0;
      total = location.entry[0].resource.extension.length;
      for (let index = 0; index < total; index++) {
        if (location.entry[0].resource.extension[index - deletedIndex].url === 'Admin_div') {
          location.entry[0].resource.extension.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        }else if (location.entry[0].resource.extension[index - deletedIndex].url === 'parentName') {
          location.entry[0].resource.extension.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        }else if (location.entry[0].resource.extension[index - deletedIndex].url === 'parentID') {
          location.entry[0].resource.extension.splice(index - deletedIndex, 1);
          deletedIndex += 1;
        }
      }
      let isFacility = location.entry[0].resource.type.find((typ) => {
        return typ.coding && typ.coding.find((coding) => {
          return coding.code === 'urn:ihe:iti:mcsd:2019:facility'
        })
      })
      let locID
      if(isFacility) {
        let ident = location.entry[0].resource.identifier.find((ident) => {
          return ident.type.text === 'id'
        })
        if(ident) {
          locID = ident.value
        }
      } else {
        let ident = location.entry[0].resource.identifier.find((ident) => {
          return ident.type.text === 'code'
        })
        if(ident) {
          locID = ident.value
        }
        if(locID) {
          locID += location.entry[0].resource.name
        }
      }
      winston.error(locID)
      location.entry[0].resource.id = uuid5(locID.toString(), '7ee93e32-78da-4913-82f8-49eb0a618cfc')
      location.entry[0].resource.partOf = {
        reference: `Location/${parent}`,
      };
      getDVS(isFacility, parent, (dvs) => {
        if(dvs) {
          if(!location.entry[0].resource.extension) {
            location.entry[0].resource.extension = []
          }
          location.entry[0].resource.extension.push({
            url: 'DistrictVaccineStore',
            valueReference: {
              reference: `Location/${dvs.entry[0].resource.id}`
            }
          })
        }
        const bundle = {
          resourceType: 'Bundle',
          type: 'batch',
          entry: [{
            resource: location.entry[0].resource,
            request: {
              method: 'PUT',
              url: `Location/${location.entry[0].resource.id}`,
            },
          }],
        };
        mcsd.saveLocations(bundle, '', (err, body) => {
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
      })
    });
  });

  function getDVS(isFacility, parent, callback) {
    if(!isFacility) {
      return callback()
    }
    let url = URI(config.getConf('mCSD:url'))
      .segment(config.getConf('hfr:tenancyid'))
      .segment('Location')
      .addQuery('_id', parent)
      .addQuery('_include:recurse', 'Location:partof')
      .toString();
    mcsd.executeURL(url, (parents) => {
      if(!parents.entry) {
        return callback()
      }
      let dvsParent
      for(let entry of parents.entry) {
        if(!entry.resource.type) {
          continue
        }
        for(let type of entry.resource.type) {
          for(let coding of type.coding) {
            if(coding.system === '2.25.123494412831734081331965080571820180508' && coding.code == '4') {
              dvsParent = entry.resource.id
            }
          }
        }
      }
      if(dvsParent) {
        let url = URI(config.getConf('mCSD:url'))
          .segment(config.getConf('hfr:tenancyid'))
          .segment('Location')
          .addQuery('partof', dvsParent)
          .addQuery('type', 'DVS')
          .toString();
        mcsd.executeURL(url, (dvs) => {
          return callback(dvs)
        })
      } else {
        return callback()
      }
    })
  }
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
    id
  } = req.query;
  const codeSyst = mixin.getCodesysteURI(codeSystemType);
  let codeSystemURI;
  if (codeSyst) {
    codeSystemURI = codeSyst.uri;
  }

  if(codeSystemType && !codeSystemURI) {
    winston.warn(`Codesystem URI ${codeSystemType} was not found on the configuration`);
    return res.status(401).send();
  }
  mcsd.getCodeSystem({
    codeSystemURI,
    id
  },
  (codeSystem) => {
    winston.error(codeSystem)
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
        return callback(null, mcsdData);
      });
    },
    parentDetails(callback) {
      if (sourceLimitOrgId === topOrgId) {
        return callback(null, false);
      }
      mcsd.getLocationByID('', sourceLimitOrgId, false, details => callback(null, details));
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
  const database = config.getConf('updaterequests:tenancyid');
  winston.info('Getting facilities from HFR');
  let HFRMetadata = [];
  let facTypes;
  hfr.getMetaData((metadata) => {
    HFRMetadata = metadata;
    const classification = HFRMetadata.find(field => parseInt(field.id) === 424);
    if (classification) {
      facTypes = classification.fields.find(field => parseInt(field.id) === 1624);
    }
    hfr.getFacilities((facilities) => {
      winston.info(`Received ${facilities.length} from HFR`);
      const fhir = {};
      fhir.type = 'batch';
      fhir.resourceType = 'Bundle';
      fhir.entry = [];
      async.eachSeries(facilities, (facility, nxtFacility) => {
        const identifier = `http://hfrportal.ehealth.go.tz|${facility.id}`;
        const url = URI(config.getConf('mCSD:url'))
          .segment(config.getConf('hfr:tenancyid'))
          .segment('Location')
          .addQuery('identifier', identifier)
          .addQuery('_include', 'Location:partof')
          .toString();
        mcsd.executeURL(url, (fhirLocation) => {
          if (fhirLocation.entry.length === 0) {
            winston.info(`Facility ${facility.name} missing, adding request`);
            const building = createFacilityResource(facility);
            building.id = uuid5(facility.id.toString(), '1457baa3-9860-4d29-8ac9-bc926d9bef47');
            building.meta.tag.push({
              code: 'NewFacility',
            });
            fhir.entry.push({
              resource: building,
              request: {
                method: 'PUT',
                url: `Location/${building.id}`,
              },
            });
          } else if (fhirLocation.entry.length === 2) {
            const facilityResource = fhirLocation.entry.find(entry => entry.search.mode === 'match');
            const parentResource = fhirLocation.entry.find(entry => entry.search.mode === 'include');
            let facType;
            if (facilityResource.resource.type && Array.isArray(facilityResource.resource.type)) {
              for (const type of facilityResource.resource.type) {
                if (!type.coding) {
                  continue;
                }
                for (const coding of type.coding) {
                  if (coding.system === 'http://hfrportal.ehealth.go.tz/facilityType') {
                    facType = coding.display;
                  }
                }
              }
            }
            let adminDiv;
            if (facility.properties.Admin_div) {
              adminDiv = facility.properties.Admin_div.split('-').pop().trim();
            }

            let HFRFacType = mixin.translateFacTypes(facility.properties.Fac_Type.toString().split('-'), facTypes.config.hierarchy);
            let HFRFacTypeName;
            if (!HFRFacType) {
              HFRFacTypeName = facility.properties.Fac_Type;
            } else {
              HFRFacTypeName = HFRFacType.name;
            }

            if (facility.name !== facilityResource.resource.name
              || HFRFacTypeName !== facType
              || adminDiv !== parentResource.resource.name
            ) {
              winston.info(`Facility ${facility.name} has been updated, adding request`);
              const building = createFacilityResource(facility);
              building.id = uuid5(facility.id.toString(), '1457baa3-9860-4d29-8ac9-bc926d9bef47');
              building.meta.tag.push({
                code: 'UpdatedFacility',
              });
              building.meta.tag.push({
                code: facilityResource.resource.id,
                display: 'Original UUID'
              });
              fhir.entry.push({
                resource: building,
                request: {
                  method: 'PUT',
                  url: `Location/${building.id}`,
                },
              });
            }
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

  function createFacilityResource(facility) {
    const facType = mixin.translateFacTypes(facility.properties.Fac_Type.toString().split('-'), facTypes.config.hierarchy);
    let facTypeId = '';
    let facTypeName;
    if (!facType) {
      facTypeName = facility.properties.Fac_Type;
    } else {
      facTypeName = facType.name;
      facTypeId = facType.id;
    }
    const building = {
      id: uuid5(facility.id.toString(), '7ee93e32-78da-4913-82f8-49eb0a618cfc'),
      resourceType: 'Location',
      meta: {
        tag: [],
        profile: [
          'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_Location',
          'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_FacilityLocation',
        ],
      },
      name: facility.name,
      extension: [{
        "url": "Admin_div",
        "valueString": facility.properties.Admin_div
      }],
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
        }],
      }, {
        coding: [{
          system: 'http://hfrportal.ehealth.go.tz/facilityType',
          code: facTypeId,
          display: facTypeName,
        }],
        text: 'Facility Type',
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
    return building;
  }
});

router.get('/syncHFRAdminAreas', (req, res) => {
  let errorOccured = false;
  const reqDB = config.getConf('updaterequests:tenancyid');
  const database = config.getConf('hfr:tenancyid');
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
        .segment('Location')
        .addQuery('identifier', identifier)
        .addQuery('_include', 'Location:partof')
        .toString();
      mcsd.executeURL(url, (fhirLocation) => {
        if (fhirLocation.entry.length === 0) {
          winston.info(`${adminArea.name} missing`);
          const jurisdiction = buildJurisdiction(adminArea, 'NewJurisdiction');
          jurisdiction.id = uuid5(adminArea.id + jurisdiction.name, '1457baa3-9860-4d29-8ac9-bc926d9bef47');
          fhir.entry.push({
            resource: jurisdiction,
            request: {
              method: 'PUT',
              url: `Location/${jurisdiction.id}`,
            },
          });
        } else if (fhirLocation.entry.length === 2) {
          const parentJur = fhirLocation.entry.find(entry => entry.search.mode === 'include');
          const originalResource = fhirLocation.entry.find(entry => entry.search.mode === 'match');
          const parIdentifier = parentJur.resource.identifier.find(ident => ident.type && ident.type.text === 'code');
          if (parIdentifier && parIdentifier.value !== adminArea.parentID) {
            winston.info(`${adminArea.name} Updated inside HFR, adding request`);
            winston.info(`${adminArea.name} Parent Changed`);
            const jurisdiction = buildJurisdiction(adminArea, 'UpdatedJurisdiction', parentJur.resource.id);
            jurisdiction.id = uuid5(adminArea.id + jurisdiction.name, '1457baa3-9860-4d29-8ac9-bc926d9bef47');
            jurisdiction.meta.tag.push({
              code: originalResource.resource.id,
              display: 'Original UUID'
            });
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
        id = uuid5(adminArea.id.toString() + adminArea.name, '7ee93e32-78da-4913-82f8-49eb0a618cfc');
      }
      const level = adminArea.id.split('.').length - 1;
      const jurisdiction = {
        id,
        resourceType: 'Location',
        meta: {
          tag: [{
            code: tagDetails,
          }],
          profile: [
            'http://ihe.net/fhir/StructureDefinition/IHE_mCSD_Location',
          ],
        },
        name: adminArea.name,
        extension: [{
          "url": "parentName",
          "valueString": adminArea.parentName
        }, {
          "url": "parentID",
          "valueString": adminArea.parentID
        }],
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
              }
            ],
            text: 'level'
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

function parseLocationResource(building, database, callback) {
  if (!building.resource.name) {
    return {}
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
      identifier => identifier.system === 'http://hfrportal.ehealth.go.tz' && identifier.type.text === 'Fac_IDNumber',
    );
    if(!code) {
      code = building.resource.identifier.find(
        identifier => identifier.system === 'http://hfrportal.ehealth.go.tz' && identifier.type.text === 'code',
      );
    }
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
        row.type.text = coding.display;
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
  const adminDiv = building.resource.extension && building.resource.extension.find((ext) => {
    return ext.url === 'Admin_div'
  })
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
  if (adminDiv) {
    row.parent = adminDiv.valueString;
  }
  async.series({
    getParent: (callback) => {
      if (row.parent || !building.resource.partOf) {
        return callback(null);
      }
      const url = URI(config.getConf('mCSD:url'))
        .segment(database)
        .segment('Location')
        .addQuery('_id', building.resource.partOf.reference)
        .addQuery('_include:recurse', 'Location:partof')
        .toString();
      row.immediateParent = {
        id: building.resource.partOf.reference.split('/')[1],
      }
      mcsd.executeURL(url, (parents) => {
        parents.entry.pop();
        parents.entry.reverse();
        for(const pr of parents.entry) {
          if(pr.resource.id === row.immediateParent.id) {
            row.immediateParent.name = pr.resource.name
            code = pr.resource.identifier.find(
              identifier => identifier.system === 'http://hfrportal.ehealth.go.tz' && identifier.type.text === 'code',
            );
            if(code) {
              row.immediateParent.code = code.value
            }
          }
          if(!row.parent) {
            row.parent = pr.resource.name;
          } else {
            row.parent += " - " + pr.resource.name;
          }
        }
        return callback(null);
      });
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
  }, () => callback(row));
}
module.exports = router;
