const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
//middleware for receiving document from front end
const multer = require("multer");
//storage where user document will be uploaded
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./UserDocuments");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + file.originalname);
  },
});

const upload = multer({ storage: storage });

require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
//middleware
// app.use(cors());
app.use(
  cors({
    origin: [
      "https://kiit-iro-portal.web.app",
      "https://kiitportal.aminulrony.com",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(express.json()); //this middleware is required to access req.body

//making the uploaded file static to access it from anywhere
app.use("/UserDocuments", express.static("UserDocuments"));

//user name and password is hidded
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@international-student-d.vt6tjzt.mongodb.net/?retryWrites=true&w=majority&appName=International-Student-Data`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    //creating useData database in mongo db
    const userData = client.db("userDB").collection("users");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userData.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //api for checking admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userData.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //api to get a single user data
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userData.findOne(query);
      res.send(user);
    });

    //api to get a single user data for admin
    app.get("/user/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await userData.findOne(query);
      res.send(user);
    });

    //api to update a single user's information
    app.patch("/user/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updatedUserData = req.body;
      const updatedUser = {
        $set: {
          name: updatedUserData.name,
          nationality: updatedUserData.nationality,
          mobilenumber: updatedUserData.mobilenumber,
          department: updatedUserData.department,
          program: updatedUserData.program,
          roll: updatedUserData.roll,
          session: updatedUserData.session,
        },
      };
      const result = await userData.updateOne(filter, updatedUser);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userData.insertOne(user);
      res.send(result);
    });

    //api for getting all user data
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userData.find().toArray();
      res.send(result);
    });

    //api for deleting a specific user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userData.deleteOne(query);
      res.send(result);
    });

    //api for making a user admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedUser = {
        $set: {
          role: "admin",
        },
      };
      const result = await userData.updateOne(filter, updatedUser);
      res.send(result);
    });

    //api related to file upload multer and send to mongodb
    const multipleUpload = upload.fields([
      { name: "passport", maxCount: 1 },
      { name: "visa", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ]);
    app.post(
      "/upload-files/:email",
      verifyToken,
      multipleUpload,
      async (req, res) => {
        const email = req.params.email;
        const passport = req.files["passport"][0].filename;
        const visa = req.files["visa"][0].filename;
        const image = req.files["image"][0].filename;
        console.log(passport, visa, image);
        const filter = { email: email };
        const userDocument = {
          $set: {
            image: image,
            passport: passport,
            visa: visa,
          },
        };
        const result = await userData.updateOne(filter, userDocument);
        res.send(result);
      }
    );

    //api related to update user file using multer and send to mongodb
    app.put(
      "/update-files/:email",
      verifyToken,
      multipleUpload,
      async (req, res) => {
        const email = req.params.email;
        const passport = req.files["passport"][0].filename;
        const visa = req.files["visa"][0].filename;
        const image = req.files["image"][0].filename;
        console.log(passport, visa, image);
        const filter = { email: email };
        const updatedUserDocument = {
          $set: {
            image: image,
            passport: passport,
            visa: visa,
          },
        };
        const result = await userData.updateOne(filter, updatedUserDocument);
        res.send(result);
      }
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("KIIT IRO Portal is running.");
});

app.listen(port, () => {
  console.log(`KIIT IRO Portal is running on port : ${port}`);
});
