const express = require("express");
const path = require("path");
const multer = require("multer");
const app = express();
const fs = require("fs");
const fsm = require("fs-meta");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./authmiddleware");

const jwtKey = "my_secret_key";
const jwtExpirySeconds = 300;

//Static usernames and password
const users = {
  user1: "password1",
  user2: "password2",
};

//Allow all requests
app.use(cors());

app.use(bodyParser.json());

app.use(authMiddleware);

//var upload = multer({ dest: "uploads" })
// If you do not want to use diskStorage then uncomment it

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Uploads is the Upload_folder_name
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Define the maximum size for uploading
// picture i.e. 5 MB. it is optional
const maxSize = 5 * 1000 * 1000;

var upload = multer({
  storage: storage,
  limits: { fileSize: maxSize },
  fileFilter: function (req, file, cb) {
    // Set the filetypes, it is optional
    var filetypes = /jpeg|jpg|png/;
    var mimetype = filetypes.test(file.mimetype);

    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(
      "Error: File upload only supports the " +
        "following filetypes - " +
        filetypes
    );
  },

  // upload is the name of file attribute
}).single("upload");

app.post("/signin", (req, res) => {
  // Get credentials from JSON body
  const { username, password } = req.body;
  if (!username || !password || users[username] !== password) {
    // return 401 error is username or password doesn't exist, or if password does
    // not match the password in our records
    return res.status(401).end();
  }

  // Create a new token with the username in the payload
  // and which expires 300 seconds after issue
  const token = jwt.sign({ username }, jwtKey, {
    algorithm: "HS256",
    expiresIn: jwtExpirySeconds,
  });

  // set the cookie as the token string, with a similar max age as the token
  // here, the max age is in milliseconds, so we multiply by 1000
  res.setHeader("Content-Type", "application/json");
  res.send({ token: token });
});

app.get("/", function (req, res) {
  let fileObjects = [];
  let promises = [];
  fs.readdir("uploads", (err, files) => {
    files.forEach((file) => {
      var collectedJson = [];
      var options = {
        lstat: true, // false will use stat instead of lstat
        followSymLinks: true, // does nothing if `lstat` is false
        root: "", // if set, all paths will be truncated to this root dir
        filters: [
          fsm.filters.fileSize,
          fsm.filters.image,
          function (stat, options, next, fs) {
            if (stat.extension == "json") {
              collectedJson.push(stat);
              stat._isCollected = true;
            }
            next(null, stat);
          },
        ],
      };
      promises.push(fsm.getMeta("./uploads/" + file, options));
    });
    Promise.all(promises).then((values) => {
      values.map((file) => {
        fileObjects.push({
          name: file.filename,
          path: file.path,
          size: file.size,
          createdon: file.birthtime,
        });
      });
      res.setHeader("Content-Type", "application/json");
      res.send({ success: true, data: fileObjects });
    });
  });
});

app.post("/uploadProfilePicture", function (req, res, next) {
  // Error MiddleWare for multer file upload, so if any
  // error occurs, the image would not be uploaded!
  upload(req, res, function (err) {
    if (err) {
      // ERROR occured (here it can be occured due
      // to uploading image of size greater than
      // 1MB or uploading different file type)
      res.send(err);
    } else {
      // SUCCESS, image successfully uploaded
      res.setHeader("Content-Type", "application/json");
      res.send({ success: true, message: "Success, Image uploaded!" });
    }
  });
});

app.delete("/", function (req, res) {
  const path = req.query.path;

  fs.unlink(path, (err) => {
    if (err) {
      console.error(err);
      return res.send(err);
    }
    // SUCCESS, image successfully deleted
    res.setHeader("Content-Type", "application/json");
    res.send({ success: true, message: "Success, Image deleted!" });
  });
});

// Take any port number of your choice which
// is not taken by any other process
app.listen(8080, function (error) {
  if (error) throw error;
  console.log("Server created Successfully on PORT 8080");
});
