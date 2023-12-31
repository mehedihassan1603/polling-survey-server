const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const moment = require('moment');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://polling-and-survey-9e4a4.web.app',
    'https://polling-survey-server-two.vercel.app',
    'https://glamorous-talk.surge.sh'
  ],
  credentials: true
}));
app.use(express.json());
app.use(bodyParser.json());
  
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
    const userCollection = client.db('surveyDB').collection('users');
    const paymentCollection = client.db('surveyDB').collection('payments');
    const commentCollection = client.db('surveyDB').collection('comments');


    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }




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
        const surveyData = req.body;
        surveyData.timestamp = new Date();
        // console.log(surveyData);
        const result = await surveyCollection.insertOne(surveyData)
        res.send(result)
        
    })
      app.post('/comment', async(req, res)=>{
        const surveyData = req.body;
        // console.log(surveyData);
        const result = await commentCollection.insertOne(surveyData)
        res.send(result)  
    })
    app.get('/comment', async(req, res)=>{
      const cursor = commentCollection.find();
      // console.log('tok tok token', req.cookies.token)
      const result = await cursor.toArray();
      res.send(result);
      console.log(result)
    })
    app.get('/comment/:id', async (req, res) => {
        try {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const survey = await commentCollection.findOne(query);
      
          if (!survey) {
            return res.status(404).send('Survey not found');
          }
      
          res.send(survey);
        } catch (error) {
          console.error('Error fetching survey by ID:', error);
          res.status(500).send('Internal Server Error');
        }
      });

 

    app.put('/survey/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
    
        // Assuming the request body contains the updated vote and comment fields
        const { updatedSurveyData } = req.body;
    
        console.log('Received Data:', updatedSurveyData);
    
        const updatedDoc = {
          $set: {},
        };
    
        if (updatedSurveyData.totalVote !== undefined) {
          updatedDoc.$set.totalVote = updatedSurveyData.totalVote;
        }
        if (updatedSurveyData.comment !== undefined) {
          updatedDoc.$set.comment = updatedSurveyData.comment;
        }
        if (updatedSurveyData.like !== undefined) {
          updatedDoc.$set.like = updatedSurveyData.like;
        }
        if (updatedSurveyData.dislike !== undefined) {
          updatedDoc.$set.dislike = updatedSurveyData.dislike;
        }
    
        // You can add other fields to update similarly
    
        const result = await surveyCollection.updateOne(filter, updatedDoc);
    
        if (result.matchedCount === 1) {
          res.status(200).json({ message: 'Survey data updated successfully' });
        } else {
          res.status(404).json({ message: 'Survey not found' });
        }
      } catch (error) {
        console.error('Error updating survey data:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    



    //User related api
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === 'admin';
      }
      res.send({ admin });
    })

    
    app.post('/users', async(req, res)=>{
      const userData = req.body;
      const query = { email: userData.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(userData)
      res.send(result)
  })

  app.get('/users', async (req, res) => {
    // console.log(req.headers)
    const result = await userCollection.find().toArray();
    res.send(result);
  });

  app.patch('/users/prouser/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        role: 'Pro-User'
      }
    }
    const result = await userCollection.updateOne(filter, updatedDoc);
    res.send(result);
  })

  app.patch('/users/admin/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        role: 'admin'
      }
    }
    const result = await userCollection.updateOne(filter, updatedDoc);
    res.send(result);
  })

  // app.patch('/users/surveyor/:id', async (req, res) => {
  //   const id = req.params.id;
  //   const filter = { _id: new ObjectId(id) };
  //   const updatedDoc = {
  //     $set: {
  //       role: 'surveyor'
  //     }
  //   }
  //   const result = await userCollection.updateOne(filter, updatedDoc);
  //   res.send(result);
  // })

  // app.get('/users/surveyor/:email', async (req, res) => {
  //     const email = req.params.email;

     

  //     const query = { email: email };
  //     const user = await userCollection.findOne(query);
  //     let admin = false;
  //     if (user) {
  //       admin = user.role === 'surveyor';
  //     }
  //     res.send({ admin });
  //   })

  app.delete('/users/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    const result = await userCollection.deleteOne(query);
    res.send(result);
  })

   // payment intent
   app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent')

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  });

  app.get('/payments/:email', verifyToken, async (req, res) => {
    const query = { email: req.params.email }
    if (req.params.email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const result = await paymentCollection.find(query).toArray();
    res.send(result);
  })



app.get('/payments', async (req, res) => {
    try {
        const payments = await paymentCollection.find().toArray();

        // Format date fields using Moment.js
        const formattedPayments = payments.map(payment => ({
            ...payment,
            paymentDate: moment(payment.paymentDate).format('YYYY-MM-DD HH:mm:ss')
            // Adjust the format according to your requirements
        }));

        res.send(formattedPayments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).send('Internal Server Error');
    }
});


  // app.get('/payments', async (req, res) => {
  //   // console.log(req.headers)
  //   const result = await paymentCollection.find().toArray();
  //   res.send(result);
  // });

  app.post('/payments', async (req, res) => {
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);

    console.log('payment info', payment);
    res.send(paymentResult)
  })
  app.patch('/payments/:id', async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        status: 'Paid'
      }
    }
    const result = await paymentCollection.updateOne(filter, updatedDoc);
    res.send(result);
  })



    
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
