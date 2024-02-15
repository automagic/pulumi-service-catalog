import {
	OutputMap,
	RemoteWorkspace,
	fullyQualifiedStackName,
} from "@pulumi/pulumi/automation";

import * as aws from "aws-sdk";
import { Handler, Context } from "aws-lambda";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";

interface DeploymentInput {
	repository_url: string;
	branch: string;
	project: string;
	projectPath: string | undefined;
	stack: string | undefined;
	environments: string[] | undefined;
	destroy: boolean | undefined;
}

interface DeploymentEvent {
	input: DeploymentInput;
	taskToken: string;
}

const org = process.env.ORGANIZATION ?? "initech";
const stepFunctions = new aws.StepFunctions();

export const handler: Handler<DeploymentEvent> = async (
	event: DeploymentEvent,
	context: Context
): Promise<any> => {
	try {
		console.log(`Deploying Stack ${event.input.stack}`);
		const output = await deploy(event);
		await stepFunctions
			.sendTaskSuccess({
				taskToken: event.taskToken,
				output: JSON.stringify(output),
			})
			.promise();
	} catch (err) {
		console.log(err);
		await stepFunctions
			.sendTaskFailure({
				taskToken: event.taskToken,
				error: (err as Error).message.substring(0, 255),
			})
			.promise();
	}
};

const deploy = async (event: DeploymentEvent) => {
	const branch = `${org}/${event.input.project}/${event.input.stack ?? "dev"}`;

	if (!event.input.destroy) {
		await newBranch(event.input.repository_url, event.input.branch, branch);
	}

	const stackName = fullyQualifiedStackName(
		org,
		event.input.project,
		event.input.stack ?? "dev"
	);

	const preRunCommands = [];
	if (event.input.environments && event.input.environments.length > 0) {
		const environments = event.input.environments.join(" ");
		preRunCommands.push(
			`pulumi config env add ${environments} --stack ${stackName} --yes`
		);
	}

	const stack = await RemoteWorkspace.createOrSelectStack(
		{
			stackName,
			url: event.input.repository_url,
			branch,
			projectPath: event.input.projectPath ?? "",
		},
		{
			envVars: {
				AWS_REGION: "us-west-2",
				PULUMI_ACCESS_TOKEN: process.env.PULUMI_ACCESS_TOKEN ?? "",
			},
			preRunCommands,
		}
	);

	if (event.input.destroy) {
		const res = await stack.destroy({
			onOutput: (out: string) => {
				console.log(out);
			},
			onEvent: async () => {
				await stepFunctions
					.sendTaskHeartbeat({ taskToken: event.taskToken })
					.promise();
			},
		});

		await deleteStack(stackName);
		await deleteBranch(event.input.repository_url, stackName);

		return {
			result: res.summary.result,
			message: res.summary.message,
			outputs: {} as OutputMap,
		};
	} else {
		await patchDeploymentSettings(stackName, event.input, branch);

		const res = await stack.up({
			onOutput: (out: string) => {
				console.log(out);
			},
			onEvent: async () => {
				await stepFunctions
					.sendTaskHeartbeat({ taskToken: event.taskToken })
					.promise();
			},
		});

		await tagStack(stackName, "pulumi:sc", "true");

		return {
			result: res.summary.result,
			message: res.summary.message,
			outputs: res.outputs,
		};
	}
};

const patchDeploymentSettings = async (
	stackName: string,
	input: DeploymentInput,
	branch: string
) => {
	const preRunCommands = [];
	if (input.environments && input.environments.length > 0) {
		const environments = input.environments.join(" ");
		preRunCommands.push(
			`pulumi config env add ${environments} --stack ${stackName} --yes`
		);
	}

	const bodyContent = {
		sourceContext: {
			git: {
				repoURL: input.repository_url,
				repoDir: input.projectPath,
				branch,
			},
		},
		operationContext: {
			preRunCommands: preRunCommands,
			environmentVariables: {
				AWS_REGION: "us-west-2",
				PULUMI_ACCESS_TOKEN: process.env.PULUMI_ACCESS_TOKEN ?? "",
			},
		},
	};

	const headers: Headers = new Headers();
	headers.set("Content-Type", "application/json");
	headers.set("Accept", "application/json");
	headers.set("Authorization", `token ${process.env.PULUMI_ACCESS_TOKEN}`);

	const request: RequestInfo = new Request(
		`https://api.pulumi.com/api/stacks/${stackName}/deployments/settings`,
		{
			method: "POST",
			headers: headers,
			body: JSON.stringify(bodyContent),
		}
	);

	return await fetch(request).then((res) => res.json());
};

const newBranch = async (
	repository_url: string,
	branch: string,
	stack: string
) => {
	try {
		const dir = uuidv4();
		await execute(
			`cd /tmp && \
       mkdir ${dir} && cd ${dir} && \
       git clone --depth 1 --branch ${branch} ${repository_url} && \
       cd "$(basename "$_" .git)" && \
       git checkout -b ${stack} && \
       git push origin ${stack} && \
       cd /tmp && rm -rf ${dir}`
		);
	} catch (e) {
		console.error((e as Error).message);
		// if the promise rejects, we land here
	}
};

const deleteBranch = async (repository_url: string, stack: string) => {
	try {
		const dir = uuidv4();

		await execute(
			`cd /tmp && \
       mkdir ${dir} && cd ${dir} && \
       git clone --depth 1 --branch ${stack} ${repository_url} && \
       cd "$(basename "$_" .git)" && \
       git push origin --delete ${stack} && \
       cd /tmp && rm -rf ${dir}`
		);
	} catch (e) {
		console.error((e as Error).message);
		// if the promise rejects, we land here
	}
};

const deleteStack = async (stackName: string) => {
	try {
		await execute(`pulumi stack rm ${stackName} --yes`);
	} catch (e) {
		console.error((e as Error).message);
		// if the promise rejects, we land here
	}
};

const tagStack = async (
	stackName: string,
	tagName: string,
	tagValue: string
) => {
	try {
		await execute(
			`pulumi stack tag set ${tagName} ${tagValue} -s ${stackName}`
		);
	} catch (e) {
		console.error((e as Error).message);
		// if the promise rejects, we land here
	}
};

const execute = async (command: string): Promise<any> => {
	return new Promise((resolve, reject) => {
		console.log(`> ${command}`);
		exec(command, (error, stdout, stderr) => {
			if (!!stdout) {
				console.log(stdout);
			}

			if (!!stderr) {
				console.error(stderr);
			}

			if (!!error) {
				reject(error.message);
				return;
			}

			resolve(stdout);
		});
	});
};
