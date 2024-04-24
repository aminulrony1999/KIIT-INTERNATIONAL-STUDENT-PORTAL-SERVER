const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
//middleware
app.use(cors());
app.use(express.json()); //this middleware is required to access req.body

//user name and password is hidded
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@kiit-iro-portal.qfxkq4e.mongodb.net/?retryWrites=true&w=majority&appName=KIIT-IRO-PORTAL`;
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
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    //api for checking admin
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;

      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }

      const query = { email: email };
      const user = await userData.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    app.post('/users',async(req,res)=>{
      const user = req.body;
      const result = await userData.insertOne(user);
      res.send(result);
    })
    app.patch('/users/admin/:id', async(req,res)=>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)};
      const updatedUser = {
        $set : {
          role : 'admin'
        }
      }
      const result = await userData.updateOne(filter,updatedUser);
      res.send(result);
    })
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
