const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Log API key status on module load (without exposing the key)
if (!OPENAI_API_KEY || OPENAI_API_KEY === '') {
    console.warn('⚠️ OpenAI API key not configured. AI Assistant will not work.');
} else {
    console.log('✓ OpenAI API key is configured');
}

export async function callOpenAI(messages, tools = null) {
    // Check if API key is configured
    if (!OPENAI_API_KEY || OPENAI_API_KEY === '') {
        throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
    }

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
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API error details:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            
            // Provide more specific error messages
            if (response.status === 401) {
                throw new Error('OpenAI API key is invalid or expired. Please check your VITE_OPENAI_API_KEY.');
            } else if (response.status === 400) {
                const errorMsg = errorData.error?.message || 'Invalid request format';
                console.error('400 Error details:', errorMsg);
                throw new Error(`OpenAI API request error: ${errorMsg}`);
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.choices[0].message;
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        throw error;
    }
}
