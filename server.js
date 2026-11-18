const http = require('http');
const crypto = require('crypto');

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = 'ap-south-1';
const TABLE_NAME = 'NodeAppUsers';

// Create DynamoDB client (Automatically uses EC2 IAM Role)
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

// Read request body
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 10000) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Save user details in DynamoDB
    if (req.method === 'POST' && req.url === '/users') {
        try {
            const body = await readBody(req);
            const user = JSON.parse(body);

            if (!user.name || !user.email) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ message: 'Name and email are required' }));
            }

            const userId = crypto.randomUUID();
            await dynamodb.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    userId: userId,
                    name: user.name,
                    email: user.email
                }
            }));

            res.statusCode = 201;
            res.end(JSON.stringify({ message: 'User saved successfully', userId: userId }));
        } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.end(JSON.stringify({ message: 'Error saving user' }));
        }
    }

    // Retrieve user details from DynamoDB
    else if (req.method === 'GET' && req.url.startsWith('/users/')) {
        try {
            const userId = decodeURIComponent(req.url.split('/')[2]);
            const result = await dynamodb.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { userId: userId }
            }));

            if (!result.Item) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ message: 'User not found' }));
            }

            res.statusCode = 200;
            res.end(JSON.stringify(result.Item));
        } catch (error) {
            console.error(error);
            res.statusCode = 500;
            res.end(JSON.stringify({ message: 'Error retrieving user' }));
        }
    }

    // Home page
    else if (req.method === 'GET' && req.url === '/') {
        res.statusCode = 200;
        res.end(JSON.stringify({
            message: 'Welcome to Node.js Application with DynamoDB!',
            endpoints: [
                'POST /users - Save user details',
                'GET /users/:userId - Retrieve user details'
            ]
        }));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Route not found' }));
    }
});

// Start server
server.listen(3000, '0.0.0.0', () => {
    console.log('Node.js application running on port 3000');
});