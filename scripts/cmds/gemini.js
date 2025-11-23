const { GoogleGenAI } = require("@google/genai");

// --- CONFIGURATION ---
// IMPORTANT: Replace this with your actual Gemini API key (starts with 'AIza...').
const apiKey = "AIzaSyDBFqdTMTJGi2UFuiUdlH5YZm7TMrZQs8s"; 
const maxTokens = 500;
const numberGenerateImage = 4;
const maxStorageMessage = 8; // Max number of messages (user + assistant) to keep in history
const systemPrompt = "You are Voidr - Your Complete Business Partner. Your main priority is to help businesses grow by supplying products and creating a strong online presence. Keep your responses helpful, business-focused, and professional. Always offer your services: Product Supply, Website Creation, Social Media Setup, Logo Design, and Audience Growth. Respond concisely.";


// Initialize global state objects if they don't exist
if (!global.temp)
	global.temp = {};
if (!global.temp.geminiUsing)
	global.temp.geminiUsing = {};
if (!global.temp.geminiHistory)
	global.temp.geminiHistory = {};

const { geminiUsing, geminiHistory } = global.temp;

// Initialize the Gemini AI client
let ai;
try {
    ai = new GoogleGenAI({ apiKey });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error.message);
}

// --- MODULE EXPORT ---
module.exports = {
	config: {
		name: "gemini",
		version: "1.0",
		author: "Gemini / NTKhang",
		countDown: 5,
		role: 0,
		description: {
			vi: "Chat với Gemini AI",
			en: "Chat with Gemini AI"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} <clear> - xóa lịch sử chat với gemini"
				+ "\n   {pn} <nội dung> - chat với gemini (sử dụng trả lời tin nhắn để tiếp tục trò chuyện)",
			en: "   {pn} <clear> - clear chat history with gemini"
				+ "\n   {pn} <content> - chat with gemini (use reply to continue the conversation)"
		}
	},

	langs: {
		// Languages are updated to reflect the new command name
		vi: {
			apiKeyEmpty: "Vui lòng cung cấp api key cho Gemini tại file scripts/cmds/gemini.js",
			yourAreUsing: "Bạn đang sử dụng Gemini chat, vui lòng chờ quay lại sau khi yêu cầu trước kết thúc",
			processingRequest: "Đang xử lý yêu cầu của bạn, quá trình này có thể mất vài phút, vui lòng chờ",
			invalidContent: "Vui lòng nhập nội dung bạn muốn chat",
			error: "Đã có lỗi xảy ra\n%1",
			clearHistory: "Đã xóa lịch sử chat của bạn với Gemini"
		},
		en: {
			apiKeyEmpty: "Please provide API key for Gemini at file scripts/cmds/gemini.js",
			yourAreUsing: "You are using Gemini chat, please wait until the previous request ends",
			processingRequest: "Processing your request, this process may take a few minutes, please wait",
			invalidContent: "Enter the content you want to chat",
			error: "An error has occurred\n%1",
			clearHistory: "Your chat history with Gemini deleted"
		}
	},

	onStart: async function ({ message, event, args, getLang, prefix, commandName }) {
		if (!apiKey || !ai)
			return message.reply(getLang('apiKeyEmpty', prefix));

		switch (args[0]) {
			case 'clear': {
				delete geminiHistory[event.senderID]; // Use delete to fully reset the chat session
				return message.reply(getLang('clearHistory'));
			}
			default: {
				const content = args.join(' ');
				if (!content)
					return message.reply(getLang('invalidContent'));

				handleGemini({ event, message, content, getLang, commandName });
			}
		}
	},

	onReply: async function ({ Reply, message, event, args, getLang, commandName }) {
		const { author } = Reply;
		if (author != event.senderID)
			return;

		const content = args.join(' ');
		if (!content)
			return message.reply(getLang('invalidContent'));

		handleGemini({ event, message, content, getLang, commandName });
	}
};


/**
 * Sends the message to the Gemini model and handles the chat history.
 */
async function handleGemini({ event, message, content, getLang, commandName }) {
	if (geminiUsing[event.senderID])
		return message.reply(getLang("yourAreUsing"));

	let sending;
	try {
		geminiUsing[event.senderID] = true;
		sending = await message.reply(getLang('processingRequest'));
		
        // 1. Initialize or load the chat session
        let chat = geminiHistory[event.senderID];

        if (!chat) {
            // Create a new chat session with the system instruction and model configuration
            chat = ai.chats.create({
                model: "gemini-2.5-flash", // Excellent for fast chat
                systemInstruction: systemPrompt,
                config: {
                    maxOutputTokens: maxTokens,
                    temperature: 0.7,
                }
            });
            geminiHistory[event.senderID] = chat;
        }

        // 2. Clear old messages if the history gets too long (maxStorageMessage is in pairs)
        // Gemini API manages history internally, but we can manage context size manually if needed.
        // For simplicity using the official SDK, we rely on the `startChat` history management,
        // but for deep control, you'd use `getHistory()` and manipulate the array.
        // We will stick to `delete geminiHistory[event.senderID]` on 'clear' for simplicity.

		// 3. Send the user's message
		const response = await chat.sendMessage({
            message: content
        });
		
		const text = response.candidates[0].content.parts[0].text;

		// 4. Reply to user
		const replyInfo = await message.reply(text);
		
		// Set reply context for follow-up conversation
		if (global.GoatBot && global.GoatBot.onReply) {
			global.GoatBot.onReply.set(replyInfo.messageID, {
				commandName,
				author: event.senderID,
				messageID: replyInfo.messageID,
				type: "gemini"
			});
		} else {
			console.warn("WARNING: global.GoatBot.onReply is not available.");
		}
		
		// Unsend the "Processing" message
		if (sending && sending.messageID) {
			message.unsend(sending.messageID);
		}
	}
	catch (err) {
		const errorMessage = err.message || "Unknown error.";
		console.error("Gemini Error:", errorMessage);
        
        // Check for common API key or configuration errors
        let replyMessage = getLang('error', errorMessage);
        if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("INVALID_ARGUMENT")) {
             replyMessage = `An error occurred. Please check your Gemini API key and model configuration.\nError: ${errorMessage}`;
        }
		
		return message.reply(replyMessage);
	}
	finally {
		delete geminiUsing[event.senderID];
	}
}
