const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3002;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const WHATSAPP_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const BOTPRESS_URL = process.env.BOTPRESS_URL;
const BOTPRESS_BOT_ID = process.env.BOTPRESS_BOT_ID;

async function sendWhatsAppText(to, text) {
const waUrl = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

await axios.post(
waUrl,
{
messaging_product: 'whatsapp',
to,
type: 'text',
text: { body: text }
},
{
headers: {
Authorization: `Bearer ${WHATSAPP_TOKEN}`,
'Content-Type': 'application/json'
}
}
);
}

app.get('/webhook', (req, res) => {
const mode = req.query['hub.mode'];
const token = req.query['hub.verify_token'];
const challenge = req.query['hub.challenge'];

if (mode === 'subscribe' && token === VERIFY_TOKEN) {
console.log('Webhook verified');
return res.status(200).send(challenge);
} else {
console.log('Webhook verification failed');
return res.sendStatus(403);
}
});
app.post('/webhook', async (req, res) => {
try {
const body = req.body;

const entry = body.entry && body.entry[0];
const changes = entry && entry.changes && entry.changes[0];
const value = changes && changes.value;
const messages = value && value.messages;

if (!messages || !messages.length) {
return res.sendStatus(200);
}

const message = messages[0];
const from = message.from;
let userText = '';

if (message.type === 'text') {
userText = (message.text && message.text.body) || '';
} else if (message.type === 'interactive') {
if (message.interactive.type === 'button_reply') {
userText = message.interactive.button_reply.id || message.interactive.button_reply.title || '';
} else if (message.interactive.type === 'list_reply') {
userText = message.interactive.list_reply.id || message.interactive.list_reply.title || '';
}
}

userText = (userText || '').trim();
console.log('Incoming from WhatsApp:', from, 'text:', userText);

if (!userText) {
return res.sendStatus(200);
}

const bpUrl = `${BOTPRESS_URL}/api/v1/bots/${BOTPRESS_BOT_ID}/converse/${from}`;

const bpResponse = await axios.post(bpUrl, {
type: 'text',
text: userText
});

const bpData = bpResponse.data;
console.log('Antwort von Botpress:', JSON.stringify(bpData, null, 2));

let replyText = '';

if (bpData && Array.isArray(bpData.responses) && bpData.responses.length > 0) {
const firstTextResp =
bpData.responses.find((r) => r.type === 'text') || bpData.responses[0];

if (firstTextResp && firstTextResp.text) {
replyText = firstTextResp.text;
}
}

if (!replyText) {
replyText =
'Ich habe dich nicht verstanden. Bitte antworte mit der passenden Zahl oder schreibe "Hi", um das Menü zu sehen.';
}

await sendWhatsAppText(from, replyText);

return res.sendStatus(200);
} catch (err) {
console.error('Fehler im /webhook Handler:', err.response?.data || err.message);
return res.sendStatus(500);
}
});

app.listen(PORT, () => {
console.log(`Server listening on port ${PORT}`);
});