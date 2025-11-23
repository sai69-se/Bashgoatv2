const { GoogleGenAI, types } = require("@google/genai"); // 💡 ADDED 'types' HERE

// ------------------------------------
//          🛠️ CONFIGURATION 🛠️
// ------------------------------------

// ⚠️ IMPORTANT: Replace this with your actual Gemini API key (starts with 'AIza...').
const apiKey = "AIzaSyDBFqdTMTJGi2UFuiUdlH5YZm7TMrZQs8s"; 

const maxTokens = 500;
const modelName = "gemini-2.5-flash"; // Recommended model for fast chat

// >>> CUSTOMIZE YOUR BOT'S PERSONALITY HERE <<<
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
		version: "1.4", // Updated version
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
            // Define safety settings to BLOCK_NONE for all relevant categories
            const safetySettings = [
                {
                    category: types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: types.HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: types.HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: types.HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: types.HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: types.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
                    threshold: types.HarmBlockThreshold.BLOCK_NONE,
                },
            ];

            chat = ai.chats.create({
                model: modelName,
                systemInstruction: customPrompt,
                config: {
                    maxOutputTokens: maxTokens,
                    temperature: 0.7,
                },
                // 💥 CRITICAL FIX: Add safety settings to disable filtering
                safetySettings: safetySettings, 
            });
            geminiHistory[event.senderID] = chat;
        }

		// 2. Send the user's message
		const response = await chat.sendMessage({
            message: content
        });
		
        // 🚨 SAFETY CHECK (remains for truly unresolvable issues like API key expiration)
        if (!response.candidates || response.candidates.length === 0) {
            const feedback = response.promptFeedback;
            let safetyReason = "The model provided no answer. This is likely due to an expired API key, a service quota limit, or an unresolvable core safety policy block.";
            
            if (feedback && feedback.blockReason) {
                 safetyReason = `The response was blocked. Block Reason: ${feedback.blockReason}`;
            }
            
            return message.reply(getLang('error', safetyReason));
        }
        
        // If candidates exist, safely extract the text
        const text = response.candidates[0].content.parts[0].text; 

		// 3. Reply to user (Single message response)
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
        } else if (errorMessage.includes("429 RESOURCE_EXHAUSTED")) {
             replyMessage = "An error occurred: API Quota Limit Reached (429 RESOURCE_EXHAUSTED). Please wait a few minutes or hours for your free tier quota to refresh.";
        }
		
		return message.reply(replyMessage);
	}
	finally {
		delete geminiUsing[event.senderID];
	}
}
