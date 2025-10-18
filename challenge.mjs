import net from 'net';
import { createHash } from 'crypto';

const ORIGIN_PORT = 3032;
const ORIGIN_HOST = '127.0.0.1';
const CHALLENGE_PORT = 3031;

// Buffer for incoming data chunks
let buffer = '';

// Buffer for assembling objects by hash
const hashBuffer = {};

// Connected clients for challenge server
const clients = [];

// Connect to origin server and take keypress to start data stream
const originClient = net.createConnection({ port: ORIGIN_PORT, host: ORIGIN_HOST }, () => {
  console.log('press any key to start stream..');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.once('data', () => {
    originClient.write(Buffer.from([1]));
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log('Started data stream!');
  });
});

originClient.on('data', (data) => {
 
	buffer += data.toString();
	let boundary = buffer.indexOf('\n');
	while (boundary !== -1) {
		const line = buffer.slice(0, boundary).trim();
		buffer = buffer.slice(boundary + 1);
		
		if (line && line.startsWith('{') && line.endsWith('}')) {
			try {
				const obj = JSON.parse(line);
				handleIncomingObject(obj);
			} catch (e) {
				console.log('Failed to parse JSON line:', line);
			}
		}
		boundary = buffer.indexOf('\n');
	}
});


originClient.on('end', () => {
	console.log('Disconnected from origin data server');
});

function getShopHash(shopObj) {
	// Hash the shop object as a string (MD5)
	const str = JSON.stringify(shopObj);
	return createHash('md5').update(str).digest('hex');
}

function handleIncomingObject(obj) {
	let hash;
	if (obj.type === 'shop') {
		hash = getShopHash(obj);
	} else if (obj.type === 'image' || obj.type === 'location') {
		hash = obj.data.hash;
	} else {
		return;
	}

	if (!hashBuffer[hash]) {
		hashBuffer[hash] = {};
	}

	hashBuffer[hash][obj.type] = obj;

	// Check if we have all three types
	if (hashBuffer[hash].shop && hashBuffer[hash].image && hashBuffer[hash].location) {
		const completeObj = {
			shop: hashBuffer[hash].shop,
			image: hashBuffer[hash].image,
			location: hashBuffer[hash].location
		};
	// Send completeObj to all connected clients
	broadcastCompleteObject(completeObj);

	// Remove from buffer to avoid duplicate sends
	delete hashBuffer[hash];
	}
}


// Challenge server: TCP server on port 3031
const challengeServer = net.createServer((socket) => {
	clients.push(socket);
	console.log('Client connected to challenge server');

	socket.on('end', () => {
		const idx = clients.indexOf(socket);
		if (idx !== -1) clients.splice(idx, 1);
		console.log('Client disconnected from challenge server');
	});

	socket.on('error', (err) => {
		const idx = clients.indexOf(socket);
		if (idx !== -1) clients.splice(idx, 1);
		console.error('Client socket error:', err);
	});
});

challengeServer.listen(CHALLENGE_PORT, () => {
	console.log('Challenge server listening on port', CHALLENGE_PORT);
});

function broadcastCompleteObject(obj) {
    console.log('Broadcasting complete object to clients:', obj);
	const str = JSON.stringify(obj) + '\n';
	clients.forEach((client) => {
		client.write(str);
	});
	console.log('Sent complete object to clients');
}