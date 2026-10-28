import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuthUser } from '@/lib/apiAuth';
import { meldujZuzycie } from '@/lib/anthropic';

/** Meldunek Gemini do tablicy zużycia Huba (tokeny z usageMetadata). */
const zmelduj = (funkcja: string, u?: { promptTokenCount?: number; candidatesTokenCount?: number }) =>
    meldujZuzycie({ dostawca: 'gemini', funkcja, model: 'gemini-1.5-flash', we: u?.promptTokenCount ?? 0, wy: u?.candidatesTokenCount ?? 0 });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    const user = await getAuthUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { messages, systemInstruction, fileData } = body as {
        messages: { role: 'user' | 'model'; text: string }[];
        systemInstruction?: string;
        fileData?: { base64: string; mimeType: string };
    };

    if (!messages || !Array.isArray(messages)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        ...(systemInstruction ? { systemInstruction } : {}),
    });

    // File analysis (no chat history)
    if (fileData) {
        const prompt = messages[messages.length - 1]?.text || '';
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: fileData.base64, mimeType: fileData.mimeType } },
        ]);
        zmelduj('analiza-pliku', result.response.usageMetadata);
        return NextResponse.json({ text: result.response.text() });
    }

    // Chat
    const history = messages.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }],
    }));
    const lastMessage = messages[messages.length - 1]?.text || '';

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    zmelduj('czat-gemini', result.response.usageMetadata);
    return NextResponse.json({ text: result.response.text() });
}
