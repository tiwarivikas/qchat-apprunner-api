const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly"); // CommonJS import

async function textToSpeechStream(text, res) {
    try {

        const client = new PollyClient({});
        const input = { // SynthesizeSpeechInput
            Engine: "neural",
            LanguageCode: "en-IN",
            OutputFormat: "mp3", // required
            Text: text, // required
            TextType: "text",
            VoiceId: "Kajal" , // required
        };
        
        const command = new SynthesizeSpeechCommand(input);
        const response = await client.send(command);

        // Stream the audio data to the client in chunks
    if (response.AudioStream) {
        response.AudioStream.on('data', (chunk) => {
          res.write(`data: ${chunk.toString('base64')}\n\n`);
        });
  
        response.AudioStream.on('end', () => {
          res.write('event: end\n');
          res.write('data: End of stream\n\n');
          res.write('data: [END]\n\n');
          res.end();
        });
  
        response.AudioStream.on('error', (err) => {
          console.error('Error streaming audio:', err);
          res.status(500).end();
        });
      } else {
        res.status(500).send('No audio stream received from Polly.');
      }
    } catch (err) {
        console.error("Error:", err);
    }
}

module.exports = {textToSpeechStream} 