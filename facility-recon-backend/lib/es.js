const axios = require('axios')
const URI = require('urijs');
const async = require('async')
const winston = require('winston');
const config = require('./config');

const getDocument = ({index, query}, callback) => {
  let error = false
  let documents = []
  if(!query) {
    query = {}
  }
  query.size = 10000
  let url = URI(config.getConf('elastic:server'))
    .segment(index).segment('_search')
    .addQuery('scroll', '1m')
    .toString()
  let scroll_id = null
  async.doWhilst(
    (callback) => {
      axios({
        method: 'GET',
        url,
        data: query,
        auth: {
          username: config.getConf('elastic:username'),
          password: config.getConf('elastic.password'),
        }
      }).then((response) => {
        if(response.data.hits.hits.length === 0 || !response.data._scroll_id) {
          scroll_id = null
        } else {
          scroll_id = response.data._scroll_id
          documents = documents.concat(response.data.hits.hits)
          url = URI(config.getConf('elastic:server'))
            .segment('_search')
            .segment('scroll')
            .toString()
          query = {
            scroll_id: scroll_id
          }
        }
        return callback(null)
      }).catch((err) => {
        error = err
        winston.error(err);
        scroll_id = null
        return callback(null)
      })
    },
    (callback) => {
      return callback(null, scroll_id !== null)
    },
    () => {
      return callback(error, documents)
    }
  )
}

const createESIndex = (index, IDFields, reportFields, callback) => {
  async.series({
    createAnalyzer: callback => {
      winston.info('Creating analyzer into elasticsearch for index ' + index);
      const url = URI(config.getConf('elastic:server')).segment(index).toString();
      const settings = {
        settings: {
          analysis: {
            analyzer: {
              levenshtein_analyzer: {
                type: 'custom',
                tokenizer: 'keyword',
                filter: ['lowercase'],
              }
            }
          },
        },
      };
      let auth = {
        username: config.getConf('elastic:username'),
        password: config.getConf('elastic:password'),
      };
      axios.put(url, settings, auth).then(response => {
        if (response.status >= 200 && response.status <= 299) {
          winston.info('Analyzer created successfully');
          return callback(null);
        } else {
          winston.error('Something went wrong while creating analyzer into elasticsearch');
          return callback(true);
        }
      }).catch(err => {
        if (
          err.response &&
          err.response.status &&
          (err.response.status === 400 || err.response.status === 403)
        ) {
          winston.info('Analyzer already exist into elasticsearch, not creating');
          return callback(null);
        } else {
          winston.error(err);
          return callback(true);
        }
      });
    },
    createMapping: callback => {
      winston.info('Adding mappings into elasticsearch for index ' + index);
      const url = URI(config.getConf('elastic:server'))
        .segment(index)
        .segment('_mapping')
        .toString();
      const mapping = {
        properties: {},
      };
      for (const IDField of IDFields) {
        mapping.properties[IDField] = {};
        mapping.properties[IDField].type = 'keyword';
      }
      for (const field of reportFields) {
        mapping.properties[field.name] = {
          type: field.type,
          fields: {
            jaro: {
              type: 'keyword'
            },
            leven: {
              type: field.type,
              analyzer: 'levenshtein_analyzer',
            },
          },
        };
      }
      let auth = {
        username: config.getConf('elastic:username'),
        password: config.getConf('elastic:password'),
      };
      axios.put(url, mapping, auth).then(response => {
        if (response.status >= 200 && response.status <= 299) {
          winston.info('Mappings added successfully into elasticsearch');
          return callback(null);
        } else {
          winston.error('Something went wrong while adding mappings into elasticsearch');
          return callback(true);
        }
      }).catch(err => {
        if (
          err.response &&
          err.response.status &&
          (err.response.status === 400 || err.response.status === 403)
        ) {
          winston.info('Mappings already exist into elasticsearch, not creating');
          return callback(null);
        } else {
          winston.error('Something went wrong while adding mappings into elasticsearch');
          winston.error(err);
          return callback(true);
        }
      });
    },
  }, err => {
    return callback(err);
  });
}

module.exports = {
  getDocument,
  createESIndex
};