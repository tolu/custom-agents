import { GoogleGenAI } from "@google/genai";
import * as readline from "readline";
import { getWeather } from "./tools/weatherTool.mts";
import { loadSkills, makeSkillTool, USE_SKILL } from "./skills/loader.mts";
import { log } from "./log.mts";

if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY not set in environment.");
    process.exit(1);
}

// Create client and chat session. Expects GEMINI_API_KEY in the environment.
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const skills = loadSkills("./skills");
const tools = [getWeather, makeSkillTool(skills)];
const handlers = new Map(tools.map((t) => [t.declaration.name, t.handler]));

// Unlike copilot (which takes `skillDirectories` + `tools` directly on the
// session and discovers skills natively), here we register everything as plain
// Gemini function declarations and steer skill use via the system prompt.
const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
        systemInstruction:
            "You are a helpful custom agent. When a question matches an available " +
            `skill, call the \`${USE_SKILL}\` tool to load its instructions before answering.`,
        tools: [{ functionDeclarations: tools.map((t) => t.declaration) }],
        // Opt in to thinking. Gemini doesn't return thought summaries unless
        // asked; copilot surfaces reasoning automatically via event "assistant.reasoning".
        thinkingConfig: { includeThoughts: true },
    },
});

// Stream the model's reply, running any tool calls and looping until it answers.
// Copilot hides this whole loop behind `sendAndWait`; with the raw Gemini SDK we
// drive it ourselves: stream -> collect tool calls -> run handlers -> feed
// results back -> repeat until the model emits a final answer with no calls.
const send = async (message: any) => {
    let next = message;
    while (true) {
        const stream = await chat.sendMessageStream({ message: next });
        const calls: any[] = [];
        for await (const chunk of stream) {
            // Walk parts by hand instead of using chunk.text / chunk.functionCalls.
            // Those convenience getters warn ("there are non-text parts...") when a
            // chunk mixes text + functionCall, and they hide thought parts entirely.
            const parts = chunk.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
                if (part.functionCall) {
                    calls.push(part.functionCall);
                } else if (part.thought && part.text) {
                    // Thought summaries arrive as text parts flagged `thought`.
                    // Log them rather than printing (mirrors copilot's reasoning log).
                    log({ reasoning: part.text });
                } else if (part.text) {
                    process.stdout.write(part.text);
                }
            }
        }

        if (calls.length === 0) return;

        // Resolve every requested call in parallel, then feed results back.
        const responses = await Promise.all(
            calls.map(async (call) => {
                // Split skill vs tool logging to mirror copilot's separate
                // skill.invoked / tool.execution_start events.
                if (call.name === USE_SKILL) log({ skillInvoked: call.args?.name });
                else log({ toolInvoked: call.name, args: call.args });

                let result: unknown;
                try {
                    result = await handlers.get(call.name)?.(call.args ?? {});
                } catch (err) {
                    result = { error: String(err) };
                }
                return { functionResponse: { name: call.name, response: { result } } };
            }),
        );
        next = responses;
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log(`
🧰/🤹  Gemini Custom Agent (type 'exit' to quit)

    [Tool] Try: 'What's the weather in Paris?'
    [Skill]Try: 'Who is Tobias?'
`);

const prompt = () => {
    rl.question("You: ", async (input) => {
        if (input.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        process.stdout.write("Assistant: ");
        await send(input);
        console.log("\n");
        prompt();
    });
};

prompt();
