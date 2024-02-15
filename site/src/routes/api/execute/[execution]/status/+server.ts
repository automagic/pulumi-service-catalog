import * as AWS from "@aws-sdk/client-sfn";
import { error, json } from "@sveltejs/kit";


const client = new AWS.SFN({ region: process.env.AWS_REGION });

export async function GET({params}): Promise<Response> {
    const { execution } = params;

    var res = await client.describeExecution({ executionArn: execution });
    switch (res.status) {
        case AWS.ExecutionStatus.SUCCEEDED:
            return json(JSON.parse(res.output!));
        default:
            return json({ 'status': res.status }, { status: 202});
    }
}