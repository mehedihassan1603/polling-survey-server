const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
  
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rl5ffdh.mongodb.net/?retryWrites=true&w=majority`;
  

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const surveyCollection = client.db('surveyDB').collection('survey');

    app.get('/survey', async(req, res)=>{
        const cursor = surveyCollection.find();
        // console.log('tok tok token', req.cookies.token)
        const result = await cursor.toArray();
        res.send(result);
        console.log(result)
      })
      
      app.get('/survey/:_id', async (req, res) => {
        try {
          const id = req.params._id;
          const query = { _id: new ObjectId(id) };
          const survey = await surveyCollection.findOne(query);
      
          if (!survey) {
            return res.status(404).send('Survey not found');
          }
      
          res.send(survey);
        } catch (error) {
          console.error('Error fetching survey by ID:', error);
          res.status(500).send('Internal Server Error');
        }
      });
      app.post('/survey', async(req, res)=>{
        const job = req.body;
        // console.log(job);
        const result = await surveyCollection.insertOne(job)
        res.send(result)
        
    })



    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req,res)=>{
    res.send('Working');
})

app.listen(port,()=>{
    console.log(`Server is running at : ${port}`);
})
