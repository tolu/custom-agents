import { Type, type FunctionDeclaration } from "@google/genai";

// Gemini wants a FunctionDeclaration (the JSON schema the model sees); the
// handler is ours to run when the model calls it. We bundle the two so
// main.mts can register + dispatch in one place.
export const getWeather = {
    declaration: {
        name: "get_weather",
        description: "Get the current weather for a city",
        parameters: {
            type: Type.OBJECT,
            properties: {
                city: { type: Type.STRING, description: "The city name" },
            },
            required: ["city"],
        },
    } satisfies FunctionDeclaration,
    handler: async ({ city }: { city: string }) => {
        const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
        const temp = Math.floor(Math.random() * 30) + 50;
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        return { city, temperature: `${temp}°F`, condition };
    },
};
