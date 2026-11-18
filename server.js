const http = require('http');
const crypto = require('crypto');

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = 'ap-south-1';
const TABLE_NAME = 'NodeAppUsers';

const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

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

// Frontend HTML UI Template
const htmlUI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Angular With NodeJS</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; }
        .header { background-color: #8b3dff; color: white; text-align: center; padding: 25px; font-size: 32px; font-weight: bold; }
        .main-container { display: flex; justify-content: space-between; padding: 30px 40px; gap: 40px; }
        .form-section { width: 60%; }
        .form-section h2 { margin-top: 0; font-size: 28px; }
        .summary-section { width: 35%; background-color: #a4de56; padding: 30px; text-align: center; box-sizing: border-box; }
        .summary-section h3 { margin: 0; font-size: 24px; font-weight: normal; }
        .form-row { display: flex; gap: 20px; margin-bottom: 20px; }
        .input-group { display: flex; flex-direction: column; width: 100%; }
        .input-group label { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
        input { padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
        .btn-create { background-color: #e57373; color: white; border: none; padding: 12px 25px; cursor: pointer; border-radius: 4px; font-size: 16px; margin-top: 10px; }
        .btn-get { background-color: #ffb74d; color: #333; border: none; padding: 12px 25px; cursor: pointer; border-radius: 4px; font-size: 16px; margin-top: 20px; font-weight: bold; }
        .count { font-size: 80px; color: #d32f2f; margin: 20px 0; }
        .table-container { padding: 0 40px; }
        .table-container h2 { font-size: 28px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th, td { border: 1px solid #e0e0e0; padding: 15px; text-align: left; }
        th { font-weight: bold; background-color: #fff; border-bottom: 2px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">pavan Task 9 With NodeJS</div>
    
    <div class="main-container">
        <div class="form-section">
            <h2>Create User</h2>
            <div class="form-row">
                <div class="input-group">
                    <label>First Name</label>
                    <input type="text" id="firstName" placeholder="First Name">
                </div>
                <div class="input-group">
                    <label>Last Name</label>
                    <input type="text" id="lastName" placeholder="Last Name">
                </div>
            </div>
            <div class="form-row">
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" id="email" placeholder="Email">
                </div>
            </div>
            <button class="btn-create" onclick="createUser()">Create</button>
        </div>
        
        <div class="summary-section">
            <h3>Users Created</h3>
            <div class="count" id="userCount">0</div>
            <button class="btn-get" onclick="loadUsers()">Get All Users</button>
        </div>
    </div>

    <div class="table-container">
        <h2>Users</h2>
        <table>
            <thead>
                <tr>
                    <th>User Id</th>
                    <th>Firstname</th>
                    <th>Lastname</th>
                    <th>Email</th>
                </tr>
            </thead>
            <tbody id="userTable">
                <!-- Data populated by JS -->
            </tbody>
        </table>
    </div>

    <script>
        // Fetch users from the backend
        async function loadUsers() {
            try {
                const res = await fetch('/users');
                const users = await res.json();
                
                // Update Count
                document.getElementById('userCount').innerText = users.length;
                
                // Populate Table
                const tbody = document.getElementById('userTable');
                tbody.innerHTML = '';
                users.forEach((user, index) => {
                    tbody.innerHTML += \`
                        <tr>
                            <td>\${index + 1}</td>
                            <td>\${user.firstName || ''}</td>
                            <td>\${user.lastName || ''}</td>
                            <td>\${user.email || ''}</td>
                        </tr>
                    \`;
                });
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        }

        // Send new user to the backend
        async function createUser() {
            const payload = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value
            };

            if(!payload.firstName || !payload.email) {
                alert("First Name and Email are required!");
                return;
            }

            try {
                await fetch('/users', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify(payload) 
                });
                
                // Clear fields
                document.getElementById('firstName').value = '';
                document.getElementById('lastName').value = '';
                document.getElementById('email').value = '';
                
                // Refresh table
                loadUsers();
            } catch (error) {
                console.error('Error creating user:', error);
            }
        }

        // Load users on page load
        window.onload = loadUsers;
    </script>
</body>
</html>
`;

const server = http.createServer(async (req, res) => {
    
    // Route 1: Serve Frontend UI
    if (req.method === 'GET' && req.url === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        return res.end(htmlUI);
    }

    // Route 2: API - Get All Users
    if (req.method === 'GET' && req.url === '/users') {
        res.setHeader('Content-Type', 'application/json');
        try {
            const result = await dynamodb.send(new ScanCommand({ TableName: TABLE_NAME }));
            res.statusCode = 200;
            return res.end(JSON.stringify(result.Items || []));
        } catch (error) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ message: 'Error retrieving users' }));
        }
    }

    // Route 3: API - Create User
    if (req.method === 'POST' && req.url === '/users') {
        res.setHeader('Content-Type', 'application/json');
        try {
            const body = await readBody(req);
            const user = JSON.parse(body);

            if (!user.firstName || !user.email) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ message: 'First name and email are required' }));
            }

            const userId = crypto.randomUUID();
            await dynamodb.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    userId: userId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                }
            }));

            res.statusCode = 201;
            return res.end(JSON.stringify({ message: 'User saved successfully', userId: userId }));
        } catch (error) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ message: 'Error saving user' }));
        }
    }

    // Route 4: Not Found
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Route not found' }));
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Visual Application running on port 3000');
});
