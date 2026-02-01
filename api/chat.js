// Vercel Serverless Function for OpenAI Chat
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const { messages, tools } = req.body;

        const payload = {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
        };

        if (tools) {
            payload.tools = tools;
            payload.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', errorData);
            return res.status(response.status).json({ error: errorData });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in chat API:', error);
        return res.status(500).json({ error: error.message });
    }
}
