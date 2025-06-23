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
        // Get chat history from Cosmos DB
        const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
        const database = cosmosClient.database('ireigpt-db');
        const container = database.container('conversations');

        const querySpec = {
            query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp ASC',
            parameters: [
                { name: '@userId', value: userId }
            ]
        };

        const { resources: conversations } = await container.items.query(querySpec).fetchAll();

        // Format conversations for frontend
        const history = [];
        conversations.forEach(conv => {
            history.push({ role: 'user', content: conv.userMessage });
            history.push({ role: 'bot', content: conv.botResponse });
        });

        context.res = {
            status: 200,
            body: history
        };

    } catch (error) {
        context.log('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error' }
        };
    }
};
