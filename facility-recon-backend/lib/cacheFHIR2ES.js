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
    async.eachSeries(tenancies, (tenancy, nxt) => {
      let tenancyID = config.getConf(`${tenancy}:tenancyid`)
      const url = URI(config.getConf('mCSD:url'))
        .segment(tenancyID)
        .toString();
      let caching = new CacheFhirToES({
        ESBaseURL: config.getConf('elastic:server'),
        ESUsername: config.getConf('elastic:username'),
        ESPassword: config.getConf('elastic.password'),
        ESMaxCompilationRate: '100000/1m',
        ESMaxScrollContext: '100000',
        FHIRBaseURL: url,
        FHIRUsername: '',
        FHIRPassword: '',
        relationshipsIDs: [], //if not specified then all relationships will be processed
        since: '',
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
}

module.exports = {
  cacheFHIR
}
