import cors from "cors";
import express, { json } from "express";
import { MongoClient } from "mongodb";
const app = express();

app.use(cors());
app.use(json());
const mongoClient = new MongoClient("mongodb://localhost:27017");
let db = null;

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  try {
    await mongoClient.connect();
    db = mongoClient.db("UOL_API");
    const participant = { name: name, lastStatus: Date.now() };
    await db.collection("participants").insertOne(participant);
    res.sendStatus(201);
    mongoClient.close();
  } catch (err) {
    console.log(err);
  }
});
app.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    db = mongoClient.db("UOL_API");
    const participants = await db.collection("participants").find({}).toArray();
    res.send(participants);
    mongoClient.close();
  } catch (err) {
    console.log(err);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  try {
    await mongoClient.connect();
    db = mongoClient.db("UOL_API");
    const message = { to, text, type, from, time: Date.now() };
    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
    mongoClient.close();
  } catch (err) {}
});
app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;
  try {
    await mongoClient.connect();
    db = mongoClient.db("UOL_API");
    const messages = await db.collection("messages").find({}).toArray();
    const messagesDisplay = messages.reverse().splice(0, limit);
    res.send(messagesDisplay);
    mongoClient.close();
  } catch (err) {}
});

app.post("/status", async (req, res) => {
  const user = req.headers;
  try {
    await mongoClient.connect();
    db = mongoClient.db("UOL_API");
    const participant = await db
      .collection("participants")
      .find({ name: user })
      .toArray();
    if (!participant) return res.sendStatus(404);

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
    mongoClient.close();
  } catch (err) {}
});

app.listen(5000);
