const { KendraClient, QueryCommand, QueryResultType, RetrieveCommand } = require("@aws-sdk/client-kendra");

async function retrieveKendraSearch(query, dsId) {
    try {
        const client = new KendraClient({ region: "ap-south-1" });
        const inputKendra = {
            AttributeFilter:
            {
                OrAllFilters: [{
                    EqualsTo: {
                        Key: "_data_source_id",
                        Value: { StringValue: `${dsId}` }
                    }
                }]
            },
            IndexId: process.env.KENDRA_INDEXID,
            PageNumber: 1,
            PageSize: 10,
            QueryText: query,
            SpellCorrectionConfiguration: { IncludeQuerySpellCheckSuggestions: true },
        }

        const command = new RetrieveCommand(inputKendra);
        const response = await client.send(command);
        const queries = response.ResultItems?.map((item) => {
            return "\n Title: " + item.DocumentTitle + "\n URI: " + item.DocumentURI + "\n Confidence level: " + item.ScoreAttributes?.ScoreConfidence + "\n Content: " + item.Content
        })
        return queries?.join('\n')
    } catch (error) {
        console.log(error);
        return "Exception: Assistant is not available. Please try after some time.";
    }
}

module.exports =  {retrieveKendraSearch}