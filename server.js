const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const qrcode = require("qrcode");
require("dotenv").config();
const cookieParser = require('cookie-parser');
const cache = require('memory-cache');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
// Replace this line
// const fetch = require('node-fetch');
// with dynamic import
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));













const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
const connectedClients = new Set();
// app.use(cors());










mongoose
  .connect(process.env.MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

const admin = require("firebase-admin");
const serviceAccount = require("./public/assets/realtime-group-discussion-firebase-adminsdk-p748u-744df0c8ff.json");

const firebaseConfig = {
  apiKey: "AIzaSyCPRBX23loTMM8zRtUI4_TiCZ6yhVTvkgc",
  authDomain: "realtime-group-discussion.firebaseapp.com",
  databaseURL: "https://realtime-group-discussion-default-rtdb.firebaseio.com",
  projectId: "realtime-group-discussion",
  storageBucket: "realtime-group-discussion.appspot.com", // Add the storage bucket URL
  messagingSenderId: "297395929587",
  appId: "1:297395929587:web:21beac58c3a94e46505286",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://realtime-group-discussion-default-rtdb.firebaseio.com',
  storageBucket: firebaseConfig.storageBucket, // Use the storage bucket URL from firebaseConfig
});

const firestore = admin.firestore();
const storageBucket = admin.storage().bucket();
const db = admin.database();

console.log('Storage Bucket Name:');


// const firebaseConfig = {
//   apiKey: "AIzaSyCPRBX23loTMM8zRtUI4_TiCZ6yhVTvkgc",
//   authDomain: "realtime-group-discussion.firebaseapp.com",
//   databaseURL: "https://realtime-group-discussion-default-rtdb.firebaseio.com",
//   projectId: "realtime-group-discussion",
//   storageBucket: "realtime-group-discussion.appspot.com",
//   messagingSenderId: "297395929587",
//   appId: "1:297395929587:web:21beac58c3a94e46505286",
// };

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://realtime-group-discussion-default-rtdb.firebaseio.com',
// });

// const db = admin.database();
















app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Define a Mongoose schema for the user
const userSchema = new mongoose.Schema({
  username: String,
  dob: Date,
  email: { type: String, unique: true },
  password: String,
  profileImageUrl: String, // Store the image URL instead of image data
  webqrdata: String,
  appqrdata: String,
});

// Create a Mongoose schema for group details on mongodb
const groupSchema = new mongoose.Schema({
  groupId: {
    type: String,
    unique: true, // Ensures groupId is unique
    required: true,
  },
  groupName: String,
  creatorName: String,
  communityGuidelines: String,
  location: String,
});

const Group = mongoose.model("Group", groupSchema);


// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads");
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.fieldname + "-" + Date.now());
//   },
// });

// const upload = multer({ storage });
// Configure Multer for file uploads
const upload = multer();
app.post('/signup', upload.single('profileImage'), async (req, res) => {
  try {
    console.log('Storage Bucket Name:', storageBucket.name);

    // Validate form fields
    if (!req.body.username || !req.body.dob || !req.body.email || !req.body.password) {
      return res.status(400).send('<script>alert("All form fields are required."); window.location.href="/signup";</script>');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).send('<script>alert("Email already exists. Please choose another email."); window.location.href="/signup";</script>');
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).send('<script>alert("Please upload a profile picture."); window.location.href="/signup";</script>');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Upload the profile image to Firebase Storage
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const fileUpload = storageBucket.file(`profile-images/${fileName}`);
    const blobStream = fileUpload.createWriteStream();

    blobStream.on('finish', async () => {
      try {
        // Get the download URL from Firebase Storage
        const imageUrl = await fileUpload.getSignedUrl({
          action: 'read',
          expires: '03-09-2500', // Set an appropriate expiration date
        });

        // Remove the common part of the URL
        const trimmedImageUrl = imageUrl[0].replace('https://storage.googleapis.com/realtime-group-discussion.appspot.com/', '');

        // Process form data and uploaded image
        const userObj = {
          username: req.body.username,
          dob: req.body.dob,
          email: req.body.email,
          password: hashedPassword,
          profileImageUrl: trimmedImageUrl, // Add the trimmed profile image URL to the user document
          webqrdata: generateRandomString(),
          appqrdata: generateRandomString(),
        };

        // Save data to MongoDB
        await User.create(userObj);

        // Redirect or send a success response
        res.send('<script>window.location.href="/signin";</script>');
      } catch (error) {
        console.error("Error processing image URL:", error);
        res.status(500).send('<script>alert("Internal Server Error"); window.location.href="/signup";</script>');
      }
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).send('<script>alert("Internal Server Error"); window.location.href="/signup";</script>');
  }
});



