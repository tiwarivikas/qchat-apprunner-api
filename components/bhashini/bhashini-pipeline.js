const axios = require("axios");

class BhashiniPipeline {
  constructor() {
    this.AUTH_URL =
      "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
    this.pipelineId = "64392f96daac500b55c543cd";
    this.bhashiniResp = undefined;
    this.userId = undefined;
    this.ulcaApiKey = undefined;
  }

  initialize(userId, ulcaApiKey) {
    this.userId = userId;
    this.ulcaApiKey = ulcaApiKey;
  }

  getCurrentBhashiniResp() {
    return this.bhashiniResp;
  }

  resetBhashiniResp() {
    this.bhashiniResp = undefined;
  }

  async getBhashiniPipelineConfig(pipelineTaskConfig) {
    const inputParams = {
      pipelineTasks: pipelineTaskConfig,
      pipelineRequestConfig: {
        pipelineId: this.pipelineId,
      },
    };

    const response = await axios({
      method: "POST",
      url: this.AUTH_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        userID: this.userId,
        ulcaApiKey: this.ulcaApiKey,
      },
      data: inputParams,
      timeout: 60000,
    });

    if (response.status !== 200) {
      throw new Error("Some error in auth");
    } else {
      this.bhashiniResp = {
        serviceId: response.data.pipelineResponseConfig[0].config[0].serviceId,
        modelId: response.data.pipelineResponseConfig[0].config[0].modelId,
        apiEndPoint: response.data.pipelineInferenceAPIEndPoint.callbackUrl,
        apiKey: response.data.pipelineInferenceAPIEndPoint.inferenceApiKey.name,
        apiValue:
          response.data.pipelineInferenceAPIEndPoint.inferenceApiKey.value,
      };
    }

    return this.bhashiniResp;
  }

  async configureBhashiniPipelineForTTS(lang) {
    const pipelineTaskConfig = [
      {
        taskType: "tts",
        config: {
          language: {
            sourceLanguage: lang,
          },
        },
      },
    ];
    return this.getBhashiniPipelineConfig(pipelineTaskConfig);
  }

  async configureBhashiniPipelineForSTT(lang) {
    throw new Error("Method not implemented." + lang);
  }
}

module.exports = BhashiniPipeline;
