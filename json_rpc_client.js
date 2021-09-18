// derived from: https://github.com/jershell/simple-jsonrpc-js
'use strict'

var net = require('net'),
	fs = require('fs'),
	cj = require('concatjson'),
	connections = {},
	client
	;

const { Readable } = require('stream');

var isObject = function(value) {
	var type = typeof value;
	return value != null && (type == 'object' || type == 'function');
};

var isUndefined = function (value) {
	return value === undefined;
};

var isArray = Array.isArray;

var isEmpty = function(value) {
	if (isObject(value)) {
		for (var idx in value) {
			if (value.hasOwnProperty(idx)) {
				return false;
			}
		}
		return true;
	}
	if (isArray(value)) {
		return !value.length;
	}
	return !value;
};

function isError(message) {
	return !!message.error;
}

function isRequest(message) {
	return !!message.method;
}

function isResponse(message) {
	return message.hasOwnProperty('result') && message.hasOwnProperty('id');
}

var forEach = function (target, callback) {
	if (isArray(target)) {
		return target.map(callback);
	}
	else {
		for (var _key in target) {
			if (target.hasOwnProperty(_key)) {
				callback(target[_key]);
			}
		}
	}
};

var ERRORS = {
	"PARSE_ERROR": {
		"code": -32700,
		"message": "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."
	},
	"INVALID_REQUEST": {
		"code": -32600,
		"message": "Invalid Request. The JSON sent is not a valid Request object."
	},
	"METHOD_NOT_FOUND": {
		"code": -32601,
		"message": "Method not found. The method does not exist / is not available."
	},
	"INVALID_PARAMS": {
		"code": -32602,
		"message": "Invalid params. Invalid method parameter(s)."
	},
	"INTERNAL_ERROR": {
		"code": -32603,
		"message": "Internal error. Internal JSON-RPC error."
	}
};


var rpcClient = function() {
	var self = this,
		waitingframe = {},
		id = 0,
		dispatcher = {};

	self.undefinedResult = true;

	function call(method, params) {
		id += 1;
		var message = {
			jsonrpc : "2.0",
			method : method,
			//"id" : id // id is added below
		};

		if (isObject(params) && !isEmpty(params)) {
			message.params = params;
		}

		message.id = id;

		return {
			promise : new Promise(function(resolve, reject) {
				waitingframe[id.toString()] = {
					resolve: resolve,
					reject: reject
				};
			}),
			message : message
		};
	}

	function beforeResolve(message) {
		var promises = [];
		if (isArray(message)) {	}
		else if (isObject(message)) {
			promises.push(resolver(message));
		}

		return Promise.all(promises)
			.then(function(result) {
				var toStreamData = [];
				forEach(result, function(r) {
					if (!isUndefined(r)) {
						toStreamData.push(r);
					}
				});

				if (toStreamData.length === 1) {
					self.toStream(JSON.stringify(toStream[0]));
				}
				else if (toStreamData.length > 1) {
					self.toStream(JSON.stringify(toStream));
				}
				return result;
			});
	}

	function resolver(message) {
		try {
			if (isError(message)) {
				return rejectRequest(message);
			}
			else if (isResponse(message)) {
				return resolveRequest(message);
			}
			else if (isRequest(message)) {
				return handleRemoteRequest(message);
			}
			else {
				return Promise.resolve({
					"id": null,
					"jsonrpc": "2.0",
					"error": setError(ERRORS.INVALID_REQUEST)
				});
			}
		}
		catch (e) {
			console.error('Resolver error:' + e.message, e);
			return Promise.reject(e);
		}
	}

	function rejectRequest(error) {
		if (waitingframe.hasOwnProperty(error.id)) {
			waitingframe[error.id].reject(error.error);
		}
		else {
			console.log('Unknown request', error);
		}
	}

	function resolveRequest(result) {
		if (waitingframe.hasOwnProperty(result.id)) {
			waitingframe[result.id].resolve(result.result);
			delete waitingframe[result.id];
		}
		else {
			console.log('unknown request', result);
		}
	}

	self.toStream = function(args) {
		console.log('Need define the toStream method before use');
		console.log(arguments);
	};

	self.call = function(method, params) {
		var _call = call(method, params);
		self.toStream(JSON.stringify(_call.message));
		return _call.promise;
	};

	self.messageHandler = function(rawMessage) {
		try {
			// a raw message may contain multiple concatenated JSON objects
			const readable = Readable.from(rawMessage);
			readable
				.pipe(cj.parse())
				.on('error', err => console.error(err))
				.on('data', obj => beforeResolve(obj))
				;
		}
		catch (e) {
			console.log("Error in messageHandler(): ", e);
			self.toStream(JSON.stringify({
				"id": null,
				"jsonrpc": "2.0",
				"error": ERRORS.PARSE_ERROR
			}));
			return Promise.reject(e);
		}
	}

};

module.exports = {
	rpcClient: rpcClient
};