// Handle signin form submission
// Handle signin form submission
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate form fields
    if (!email || !password) {
      return res.status(400).send("Email and password are required.");
    }

    // Find the user in the database
    const user = await User.findOne({ email });

    // Check if the user exists
    if (!user) {
      return res.status(401).send("Invalid email or password");
    }

    // Check if the password is correct
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send("Invalid email or password");
    }

    // Set the user's email in local storage
    // Note: This is done on the client-side, and it's less secure than using sessions
    res.cookie('email', email, { maxAge: 86400000 }); // Set maxAge to control the cookie's expiration time

    console.log("User signed in. Email:", email);

    // Redirect to home.html after successful signin
    res.redirect("/home.html");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error during signin");
  }
});

const User = mongoose.model("User", userSchema);
module.exports = User;

app.use(bodyParser.json());
app.set("view engine", "ejs");


// Use express-session middleware
app.use(
  session({
    secret: "sushanth", // Replace with a secure secret key
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 },
  })
);





// Serve static files from the 'public' folder
app.use(express.static("public"));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

// Define routes
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// Serve the admin.html page
app.get("/admin", (req, res) => {
  res.sendFile("admin.html", { root: "public" });
});

app.get("/subscribe", (req, res) => {
  res.sendFile("subscribe.html", { root: "public" });
});

// Serve signup.html
app.get("/signup", (req, res) => {
  res.sendFile("signup.html", { root: "public" });
});

app.get("/home.html", (req, res) => {
  const email = req.session.email;

  // If the email is not in the session, redirect to the sign-in page
  if (!email) {
    return res.redirect("/signin");
  }

  // Use an absolute path for res.sendFile
  const filePath = path.join(__dirname, "public", "home.html");

  // Send the file
  res.sendFile(filePath, (err) => {
    if (err) {
      // Handle any errors that occurred while sending the file
      console.error("Error sending home.html:", err);
      res.status(500).send("Internal Server Error");
    }
  });
});

app.get("/creategroup", (req, res) => {
  res.sendFile("creategroup.html", { root: "public" });
});

app.get("/joingroup", (req, res) => {
  res.sendFile("joingroup.html", { root: "public" });
});

app.get("/loginwithqr", (req, res) => {
  res.sendFile("loginwithqr.html", { root: "public" });
});

app.get("/home", (req, res) => {
  res.sendFile("home.html", { root: "public" });
});

app.get("/landing", (req, res) => {
  res.sendFile("landing.html", { root: "public" });
});
app.get("/signin", (req, res) => {
  res.sendFile("signin.html", { root: "public" });
});

app.get("/about", (req, res) => {
  res.sendFile("about.html", { root: "public" });
});

// app.get("/profile", (req, res) => {
//   res.sendFile("profile.html", { root: "public" });
// });

// Endpoint to generate QR code on the server side
app.get("/generateQR", async (req, res) => {
  const qrCodeData = generateRandomString();
  const qrCodeImage = await generateQRCodeImage(qrCodeData);

  res.json({ qrCodeData, qrCodeImage });
});

function generateRandomString() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const length = 10; // Change the length as needed

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

