import cors from "cors";
import express, { json } from "express";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { strict as assert } from "assert";
import { stripHtml } from "string-strip-html";

const app = express();

app.use(cors());
app.use(json());
dotenv.config();

const mongoClient = new MongoClient(process.env.URL);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("UOL_API");
});

app.post("/participants", async (req, res) => {
  let { name } = req.body;

  const participantSchema = joi.string().required();

  const validation = participantSchema.validate(name);
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  name = stripHtml(name).result.trim();

  try {
    const participants = await db.collection("participants").find({}).toArray();
    const checkParticipant = participants.some((item) => item.name === name);
    if (checkParticipant) {
      res.sendStatus(409);
      return;
    }

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err, "erro");
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    res.send(participants);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post("/messages", async (req, res) => {
  const { to, type } = req.body;
  let { text } = req.body;
  const from = stripHtml(req.headers.user).result.trim();
  let message = { to, text, type, from, time: dayjs().format("HH:mm:ss") };
  const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    time: joi.string().required(),
  });
  const validation = messageSchema.validate(message, { abortEarly: false });
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  message.text = stripHtml(req.body.text).result.trim();
  try {
    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});
app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const user = stripHtml(req.headers.user).result.trim();
  try {
    let messages = await db.collection("messages").find({}).toArray();
    let messagesDisplay = messages.filter((message) => {
      const publicMessage = message.type === "message";
      const userPrivateMessage = message.to === user || message.from === user;
      return publicMessage || userPrivateMessage;
    });

    messagesDisplay = messages.reverse().splice(0, limit);
    messagesDisplay = messagesDisplay.reverse();
    res.send(messagesDisplay);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post("/status", async (req, res) => {
  const user = stripHtml(req.headers.user).result.trim();

  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: user });

    if (!participant) {
      res.sendStatus(404);
      return;
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
});
const CHECKOUT_TIME = 15000;
setInterval(async () => {
  const seconds = Date.now() - 10000;
  try {
    const participantsTimeOut = await db
      .collection("participants")
      .find({ lastStatus: { $lte: seconds } })
      .toArray();
    if (participantsTimeOut.length > 0) {
      const quitChatMessages = participantsTimeOut.map((participant) => {
        return {
          from: participant.name,
          to: "Todos",
          text: "saiu da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });

      await db.collection("messages").insertMany(quitChatMessages);
      await db
        .collection("participants")
        .deleteMany({ lastStatus: { $lte: seconds } });
    }
  } catch (err) {}
}, CHECKOUT_TIME);

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const from = stripHtml(req.headers.user).result.trim();
  const messageId = req.params.ID_DA_MENSAGEM;

  try {
    const message = await db
      .collection("messages")
      .findOne({ _id: new ObjectId(messageId) });

    if (!message) {
      res
        .status(404)
        .send("não foi possiver encontrar uma mensagem com esse id");
      return;
    }
    if (message.from !== from) {
      res.status(401).send("o usuario não é dono dessa mensagem");
      return;
    }
    await db.collection("messages").deleteOne({ _id: new ObjectId(messageId) });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
  const { to, type } = req.body;
  let { text } = req.body;
  const messageId = req.params.ID_DA_MENSAGEM;
  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: stripHtml(req.headers.user).result.trim() });
    if (!participant) {
      res.sendStatus(422);
      return;
    }
    const messageSchema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required(),
    });

    const message = {
      to,
      text,
      type,
    };
    const validation = messageSchema.validate(message, { abortEarly: false });
    if (validation.error) {
      res.sendStatus(422);
      return;
    }
    await db.collection("messages").updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          text: stripHtml(req.body.text).result.trim(),
          time: dayjs().format("HH:mm:ss"),
        },
      }
    );
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(5000);
