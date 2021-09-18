var net = require('net'),
	rpc = require('../json_rpc_client'),
	client;

const SOCKET_FILE = '/tmp/unix.sock';

var jrpc = new rpc.rpcClient();
client = net.createConnection(SOCKET_FILE);

jrpc.toStream = function(message) {
	//console.log(message);
	client.write(message + "\n");
};

client.on('connect', ()=>{
	console.log("connected");
});

client.on('data', function(data) {
	jrpc.messageHandler(data);
});

client.on('error', function(data) {
	console.error("Server not active");
	process.exit(1);
});

jrpc.call('echo_params', [1,2,3,'vier',5.1]).then(function(result){
	console.log("1: " + JSON.stringify(result));
});

jrpc.call('echo_params', {"bla":"frupp"})
	.then(function(result){
		console.log("2: " + JSON.stringify(result));
	})
	.catch(err => console.log(err));

jrpc.call('notify', "willi")
	.then(function(result){
		console.log("3: " + JSON.stringify(result));
	})
	.catch(err => console.log(err));

client.end();



