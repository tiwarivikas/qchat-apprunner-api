require('dotenv').config();
const cors = require('cors');
const express = require('express');

const {chat} = require('./components/chat-service');
const {authenticateJWT} = require('./components/auth-service');
const { speechSynthesizeTTS } = require("./components/bhashini/bhashini-tts");
const {
  textToSpeechStream,
} = require("./components/aws-polly-translate/tts-polly");

const {
  bhashiniTranslation,
} = require("./components/bhashini/bhashini-translation");

const app = express();
const PORT = process.env.PORT || 3000;

// Use the cors middleware
app.use(cors());

// Optionally, configure CORS to allow specific origins
/* app.use(cors({
    origin: ['https://chat.cloudevangelist.in/*', "http://localhost:3000/*"],
    methods: ['OPTIONS', 'GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
})); */

// SSE endpoint
app.get("/stream", authenticateJWT, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chatMsg = req.query.chat;
  const translationLanguage = req.query.translationLanguage;
  const isSpeakerEnabled = req.query.isSpeakerEnabled;
  if (!chatMsg) res.status(401).send("Exception: Chat Param is missing.");

  const response = await chat(
    chatMsg,
    res.locals.decodedToken,
    res,
    isSpeakerEnabled,
    translationLanguage
  );

  // Clean up when client closes connection
  req.on("close", () => {
    res.end();
  });
});

app.get("/test", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const response = await bhashiniTranslation("How are you?", "en", "mr");
  console.log(response);
  const respAudio = await textToSpeechStream(response, res, "mr");
  console.log("getting first Audio ");
  //const firstAudioByte = respAudio[0].audioContent;
  //console.log(firstAudioByte);

  //res.status(200).send(response);

  // Clean up when client closes connection
  req.on("close", () => {
    res.end();
  });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



//curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU3Mjg0ZGJhLWQzMzMtNDRlMC1iMjE2LWI0Y2M0ZjJkZDNjNCIsImN1c3RvbWVyIjoiUGFzc3BvcnQtU2V2YSIsIndlYnNpdGUiOiJodHRwczovL3d3dy5wYXNzcG9ydGluZGlhLmdvdi5pbi8iLCJhZGRpdGlvbmFsX3NpdGVzIjpbXSwiY2hhdGJvdG5hbWUiOiJQYXNzcG9ydCBTZXZhayIsImNoYXRib3RfbG9nb191cmwiOm51bGwsImluaXRpYWxfdGV4dCI6IkhlbGxvLCBJIGFtIFFDaGF0LiBIb3cgY2FuIEkgaGVscCB5b3U_IiwiZ3VhcmRyYWlscyI6IllvdSBhcmUgYSBwb2xpdGUgYW5kIGhvbmVzdCBjaGF0Ym90LCB3aG8gcmVzcG9uZHMgdG8gcXVlcmllcyB3aXRoIGVtcGF0aHkuIiwiYWNjZXB0VG5DIjp0cnVlLCJkb2NzIjpudWxsLCJib3Rfc3RhdHVzIjpudWxsLCJxY2hhdGZvcm1fc3RhdHVzIjoiQ29tcGxldGVkIiwicmVnaW9uUSI6Ik5PUlRIX1ZJUkdJTklBIiwiZXhwaXJ5X2RhdGV0aW1lIjpudWxsLCJyZXF1ZXN0ZXJfZW1haWwiOiJ0aXd2aWthQGFtYXpvbi5jb20iLCJhcHBsaWNhdGlvbklkUSI6IjU4NDU1MWY1LWVhOWUtNGQ2ZC04ODA1LTVlZDk0ZTAyZjc2ZSIsImluZGV4ZWRQYWdlcyI6IjkwMiIsImNyZWF0ZWRBdCI6IjIwMjQtMDgtMDJUMDQ6NTM6MTAuNjc3WiIsInVwZGF0ZWRBdCI6IjIwMjQtMDgtMDdUMTY6MjI6NTQuOTgzWiIsImlhdCI6MTcyMzYwODkyNCwiZXhwIjoxNzI0MjEzNzI0fQ.23IKc_qkn8f8JlGLa3K0UwM2jsLfWWVWkrzdHiVOLhk" "http://localhost:4000/stream?chat=%7B%22conversationId%22%3A%22%22%2C%22parentMessageId%22%3A%22%22%2C%22userMessage%22%3A%22hi%22%2C%22clientToken%22%3A%227f338202-97b3-4419-b434-833d6773ff5e%22%7D&stream=true&isSpeakerEnabled=false"