import cors from "cors";
import express, { json } from "express";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
const app = express();

app.use(cors());
app.use(json());
const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("UOL_API");
});

app.post("/participants", async (req, res) => {
  const participant = req.body;
  const participantSchema = joi.object({
    name: joi.string().required(),
  });
  const validation = participantSchema.validate(participant);
  if (validation.error) {
    console.log(validation.error, participantSchema, participant);
    console.log("consolelog maneiro erro na validaçãod o login");
    res.sendStatus(422, "consolelog maneiro erro na validaçãod o login");
    return;
  }
  try {
    // await mongoClient.connect();
    // const db = mongoClient.db("UOL_API");

    const participants = await db.collection("participants").find({}).toArray();
    const checkParticipant = participants.some(
      (item) => item.name === participant.name
    );
    if (checkParticipant) {
      console.log(409, "consolelog maneiro erro na checagem do participante");
      res.sendStatus(
        409,
        "consolelog maneiro erro na checagem do participante"
      );
      return;
    }

    await db
      .collection("participants")
      .insertOne({ name: participant.name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
      from: participant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
    // mongoClient.close();
  } catch (err) {
    console.log(err, "consolelog maneiro erro no catch do post participante");
    res.status(500).send(err, "erro");
    // mongoClient.close();
  }
});
app.get("/participants", async (req, res) => {
  try {
    // await mongoClient.connect();
    // const db = mongoClient.db("UOL_API");
    const participants = await db.collection("participants").find({}).toArray();
    res.send(participants);
    // mongoClient.close();
  } catch (err) {
    console.log(err, "consolelog maneiro erro no get participantes");
    res.status(500).send(err);
    // mongoClient.close();
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const message = { to, text, type, from, time: dayjs().format("HH:mm:ss") };
  const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    time: joi.required(),
  });
  const validation = messageSchema.validate(message, { abortEarly: false });
  if (validation.error) {
    console.log("consolelog maneiro erro validação do  post message");
    res.sendStatus(422, validation.error);
    return;
  }

  try {
    // await mongoClient.connect();
    // const db = mongoClient.db("UOL_API");

    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
    // mongoClient.close();
  } catch (err) {
    res.status(500).send(err);
    console.log("consolelog maneiro erro no envio de mensagem");
    // mongoClient.close();
  }
});
app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;
  try {
    // await mongoClient.connect();
    // const db = mongoClient.db("UOL_API");

    let messages = await db.collection("messages").find({}).toArray();
    let messagesDisplay = messages.filter((message) => {
      const publicMessage = message.type === "message";
      const userPrivateMessage = message.to === user || message.from === user;
      return publicMessage || userPrivateMessage;
    });

    messagesDisplay = messages.splice(0, limit);
    res.send(messagesDisplay);
    // mongoClient.close();
  } catch (err) {
    console.log("consolelog maneiro erro pegando as mensagens");
    res.status(500).send(err);
    // mongoClient.close();
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  try {
    // await mongoClient.connect();
    // const db = mongoClient.db("UOL_API");

    const participant = await db
      .collection("participants")
      .findOne({ name: user });

    if (!participant) {
      console.log("erro na verifica~çao do participante no status");
      res.sendStatus(404);
      return;
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
    // mongoClient.close();
  } catch (err) {
    console.log("erro no status", err);
    res.status(500).send(err);
    // mongoClient.close();
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
  } catch (err) {
    console.log("erro no checkou de usuarios", err);
    res.sendStatus(500);
  }
}, CHECKOUT_TIME);

app.listen(5000);
