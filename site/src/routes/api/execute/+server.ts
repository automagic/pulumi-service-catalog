import * as AWS from "@aws-sdk/client-sfn";
import { error, json } from "@sveltejs/kit";
import {v4 as uuidv4} from 'uuid';
import type { StartExecutionRequest } from "../../../models";

const client = new AWS.SFN({ region: process.env.AWS_REGION });

export async function POST({ request }) {

    const inputData = (await request.json()) as StartExecutionRequest;

    let inputJson: any = {
        "repository_url": inputData.repository_url,
        "branch": inputData.branch ?? "/refs/heads/main",  
        "project": inputData.project,
    };

    if (inputData.projectPath !== undefined) {
        inputJson['projectPath'] = inputData.projectPath;
    }

    if (inputData.branch !== undefined) {
        inputJson['branch'] = inputData.branch
    } else {
        inputJson['branch'] = 'refs/heads/main';
    }

    if( inputData.environments !== undefined) {
        inputJson['environments'] = inputData.environments;
    }

    try {
        const data = await client.startExecution({
            stateMachineArn: 'arn:aws:states:us-west-2:052848974346:stateMachine:sc-deployment-state-machine',
            input: JSON.stringify(inputJson),
            name: uuidv4(),
        });

        return json(data, { status: 200 });

    } catch (e) {
        console.log(e);
        return error(500, e as Error);
    }
}