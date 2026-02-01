// Use serverless API route instead of direct OpenAI API call
const API_URL = '/api/chat';

console.log('✓ OpenAI client configured to use serverless API');

export async function callOpenAI(messages, tools = null) {
    try {
        const payload = {
            messages: messages,
            tools: tools
        };

        console.log('Sending request to API route:', { 
            messageCount: messages.length,
            hasTools: !!tools 
        });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('API Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error details:', errorData);
            
            const errorMsg = errorData.error?.message || errorData.error || 'Unknown error';
            throw new Error(`API error: ${response.status} - ${errorMsg}`);
        }

        const data = await response.json();
        console.log('API Response Success');
        return data.choices[0].message;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw error;
    }
}
