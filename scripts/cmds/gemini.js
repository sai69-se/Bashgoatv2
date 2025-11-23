const { GoogleGenAI } = require("@google/genai");

// ------------------------------------
//          🛠️ CONFIGURATION 🛠️
// ------------------------------------

// ⚠️ IMPORTANT: Replace this with your actual Gemini API key (starts with 'AIza...').
const apiKey = "AIzaSyDBFqdTMTJGi2UFuiUdlH5YZm7TMrZQs8s"; 

const maxTokens = 500;
const maxStorageMessage = 8; // Max number of messages (user + assistant) to keep in history
const modelName = "gemini-2.5-flash"; // Excellent for fast chat responses

// >>> CUSTOMIZE YOUR BOT'S PERSONALITY HERE <<<
// This system instruction defines Voidr's role and services for every conversation.
const customPrompt = "You are Voidr - Your Complete Business Partner. Your main priority is to help businesses grow by supplying products and creating a strong online presence. Keep your responses helpful, business-focused, and professional. Always offer your services: Product Supply, Website Creation, Social Media Setup, Logo Design, and Audience Growth. Respond concisely.";


// Initialize global state objects for GoatBot
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

// ------------------------------------
//             📜 COMMAND 📜
// ------------------------------------

module.exports = {
	config: {
		name: "gemini",
		version: "1.2",
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
		vi: {
			apiKeyEmpty: "Vui lòng cung cấp api key cho Gemini tại file scripts/cmds/gemini.js",
			yourAreUsing: "Bạn đang sử dụng Gemini chat, vui lòng chờ quay lại sau khi yêu cầu trước kết thúc",
			invalidContent: "Vui lòng nhập nội dung bạn muốn chat",
			error: "Đã có lỗi xảy ra\n%1",
			clearHistory: "Đã xóa lịch sử chat của bạn với Gemini"
		},
		en: {
			apiKeyEmpty: "Please provide API key for Gemini at file scripts/cmds/gemini.js",
			yourAreUsing: "You are using Gemini chat, please wait until the previous request ends",
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
				delete geminiHistory[event.senderID];
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

// ------------------------------------
//           🧠 HANDLER LOGIC 🧠
// ------------------------------------

async function handleGemini({ event, message, content, getLang, commandName }) {
	if (geminiUsing[event.senderID])
		return message.reply(getLang("yourAreUsing"));

	try {
		geminiUsing[event.senderID] = true;
		
        let chat = geminiHistory[event.senderID];

        // 1. Initialize chat session if it doesn't exist
        if (!chat) {
            // Create a new chat session with the custom prompt
            chat = ai.chats.create({
                model: modelName,
                systemInstruction: customPrompt,
                config: {
                    maxOutputTokens: maxTokens,
                    temperature: 0.7,
                }
            });
            geminiHistory[event.senderID] = chat;
        }

		// 2. Send the user's message
		// The SDK automatically handles the conversation history (including the prompt)
		const response = await chat.sendMessage({
            message: content
        });
		
		const text = response.candidates[0].content.parts[0].text;

		// 3. Reply to user (This is the only message sent)
		const replyInfo = await message.reply(text);
		
		// 4. Set reply context for follow-up conversation
		if (global.GoatBot && global.GoatBot.onReply) {
			global.GoatBot.onReply.set(replyInfo.messageID, {
				commandName,
				author: event.senderID,
				messageID: replyInfo.messageID,
				type: "gemini"
			});
		}
	}
	catch (err) {
		const errorMessage = err.message || "Unknown error.";
		console.error("Gemini Error:", errorMessage);
        
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
