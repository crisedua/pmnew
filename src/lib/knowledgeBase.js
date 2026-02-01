// AI Knowledge Base - Embedding and Search Utilities
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Generate embeddings using OpenAI (via Vercel Serverless Function)
export async function generateEmbedding(text) {
    try {
        // Use the server-side API route to protect the API key
        const response = await fetch('/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: text.slice(0, 8000), // Limit input size
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Embedding API error: ${response.status} - ${error.error?.message || error.error || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

// Split text into chunks for embedding
export function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = end - overlap;
        if (start + overlap >= text.length) break;
    }

    return chunks;
}

// Extract text from various file types
export async function extractTextFromFile(file) {
    return new Promise((resolve, reject) => {
        // Supported text types
        const textTypes = [
            'text/plain', 'application/json', 'text/markdown', 'text/csv',
            'application/javascript', 'text/html', 'text/css'
        ];
        const textExtensions = ['.txt', '.json', '.md', '.markdown', '.csv', '.js', '.jsx', '.html', '.css'];

        const isText = textTypes.includes(file.type) || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!isText) {
            console.warn(`File type ${file.type} (${file.name}) not supported for client-side indexing.`);
            resolve(''); // Return empty to skip indexing
            return;
        }

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                resolve(content);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Process document and store embeddings
export async function processDocumentForKnowledgeBase(supabase, documentId, file) {
    try {
        // 1. Extract text from file
        const text = await extractTextFromFile(file);

        if (!text || text.length < 10) {
            console.warn('No text content to embed');
            return { success: false, message: 'No text content found' };
        }

        // 2. Chunk the text
        const chunks = chunkText(text);
        console.log(`Processing ${chunks.length} chunks for document ${documentId}`);

        // 3. Generate embeddings and store each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await generateEmbedding(chunk);

            // 4. Store in Supabase
            const { error } = await supabase
                .from('document_chunks')
                .insert({
                    document_id: documentId,
                    content: chunk,
                    embedding: embedding,
                    chunk_index: i,
                    metadata: {
                        file_name: file.name,
                        file_type: file.type,
                        chunk_of: chunks.length
                    }
                });

            if (error) {
                console.error('Error storing chunk:', error);
                // Continue with other chunks
            }
        }

        return { success: true, chunksProcessed: chunks.length };
    } catch (error) {
        console.error('Error processing document:', error);
        return { success: false, message: error.message };
    }
}

// Search knowledge base for relevant content
export async function searchKnowledgeBase(supabase, query, areaId = null, limit = 5) {
    try {
        // 1. Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // 2. Call the similarity search function
        const { data, error } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: limit,
            filter_area_id: areaId
        });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        return [];
    }
}
