import { CopilotClient } from "@github/copilot-sdk";
import * as readline from "readline";
import { getWeather } from "./tools/weatherTool.mts";
import { log } from "./log.mts";

// Create client and session
const client = new CopilotClient({
  mode: "copilot-cli"
});
const session = await client.createSession({
    model: "claude-haiku-4.5",
    streaming: true,
    tools: [getWeather],
    skillDirectories: ["./skills"],
});

// Print assistant messages as they arrive
session.on("assistant.message_delta", (event) => {
    process.stdout.write(event.data.deltaContent);
});

// Logging
session.on("skill.invoked", (event) => log({ skillInvoked: event.data.name }));
session.on("tool.execution_start", (event) => log({ toolInvoked: event.data.toolName, args: event.data.arguments }));
session.on("assistant.reasoning", (event) => log({ reasoning: event.data.content }));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log(`
🧰/🤹  CoPilot Custom Agent (type 'exit' to quit)

    [Tool] Try: 'What's the weather in Paris?'
    [Skill]Try: 'Who is Tobias?'
`);

const prompt = () => {
    rl.question("You: ", async (input) => {
        if (input.toLowerCase() === "exit") {
            await client.stop();
            rl.close();
            return;
        }

        process.stdout.write("Assistant: ");
        const res = await session.sendAndWait({ prompt: input });
        console.log("\n");
        prompt();
    });
};

prompt();