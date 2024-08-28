const axios = require("axios");

async function bhashiniTranslation(
  text,
  sourceLanguageCode,
  targetLanguageCode
) {
  const inputParams = {
    pipelineTasks: [
      {
        taskType: "translation",
        config: {
          language: {
            sourceLanguage: sourceLanguageCode,
            targetLanguage: targetLanguageCode,
          },
          serviceId: "ai4bharat/indictrans-v2-all-gpu--t4",
        },
      },
    ],
    inputData: {
      input: [
        {
          source: text,
        },
      ],
    },
  };

  return await getTranslation(inputParams);

  async function getTranslation(inputParams) {
    const eventSourceUrl =
      "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";

    const translatedResponse = await axios({
      method: "POST",
      url: eventSourceUrl,
      headers: {
        Authorization:
          "OFpsobeMY8UzaSA1WkUJkX1Hz26uQSPqsK2qlmPziCFEzWq_YtdV4c2OAqT8PgNC",
        "Content-Type": "application/json",
        accept: "application/json",
      },
      data: inputParams,
      timeout: 60000,
    });
    return translatedResponse.data.pipelineResponse[0].output[0].target;
  }
}

module.exports = { bhashiniTranslation };
