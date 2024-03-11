const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
const connectedClients = new Set();



// Online users showing feature
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.username = "Anonymous";
  connectedClients.add(socket);
  updateOnlineUsers();

  socket.on("set username", (username) => {
    socket.username = username;
    updateOnlineUsers();
  });

  socket.on("disconnect", () => {
    console.log("Client has disconnected");
    connectedClients.delete(socket);
    updateOnlineUsers();
  });
});


function updateOnlineUsers() {
  const onlineUsers = Array.from(connectedClients).map(
    (socket) => socket.username || "Anonymous"
  );
  io.emit("update online users", onlineUsers);
  console.log("Online Users:", onlineUsers);
}

app.get("/chatexp", (req, res) => {
  res.sendFile("chatexp.html", { root: "public" });
});

server.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
