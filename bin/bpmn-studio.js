#!/usr/bin/env node

const open = require('open');
const argv = require('minimist')(process.argv.slice(2));
const pushserve = require('pushserve');


const defaultPort = 17290;
const defaultHost = '127.0.0.1';
const portUsed = _applicationPortIsValid(argv.port) ? argv.port : defaultPort;
const hostUsed = _applicationHostIsValid(argv.host) ? argv.host : defaultHost;

const httpServerOptions = {
  noCors: false,
  noPushstate: false,
  hostname: hostUsed,
  port: portUsed,
  path: __dirname + './..',
  indexPath: 'index.html',
};

pushserve(httpServerOptions);
open(`http://${hostUsed}:${portUsed}`);

/*
 * Check if a given port is okay.
 *
 * This will perform a boundary check for the port, and general sanity checks.
 *
 * @param[in]: port The port, specified from argv.
 * @return true If the everything is okay; false otherwise.
 */
function _applicationPortIsValid(port) {
  if (port === null || port === undefined) {
    return false;
  }
  if (!Number.isInteger(port)) {
    return false;
  }

  const portNumber = parseInt(port);

  // would require more priviledges
  const lowerPortBoundValid = portNumber > 1000;
  const upperPortBoundValid = portNumber < 65535;
  const boundariesInvalid = (!lowerPortBoundValid || !upperPortBoundValid);

  if (boundariesInvalid) {
    console.log("Port is not in the supported range [1000, 65535]. Using default port.\n");
    return false;
  }

  return true;
}

function _applicationHostIsValid(host) {
  if (host === null || host === undefined) {
    return false;
  }
  if (!host.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    console.log("The specified host: '" + host + "' is not a valid IP address, like: '0.0.0.0'.\n");
    return false;
  };
  return true;
}
