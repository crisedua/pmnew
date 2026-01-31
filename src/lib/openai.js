const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function callOpenAI(messages, tools = null) {
    try {
        const payload = {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
        };

        if (tools) {
            payload.tools = tools;
            payload.tool_choice = 'auto';
        }

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message;
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        throw error;
    }
}
