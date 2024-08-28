const {
  TranslateClient,
  TranslateTextCommand,
} = require("@aws-sdk/client-translate");

const { bhashiniTranslation } = require("../bhashini/bhashini-translation");

const translateClient = new TranslateClient({});

// Function to translate text
async function translateText(text, sourceLanguageCode, targetLanguageCode) {
  if (sourceLanguageCode == targetLanguageCode) return text;

  //Handle English and Hindi directly, else call Bhashini APIs for other Indian languages
  if (
    (sourceLanguageCode == "hi" && targetLanguageCode == "en") ||
    (sourceLanguageCode == "en" && targetLanguageCode == "hi")
  ) {
    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguageCode,
      TargetLanguageCode: targetLanguageCode,
    });

    try {
      const response = await translateClient.send(command);
      return response.TranslatedText;
    } catch (error) {
      console.error("Error translating text:", error);
      throw error;
    }
  } else {
    //Call the Bhashini APIs
    return await bhashiniTranslation(
      text,
      sourceLanguageCode,
      targetLanguageCode
    );
  }
}

module.exports = { translateText };