async function generateQRCodeImage(data) {
  try {
    const qrCodeImage = await qrcode.toDataURL(data);
    return qrCodeImage;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}

// Route to display all user details
app.get("/userDetails", async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find();

    // Render the userDetails.html page with user data
    res.render("userDetails", { users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// ..// Route to find and serve profile picture by username
app.get("/profilePicByUsername/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username: username });

    if (user && user.profile && user.profile.data) {
      // Set the appropriate content type for the image
      res.contentType(user.profile.contentType);

      // Send the image data
      res.end(user.profile.data, "binary");
    } else {
      // If user or profile picture not found, send a default image or handle it accordingly
      res.sendFile(path.join(__dirname, "public", "default-profile-pic.png"));
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// ..
// Route to display all user details
app.get("/userDetails", async (req, res) => {
  try {
    const users = await User.find();
    res.render("userDetails", { users: users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/profile", (req, res) => {
  // Retrieve the email from the session
  const email = req.session.email;

  // If the email is not in the session, redirect to the sign-in page
  if (!email) {
    return res.redirect("/signin");
  } else {
    res.sendFile("profile.html", { root: "public" });
  }
});

app.get("/signout", (req, res) => {
  // Destroy the session when the user signs out
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/signin");
  });
});


app.get("/api/user/email", (req, res) => {
  // Retrieve email from the session
  const userEmail = req.session.email;

  // Send the email in the response
  res.json({ email: userEmail });
});


app.post("/joingroup", async (req, res) => {
  try {
    console.log('join group called');
    const groupId = req.body.groupId;
    const email = req.body.email;
    const location = req.body.location;









    console.log("Received request to join group:");
    console.log("Group ID:", groupId);
    console.log("User Email:", email);
    console.log("Location:", location);

    if (groupId === "groups" && email && location) {
      // Fetch user details from MongoDB based on the email
      const user = await User.findOne({ email });

      if (!user) {
        console.log("User not found in MongoDB.");
        return res.status(404).send("User not found in MongoDB.");
      }

      // Store username and profile in local storage
      res.cookie('username', user.username, { maxAge: 86400000 }); 
  

      // Send a success response
      res.status(200).send("User details stored in local storage.");
    } else {
      console.log("Invalid request or missing required data.");
      res.status(400).send("Invalid request or missing required data.");
    }
  } catch (error) {
    // Handle errors for MongoDB
    console.error("Error:", error);

    // Send an appropriate error response
    res.status(500).send("Internal Server Error. Please try again later.");
  }
});


// app.get("/profileImage", async (req, res) => {
//   try {
//     // Retrieve email from the session or cookies
//     const email = req.session.email || req.cookies.email;

//     if (!email) {
//       return res.status(404).send("Email not found in session or cookies.");
//     }

//     // Check if the image is in the cache
//     const cachedImage = cache.get(email);
//     if (cachedImage) {
//       res.contentType('image/jpeg'); // Set the content type based on your image format
//       res.send(cachedImage);
//     } else {
//       // Fetch the image from MongoDB
//       const user = await User.findOne({ email });

//       if (!user || !user.profile || !user.profile.data) {
//         return res.status(404).send("Profile image not found.");
//       }

//       // Resize the image (adjust options as needed)
//       const resizedImageBuffer = await sharp(user.profile.data)
//         .resize({ width: 300 }) // Set the desired width
//         .toBuffer();

//       // Convert resized binary data to base64
//       const base64Data = resizedImageBuffer.toString('base64');

//       // Cache the image and send it
//       cache.put(email, resizedImageBuffer);
//       res.contentType(user.profile.contentType);
//       res.send(base64Data);
//       console.log(base64Data);
//     }
//   } catch (error) {
//     console.error("Error fetching profile image:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

app.get("/profileImage", async (req, res) => {
  try {
    const email = req.cookies.email; // Assuming email is in cookies

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send("user not found -s");
    }
    console.log(`imageurl: ${user.profileImageUrl}`);
    
    // // Assuming user.profileImageUrl is a direct URL to the image
    // const imageUrl = $(user.profileImageUrl);
    // console.log("check this"+imageUrl);

    // // Send the image URL directly
    // res.send(user);
    res.json(user);

  } catch (error) {
    console.error("Error fetching and serving profile image:", error);
    res.status(500).send("Internal Server Error");
  }
});



/// Route to get all user details
app.get("/users", async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find();

    // Log details of each user
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  Name: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`imageurl: ${user.profileImageUrl}`);
      console.log("-----------------------------");
    });

    // Log the total number of users retrieved
    console.log(`Fetched ${users.length} users from the database`);

    // Send the users as a JSON response
    res.json(users);
  } catch (error) {
    // Log and send an error response if there's an issue
    console.error("Error fetching user details:", error);
    res.status(500).send("Internal Server Error");
  }
});



















// Online users showing feature
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.username = "Anonymous";
  socket.profileImageUrl = ""; // Add this line to store profile image URL
  connectedClients.add(socket);
  updateOnlineUsers();

  socket.on("set username", (username) => {
    socket.username = username;
    updateOnlineUsers();
  });

  socket.on("set profile image", (profileImageUrl) => {
    socket.profileImageUrl = profileImageUrl; // Set the profile image URL
    updateOnlineUsers();
  });

// code for new message trigger
const messagesRef = admin.database().ref('messages');
  // Listen for new child added to 'messages' in Firebase
  messagesRef.orderByChild('timestamp').on('child_added', (snapshot) => {
    const newMessage = snapshot.val();

    // Send the new child to the connected clients
    socket.emit('newMessage', newMessage);
  });






// Handle the request for the profile image URL
socket.on('getProfileImage', async () => {
  console.log("get profile image called");
  try {
    const cookies = socket.request.headers.cookie;
    if (!cookies) {
      console.error('No cookies found in the request headers');
      socket.emit('error', 'No cookies found in the request headers');
      return;
    }

    const emailCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('email='));
    if (!emailCookie) {
      console.error('Email cookie not found');
      socket.emit('error', 'Email cookie not found');
      return;
    }

    const emailEncoded = emailCookie.split('=')[1].trim(); // Extracting encoded email from the cookie
    const email = decodeURIComponent(emailEncoded); // Decoding the email

    const user = await User.findOne({ email });

    if (!user) {
      console.error('User not found');
      socket.emit('error', 'User not found');
      return;
    }

    console.log("got details");

    // Send the profile image URL back to the client
    socket.emit('profileImageResponse', user.profileImageUrl);
  } catch (error) {
    console.error('Error fetching profile image:', error);
    socket.emit('error', error.message);
  }
});






  socket.on("disconnect", () => {
    console.log("Client has disconnected");
    connectedClients.delete(socket);
    updateOnlineUsers();
  });
});

