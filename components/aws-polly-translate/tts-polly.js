const {
  PollyClient,
  SynthesizeSpeechCommand,
} = require("@aws-sdk/client-polly"); // CommonJS import

const { ttsBhashini } = require("../bhashini/bhashini-tts");

async function textToSpeechStream(text, res, translationLanguage) {
  //Handle English and Hindi directly, else call Bhashini APIs for other Indian languages
  if (translationLanguage == "hi" || translationLanguage == "en") {
    try {
      const client = new PollyClient({});
      const input = {
        // SynthesizeSpeechInput
        Engine: "neural",
        LanguageCode: translationLanguage + "-IN",
        OutputFormat: "mp3", // required
        Text: text, // required
        TextType: "text",
        VoiceId: "Kajal", // required
      };

      const command = new SynthesizeSpeechCommand(input);
      const response = await client.send(command);

      // Stream the audio data to the client in chunks
      if (response.AudioStream) {
        response.AudioStream.on("data", (chunk) => {
          res.write(`data: ${chunk.toString("base64")}\n\n`);
        });

        response.AudioStream.on("end", () => {
          res.write("event: end\n");
          res.write("data: End of stream\n\n");
          res.write("data: [END]\n\n");
          res.end();
        });

        response.AudioStream.on("error", (err) => {
          console.error("Error streaming audio:", err);
          res.status(500).end();
        });
      } else {
        res.status(500).send("No audio stream received from Polly.");
      }
    } catch (err) {
      console.error("Error:", err);
    }
  } else {
    //Call Bhashini TTS APIs
    try {
      const respAudio = await ttsBhashini(text, translationLanguage, "Female");
      // Assuming `respAudio` is a Buffer or a Base64 encoded string
      //const audioBuffer = Buffer.from(respAudio[0].audioContent, "base64");

      //res.write(`data: ${audioBuffer.toString("base64")}\n\n`);

      const firstAudioByte = respAudio[0].audioContent;
      res.write(`data: ${firstAudioByte}\n\n`);
      //res.write(`data: ${respAudio.toString("base64")}\n\n`);
      res.write("event: end\n");
      res.write("data: End of stream\n\n");
      res.write("data: [END]\n\n");
      res.end();
    } catch (err) {
      console.error("Error:", err);
    }
  }
}

module.exports = { textToSpeechStream };
