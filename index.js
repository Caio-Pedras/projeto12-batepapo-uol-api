import cors from "cors";
import express, { json } from "express";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
const app = express();

app.use(cors());
app.use(json());
const mongoClient = new MongoClient("mongodb://localhost:27017");

app.post("/participants", async (req, res) => {
  const participant = { name: req.body.name, lastStatus: Date.now() };
  const participantSchema = joi.object({
    name: joi.string().min(1).required(),
  });
  const validation = participantSchema.validate(participant, {
    abortEarly: true,
  });
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  try {
    await mongoClient.connect();
    let db = mongoClient.db("UOL_API");
    const participants = await db.collection("participants").find({}).toArray();
    const checkParticipant = participants.some(
      (participant) => participant.name === user.name
    );
    if (checkParticipant) {
      res.sendStatus(409);
      return;
    }

    await db.collection("participants").insertOne(participant);
    await db.collection("messages").insertOne({
      from: participant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
    mongoClient.close();
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
    mongoClient.close();
  }
});
app.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    let db = mongoClient.db("UOL_API");
    const participants = await db.collection("participants").find({}).toArray();
    res.send(participants);
    mongoClient.close();
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
    mongoClient.close();
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const message = { to, text, type, from, time: dayjs().format("HH:mm:ss") };
  const messageSchema = joi.object({
    from: joi.string.required(),
    to: joi.string.required(),
    text: joi.string.required(),
    type: joi.string.valid("message", "private_message").required(),
  });
  const validation = messageSchema.validate(message, { abortEarly: false });
  if (validation.error) {
    res.sendStatus(422);
    return;
  }

  try {
    await mongoClient.connect();
    let db = mongoClient.db("UOL_API");

    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
    mongoClient.close();
  } catch (err) {
    res.status(500).send(err);
    mongoClient.close();
  }
});
app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;
  try {
    await mongoClient.connect();
    let db = mongoClient.db("UOL_API");

    let messages = await db.collection("messages").find({}).toArray();
    let messagesDisplay = messages.filter((message) => {
      const publicMessage = message.type === "message";
      const userPrivateMessage = message.to === user || message.from === user;
      return publicMessage || userPrivateMessage;
    });

    messagesDisplay = messages.splice(0, limit);
    res.send(messagesDisplay);
    mongoClient.close();
  } catch (err) {
    res.status(500).send(err);
    mongoClient.close();
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    await mongoClient.connect();
    let db = mongoClient.db("UOL_API");
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
  } catch (err) {
    res.status(500).send(err);
    mongoClient.close();
  }
});

app.listen(5000);