function updateOnlineUsers() {
  const onlineUsers = Array.from(connectedClients).map((socket) => ({
    username: socket.username || "Anonymous",
    profileImageUrl: socket.profileImageUrl || "" // Include profile image URL in the online users list
  }));
  io.emit("update online users", onlineUsers);
  console.log("Online Users:", onlineUsers);
}


app.get("/chatexp", (req, res) => {
  res.sendFile("chatexp.html", { root: "public" });
});















// Start the server
// app.listen(port, () => {
//   console.log(`Server is running at http://localhost:${port}`);
// });

// Handle form submission for chat
// Handle form submission
app.post('/store-chats-realtime', async (req, res) => {
  try {
    const { email, username, message, profileImageUrl } = req.body;

    // Check if the required fields are present
    if (!email || !username || !message || !profileImageUrl) {
      return res.status(400).send('Email, username, message, and profileImageUrl are required.');
    }

    // Store the message in Firebase Realtime Database
    const messagesRef = admin.database().ref('messages');
    const newMessageRef = messagesRef.push();

    await newMessageRef.set({
      email,
      username,
      message,
      profileImageUrl,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    console.log(profileImageUrl);
    // Send a success response
    res.status(200).send('Message stored successfully.');
  } catch (error) {
    console.error('Error handling form submission:', error);
    res.status(500).send('Internal Server Error');
  }
});





// Define a route to handle the /get-messages request
app.get('/get-messages', async (req, res) => {
  try {
    const messagesSnapshot = await db.ref('messages').orderByChild('timestamp').once('value');
const messages = [];

messagesSnapshot.forEach((childSnapshot) => {
  const message = childSnapshot.val();
  messages.push({
    id: childSnapshot.key,
    email: message.email,
    message: message.message,
    profileImageUrl: message.profileImageUrl,
    timestamp: message.timestamp,
    username: message.username,
  });
});

console.log(messages);


    // Send the messages as JSON response
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});






server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// as we click join group button in joingroup.html page, 
// user email along with his location will be stored in the firebase realtime database in collection "online"
// and user profile pic will be stored locally in computer and while chatting the same image will be sent along with user name and location to the firebase realtime database in collection "chat" and the same will be displayed in the chat box in the chat.html page.


