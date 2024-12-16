"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const client_bedrock_agent_runtime_1 = require("@aws-sdk/client-bedrock-agent-runtime");
const client = new client_bedrock_agent_runtime_1.BedrockAgentRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
async function POST(request) {
    try {
        const { message } = await request.json();
        const command = new client_bedrock_agent_runtime_1.InvokeAgentCommand({
            agentId: process.env.BEDROCK_AGENT_ID,
            agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
            sessionId: 'test-session', // TODO: Implement proper session management
            inputText: message,
        });
        const response = await client.send(command);
        return server_1.NextResponse.json({
            response: response.completion || 'No response from agent',
        });
    }
    catch (error) {
        console.error('Error invoking Bedrock agent:', error);
        return server_1.NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLG9CQXVCQztBQTlCRCx3Q0FBd0Q7QUFDeEQsd0ZBQXNHO0FBRXRHLE1BQU0sTUFBTSxHQUFHLElBQUksd0RBQXlCLENBQUM7SUFDM0MsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFdBQVc7Q0FDOUMsQ0FBQyxDQUFDO0FBRUksS0FBSyxVQUFVLElBQUksQ0FBQyxPQUFvQjtJQUM3QyxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFekMsTUFBTSxPQUFPLEdBQUcsSUFBSSxpREFBa0IsQ0FBQztZQUNyQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0I7WUFDckMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCO1lBQ2hELFNBQVMsRUFBRSxjQUFjLEVBQUUsNENBQTRDO1lBQ3ZFLFNBQVMsRUFBRSxPQUFPO1NBQ25CLENBQUMsQ0FBQztRQUVILE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1QyxPQUFPLHFCQUFZLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLFFBQVEsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLHdCQUF3QjtTQUMxRCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0JBQStCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEQsT0FBTyxxQkFBWSxDQUFDLElBQUksQ0FDdEIsRUFBRSxLQUFLLEVBQUUsMkJBQTJCLEVBQUUsRUFDdEMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQ2hCLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2UgfSBmcm9tICduZXh0L3NlcnZlcic7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRSdW50aW1lQ2xpZW50LCBJbnZva2VBZ2VudENvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtYmVkcm9jay1hZ2VudC1ydW50aW1lJztcblxuY29uc3QgY2xpZW50ID0gbmV3IEJlZHJvY2tBZ2VudFJ1bnRpbWVDbGllbnQoe1xuICByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG59KTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG1lc3NhZ2UgfSA9IGF3YWl0IHJlcXVlc3QuanNvbigpO1xuXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBJbnZva2VBZ2VudENvbW1hbmQoe1xuICAgICAgYWdlbnRJZDogcHJvY2Vzcy5lbnYuQkVEUk9DS19BR0VOVF9JRCxcbiAgICAgIGFnZW50QWxpYXNJZDogcHJvY2Vzcy5lbnYuQkVEUk9DS19BR0VOVF9BTElBU19JRCxcbiAgICAgIHNlc3Npb25JZDogJ3Rlc3Qtc2Vzc2lvbicsIC8vIFRPRE86IEltcGxlbWVudCBwcm9wZXIgc2Vzc2lvbiBtYW5hZ2VtZW50XG4gICAgICBpbnB1dFRleHQ6IG1lc3NhZ2UsXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGNvbW1hbmQpO1xuXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHtcbiAgICAgIHJlc3BvbnNlOiByZXNwb25zZS5jb21wbGV0aW9uIHx8ICdObyByZXNwb25zZSBmcm9tIGFnZW50JyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbnZva2luZyBCZWRyb2NrIGFnZW50OicsIGVycm9yKTtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oXG4gICAgICB7IGVycm9yOiAnRmFpbGVkIHRvIHByb2Nlc3MgbWVzc2FnZScgfSxcbiAgICAgIHsgc3RhdHVzOiA1MDAgfVxuICAgICk7XG4gIH1cbn1cbiJdfQ==