import twilio from 'twilio';
import {
  updateResponse,
  getSurveyResponses,
  updateSurveyStatus
} from './supabaseClient.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// FINAL FIXED BACKEND URL
const BACKEND_URL =
 process.env.NEXT_PUBLIC_BACKEND_URL ||
'https://call-agent-envo.onrender.com';

if (!accountSid || !authToken || !fromNumber) {
  throw new Error('Missing Twilio environment variables');
}

const client = twilio(accountSid, authToken);

// Memory state
const callState = new Map();

// ===============================
// START CALL
// ===============================
export async function initiateCall(
  surveyId,
  responseId,
  contactName,
  phoneNumber
) {
  try {
    const twimlUrl =
      `${BACKEND_URL}/api/ivr/greeting` +
      `?surveyId=${surveyId}` +
      `&responseId=${responseId}` +
      `&name=${encodeURIComponent(contactName)}`;

    const statusUrl =
      `${BACKEND_URL}/api/ivr/status`;

    const call = await client.calls.create({
      to: phoneNumber,
      from: fromNumber,
      url: twimlUrl,
      method: 'POST',
      statusCallback: statusUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: [
        'initiated',
        'ringing',
        'answered',
        'completed'
      ]
    });

    callState.set(call.sid, {
      surveyId,
      responseId,
      contactName,
      phoneNumber,
      answers: {}
    });

    console.log('Call started:', call.sid);

    return call;
  } catch (error) {
    console.error('Error initiating call:', error);
    throw error;
  }
}

// ===============================
// GREETING
// ===============================
export function generateGreetingTwiml(contactName) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say(
    {
      voice: 'alice'
    },
    `Hello ${contactName}. Welcome to our survey.`
  );

  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    method: 'POST',
    action: `${BACKEND_URL}/api/ivr/question1`
  });

  gather.say(
    { voice: 'alice' },
    'Press 1 if you passed 12th with Mathematics. Press 2 if No.'
  );

  twiml.redirect(
    {
      method: 'POST'
    },
    `${BACKEND_URL}/api/ivr/greeting`
  );

  return twiml.toString();
}

// ===============================
// QUESTION 1
// ===============================
export function generateQuestion1ResponseTwiml(answer) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (answer === '1') {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 8,
      method: 'POST',
      action: `${BACKEND_URL}/api/ivr/question2`
    });

    gather.say(
      { voice: 'alice' },
      'Are you interested in Engineering? Press 1 for Yes. Press 2 for No.'
    );
  } else {
    twiml.say(
      { voice: 'alice' },
      'Thank you for your response.'
    );

    twiml.hangup();
  }

  return twiml.toString();
}

// ===============================
// QUESTION 2
// ===============================
export function generateQuestion2ResponseTwiml(answer) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (answer === '1') {
    twiml.say(
      { voice: 'alice' },
      'Excellent. Thank you.'
    );

    twiml.hangup();
  } else {
    const gather = twiml.gather({
      numDigits: 1,
      timeout: 8,
      method: 'POST',
      action: `${BACKEND_URL}/api/ivr/question3`
    });

    gather.say(
      { voice: 'alice' },
      'Which course? Press 1 Science, 2 Commerce, 3 Arts, 4 Other.'
    );
  }

  return twiml.toString();
}

// ===============================
// QUESTION 3
// ===============================
export function generateQuestion3ResponseTwiml(answer) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say(
    { voice: 'alice' },
    'Thank you for completing survey.'
  );

  twiml.hangup();

  return twiml.toString();
}

// ===============================
// STATE HELPERS
// ===============================
export function getCallState(callSid) {
  return callState.get(callSid);
}

export function updateCallState(callSid, data) {
  const old = callState.get(callSid) || {};
  callState.set(callSid, {
    ...old,
    ...data
  });
}

export function cleanupCallState(callSid) {
  callState.delete(callSid);
}

export function getTwilioClient() {
  return client;
}