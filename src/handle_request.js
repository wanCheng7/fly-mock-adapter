'use strict';

var utils = require('./utils');
var qs = require('qs');

function makeResponse(result, config) {
  return {
    statusCode: result[0],
    responseText: utils.isSimpleObject(result[1]) ? JSON.parse(JSON.stringify(result[1])) : result[1],
    headers: result[2],
    config: config
  };
}

function handleRequest(mockAdapter, resolve, reject, config) {
  if (config && config.baseURL && config.url.substr(0, config.baseURL.length) === config.baseURL) {
    config.url = config.url.slice(config.baseURL ? config.baseURL.length : 0);
  }
  var m = config.method.toLowerCase();
  var searchPIndex = config.url.indexOf('?')
  var urlPrev = config.url.slice(0, searchPIndex !== -1 ? searchPIndex : config.url.length);
  var arr = urlPrev.split('\/');
  let lastName = arr[arr.length-1];
  if (m === 'get') {
    console.log(lastName + '_get_parameters:', qs.parse(config.url.slice(searchPIndex+1)))
  }
  if (m === 'post' || m === 'put' || m === 'delete') {
    console.log(lastName + '_' + m + '_data:', JSON.parse(config.body || '{}'))
  }
  //delete config.adapter;
  mockAdapter.history[m].push(config);

  var handler = utils.findHandler(
    mockAdapter.handlers,
    config.method,
    config.url,
    config.data,
    config.params,
    config.headers,
    config.baseURL
  );
  if (handler) {
    if (handler.length === 7) {
      utils.purgeIfReplyOnce(mockAdapter, handler);
    }

    if (handler.length === 2) {
      // passThrough handler
      // tell axios to use the original adapter instead of our mock, fixes #35
      config.adapter = mockAdapter.originalAdapter;
      mockAdapter.axiosInstance.request(config).then(resolve, reject);
    } else if (!(handler[3] instanceof Function)) {
      return makeResponse(handler.slice(3), config);
      /*utils.settle(
        resolve,
        reject,
        makeResponse(handler.slice(3), config),
        mockAdapter.delayResponse
      );*/
    } else {
      var result = handler[3](config);
      // TODO throw a sane exception when return value is incorrect
      if (!(result.then instanceof Function)) {
        utils.settle(resolve, reject, makeResponse(result, config), mockAdapter.delayResponse);
      } else {
        result.then(
          function(result) {
            utils.settle(resolve, reject, makeResponse(result, config), mockAdapter.delayResponse);
          },
          function(error) {
            if (mockAdapter.delayResponse > 0) {
              setTimeout(function() {
                reject(error);
              }, mockAdapter.delayResponse);
            } else {
              reject(error);
            }
          }
        );
      }
    }
  } else {
    // handler not found
    utils.settle(
      resolve,
      reject,
      {
        status: 404,
        config: config
      },
      mockAdapter.delayResponse
    );
  }
}

module.exports = handleRequest;
