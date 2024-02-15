"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const automation_1 = require("@pulumi/pulumi/automation");
const org = (_a = process.env.ORGANIZATION) !== null && _a !== void 0 ? _a : "";
const handler = async (event) => {
    try {
        var res = await deploy(event);
        return res.result;
    }
    catch (err) {
        console.log(err);
        return {
            statusCode: 500,
        };
    }
};
exports.handler = handler;
const deploy = async (event) => {
    var _a, _b, _c;
    const stack = await automation_1.RemoteWorkspace.createOrSelectStack({
        stackName: (0, automation_1.fullyQualifiedStackName)(org, event.project, (_a = event.stack) !== null && _a !== void 0 ? _a : "dev"),
        url: event.repository_url,
        branch: event.branch,
        projectPath: (_b = event.projectPath) !== null && _b !== void 0 ? _b : "",
    }, {
        envVars: {
            AWS_REGION: "us-west-2",
            PULUMI_ACCESS_TOKEN: (_c = process.env.PULUMI_ACCESS_TOKEN) !== null && _c !== void 0 ? _c : "",
        },
    });
    const upRes = await stack.up({ onOutput: console.log });
    return upRes.summary;
};
