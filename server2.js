// server2.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

const serviceAccount = require('./public/assets/realtime-group-discussion-firebase-adminsdk-p748u-744df0c8ff.json'); // Update with your own serviceAccountKey.json


const firebaseConfig = {
  apiKey: "AIzaSyCPRBX23loTMM8zRtUI4_TiCZ6yhVTvkgc",
  authDomain: "realtime-group-discussion.firebaseapp.com",
  databaseURL: "https://realtime-group-discussion-default-rtdb.firebaseio.com",
  projectId: "realtime-group-discussion",
  storageBucket: "realtime-group-discussion.appspot.com",
  messagingSenderId: "297395929587",
  appId: "1:297395929587:web:21beac58c3a94e46505286",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://realtime-group-discussion-default-rtdb.firebaseio.com',
});

const db = admin.database();


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connect to MongoDB
mongoose.connect('mongodb+srv://sushanthhebri336:MNhMeupxu4eV2PrL@cluster0.jdskbj9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define MongoDB schema and model
const userSchema = new mongoose.Schema({
  username: String,
});
const User = mongoose.model('User', userSchema);

app.get("/chatexp", (req, res) => {
  res.sendFile("chatexp.html", { root: "public" });
});
// WebSocket server logic
wss.on('connection', (ws) => {
  // Send online users to the newly connected client
  sendOnlineUsers(ws);

  ws.on('message', async (message) => {
    const messageData = JSON.parse(message);

    // Save user to MongoDB if not already saved
    const user = await User.findOne({ username: messageData.username });
    if (!user) {
      await new User({ username: messageData.username }).save();
      sendOnlineUsers();
    }

    // Save message to Firebase Realtime Database
    const messagesRef = db.ref('');
    messagesRef.push({
      username: messageData.username,
      message: messageData.message,
      timestamp: Date.now(),
    });

    // Broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

// Function to send online users to all clients
async function sendOnlineUsers(excludeClient) {
  try {
    const users = await User.find({}, 'username');
    const onlineUsers = users.map((user) => user.username);

    wss.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'onlineUsers', data: onlineUsers }));
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
