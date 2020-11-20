require('./init');
const winston = require('winston');
const async = require('async')
const axios = require('axios')
const URI = require('urijs')

const config = require('./config');
const { CacheFhirToES } = require('fhir2es')

const cacheFHIR = () => {
  return new Promise((resolve) => {
    let tenancies = ['hfr', 'vims', 'dhis2']
    getLastIndexingTime().then((lastUpdateTime) => {
      async.eachSeries(tenancies, (tenancy, nxt) => {
        let tenancyID = config.getConf(`${tenancy}:tenancyid`)
        const url = URI(config.getConf('mCSD:url'))
          .segment(tenancyID)
          .toString();
        let caching = new CacheFhirToES({
          ESBaseURL: config.getConf('elastic:server'),
          ESUsername: config.getConf('elastic:username'),
          ESPassword: config.getConf('elastic.password'),
          ESMaxCompilationRate: '60000/1m',
          ESMaxScrollContext: '60000',
          FHIRBaseURL: url,
          FHIRUsername: '',
          FHIRPassword: '',
          relationshipsIDs: [], //if not specified then all relationships will be processed
          since: lastUpdateTime,
          reset: false
        })
        caching.cache().then(() => {
          winston.info('Done caching ' + tenancy)
          return nxt()
        })
      }, () => {
        return resolve()
      })
    })
  })
}

function getLastIndexingTime() {
  return new Promise((resolve) => {
    axios({
      method: "GET",
      url: URI(config.getConf('elastic:server')).segment('syncdata').segment("_search").toString(),
      auth: {
        username: config.getConf('elastic:username'),
        password: config.getConf('elastic.password')
      }
    }).then((response) => {
      if(response.data.hits.hits.length === 0) {
        return resolve('1970-01-01T00:00:00')
      }
      return resolve(response.data.hits.hits[0]._source.lastIndexingTime)
    }).catch((err) => {
      resolve('1970-01-01T00:00:00')
    })
  })
}

module.exports = {
  cacheFHIR
}
