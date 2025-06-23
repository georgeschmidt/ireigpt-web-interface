const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
    // Check if user is authenticated
    const clientPrincipal = req.headers['x-ms-client-principal'];
    if (!clientPrincipal) {
        context.res = {
            status: 401,
            body: { error: 'Authentication required' }
        };
        return;
    }

    const user = JSON.parse(Buffer.from(clientPrincipal, 'base64').toString());
    const userId = user.userId;

    try {
        const userMessage = req.body.message;
        
        // Call Azure OpenAI API
        const openaiResponse = await fetch('https://ireigpt.openai.azure.com/openai/deployments/gpt-35-turbo/chat/completions?api-version=2024-02-15-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.OPENAI_API_KEY
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const openaiData = await openaiResponse.json();
        const botResponse = openaiData.choices[0].message.content;

        // Save conversation to Cosmos DB
        const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
        const database = cosmosClient.database('ireigpt-db');
        const container = database.container('conversations');

        await container.items.create({
            id: `${userId}-${Date.now()}`,
            userId: userId,
            timestamp: new Date().toISOString(),
            userMessage: userMessage,
            botResponse: botResponse
        });

        context.res = {
            status: 200,
            body: { response: botResponse }
        };

    } catch (error) {
        context.log('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error' }
        };
    }
};
