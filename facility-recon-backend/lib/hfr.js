require('./init');
const winston = require('winston');
const request = require('request');
const URI = require('urijs');
const async = require('async');
const isJSON = require('is-json');
const config = require('./config');

module.exports = () => ({
  getMetaData(callback) {
    let metadata = [];
    let nexturl = new URI(config.getConf('hfr:baseURL')).segment('/api/collections/409/fields.json').addQuery('human', 'true');
    const username = config.getConf('hfr:username');
    const password = config.getConf('hfr:password');
    const auth = `Basic ${new Buffer(`${username}:${password}`).toString('base64')}`;
    async.doWhilst(
      (callback) => {
        const options = {
          url: nexturl.toString(),
          headers: {
            Authorization: auth,
          },
        };
        request.get(options, (err, res, body) => {
          if (isJSON(body)) {
            body = JSON.parse(body);
            metadata = metadata.concat(body);
            if (body.hasOwnProperty('nextPage')) {
              nexturl = body.nextPage;
            } else {
              nexturl = false;
            }
          } else {
            winston.error(body);
            winston.error('Non JSON data returned by HFR while getting metadata');
            return callback(null, false);
          }
          return callback(null, nexturl);
        });
      },
      (err, callback) => {
        if (nexturl) {
          winston.info(`Fetching In ${nexturl}`);
        }
        return callback(null, nexturl !== false);
      }, () => callback(metadata),
    );
  },

  getFacilities(page, callback) {
    // let facilitiesdel = require('./delete.json')
    // return callback(facilitiesdel)
    // page = 0
    let facilities = {
      human: [],
      nonHuman: [],
      nextPage: null
    };

    const username = config.getConf('hfr:username');
    const password = config.getConf('hfr:password');
    const auth = `Basic ${new Buffer(`${username}:${password}`).toString('base64')}`;

    async.parallel({
      human: (callback) => {
        url = new URI(config.getConf('hfr:baseURL')).segment('/api/collections/409.json').addQuery('human', 'true');
        if(page) {
          url = url.addQuery('page', page)
        }
        const options = {
          url: url.toString(),
          headers: {
            Authorization: auth,
          },
        };
        getDt(() => {
          return callback(null)
        })
        function getDt(clbck) {
          request.get(options, (err, res, body) => {
            if (isJSON(body)) {
              body = JSON.parse(body);
              if (body.hasOwnProperty('sites') && body.sites.length > 0) {
                facilities.human = facilities.human.concat(body.sites);
                if (body.hasOwnProperty('nextPage')) {
                  nexturl = URI(body.nextPage);
                  let qries = nexturl.query().split('&');
                  for(let qr of qries) {
                    if(qr.startsWith('page')) {
                      facilities.nextPage = qr.split('=')[1]
                    }
                  }
                } else {
                  nexturl = false;
                }
                return clbck()
              } else {
                winston.error(body);
                winston.error('Unexpected response returned');
                getDt(() => {
                  return clbck()
                })
              }
            } else {
              winston.error(body);
              winston.error('Non JSON data returned by HFR while getting facilities');
              getDt(() => {
                return clbck()
              })
            }
          });
        }
      },
      nonHuman: (callback) => {
        url = new URI(config.getConf('hfr:baseURL')).segment('/api/collections/409.json').addQuery('human', 'false');
        if(page) {
          url = url.addQuery('page', page)
        }
        const options = {
          url: url.toString(),
          headers: {
            Authorization: auth,
          },
        };
        getDt(() => {
          return callback(null)
        })
        function getDt(clbck) {
          request.get(options, (err, res, body) => {
            if (isJSON(body)) {
              body = JSON.parse(body);
              if (body.hasOwnProperty('sites') && body.sites.length > 0) {
                facilities.nonHuman = facilities.nonHuman.concat(body.sites);
                return clbck()
              } else {
                winston.error(body);
                winston.error('Unexpected response returned');
                getDt(() => {
                  return clbck()
                })
              }
            } else {
              winston.error(body);
              winston.error('Non JSON data returned by HFR while getting facilities');
              getDt(() => {
                return clbck()
              })
            }
          });
        }
      }
    }, () => {
      return callback(facilities)
    })
  },

  getAdminAreas(callback) {
    winston.info('Getting Administrative areas from HFR');
    const url = new URI(config.getConf('hfr:baseURL')).segment('/api/collections/409/fields.json');
    const username = config.getConf('hfr:username');
    const password = config.getConf('hfr:password');
    const auth = `Basic ${new Buffer(`${username}:${password}`).toString('base64')}`;

    const options = {
      url: url.toString(),
      headers: {
        Authorization: auth,
      },
    };
    const adminAreas = [];
    request.get(options, (err, res, body) => {
      if (err) {
        winston.error(err)
      }
      if (err || !isJSON(body)) {
        winston.error('An error occured, retrying ...')
        this.getAdminAreas((err, adminAreas) => {
          return callback(err, adminAreas)
        })
      } else {
        body = JSON.parse(body);
        const admin = body.find(bd => bd.id === 425);
        if (!admin) {
          return callback(true);
        }
        const fields = admin.fields.find(field => field.id.toString() === '1629');
        if (!fields) {
          return callback(true);
        }
        extractHierarchy(fields.config.hierarchy);
        return callback(false, adminAreas);
      }
    });

    const adminAreaFlat = {};
    function extractHierarchy(hierarchies, parent) {
      for (let k = 0; k < hierarchies.length; k++) {
        adminAreaFlat[hierarchies[k].id] = hierarchies[k].name;
        const adminArea = {
          name: hierarchies[k].name,
          id: hierarchies[k].id,
        };
        if (parent && parent.id) {
          adminArea.parentID = parent.id;
          const parArr = parent.id.split('.');
          let parentName = '';
          let parID = '';
          for (let x = 0; x < parArr.length; x++) {
            const par = parArr[x];
            if (parID) {
              parID += `.${par}`;
            } else {
              parID += par;
            }
            if (parentName) {
              parentName += `-${adminAreaFlat[parID]}`;
            } else {
              parentName += adminAreaFlat[parID];
            }
          }
          adminArea.parentName = parentName;
        }
        adminAreas.push(adminArea);
        if ('sub' in hierarchies[k]) {
          const parentDetails = {};
          if (hierarchies[k].id) {
            parentDetails.id = hierarchies[k].id;
            parentDetails.name = hierarchies[k].name;
          }
          extractHierarchy(hierarchies[k].sub, parentDetails);
        }
      }
    }
  },
});
