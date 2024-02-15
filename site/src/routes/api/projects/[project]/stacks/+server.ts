import { error, json } from "@sveltejs/kit";

export async function GET({params}): Promise<Response> {

    const { project } = params;

    console.log(project);

    const headers: Headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.set("Authorization", `token ${process.env.PULUMI_ACCESS_TOKEN}`);    
    const request: RequestInfo = new Request(
        `https://api.pulumi.com/api/user/stacks?organization=${process.env.PULUMI_ORGANIZATION}&project=${project}&tagName=pulumi:sc`,
        {
          method: "GET",
          headers: headers
        }
    );

    const result = await fetch(request)
        .then((res) => {
            return res.json();
        });

    return json(result);
}